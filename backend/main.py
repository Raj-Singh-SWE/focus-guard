"""
Focus Drive OS - FastAPI Backend (Hardened)
==========================================
Production-grade WebSocket server with:
  - ConnectionManager for lifecycle management
  - Heartbeat / ping-pong keepalive (30s interval)
  - Graceful camera recovery & cleanup
  - Thread-safe vision pipeline sharing
  - Health & readiness HTTP endpoints
"""

import asyncio
import json
import time
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Set
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import engine, Base, get_db
import models
import schemas
import crud
from vision import VisionPipeline


# ──────────────────────────────────────────────
#  Connection Manager (Thread-Safe)
# ──────────────────────────────────────────────
class ConnectionManager:
    """
    Manages WebSocket connections with heartbeat monitoring.
    Thread-safe for concurrent access from the vision loop.
    """

    def __init__(self):
        self._video_clients: Set[WebSocket] = set()
        self._alert_clients: Set[WebSocket] = set()
        self._lock = threading.Lock()
        self._stats = {
            "total_video_connections": 0,
            "total_alert_connections": 0,
            "frames_sent": 0,
            "alerts_sent": 0,
            "errors": 0,
        }

    # ── Video Clients ──
    def add_video(self, ws: WebSocket):
        with self._lock:
            self._video_clients.add(ws)
            self._stats["total_video_connections"] += 1

    def remove_video(self, ws: WebSocket):
        with self._lock:
            self._video_clients.discard(ws)

    @property
    def video_clients(self) -> Set[WebSocket]:
        with self._lock:
            return self._video_clients.copy()

    # ── Alert Clients ──
    def add_alert(self, ws: WebSocket):
        with self._lock:
            self._alert_clients.add(ws)
            self._stats["total_alert_connections"] += 1

    def remove_alert(self, ws: WebSocket):
        with self._lock:
            self._alert_clients.discard(ws)

    @property
    def alert_clients(self) -> Set[WebSocket]:
        with self._lock:
            return self._alert_clients.copy()

    def inc_stat(self, key: str, n: int = 1):
        self._stats[key] = self._stats.get(key, 0) + n

    @property
    def stats(self) -> dict:
        return {
            **self._stats,
            "active_video_clients": len(self._video_clients),
            "active_alert_clients": len(self._alert_clients),
        }


# ──────────────────────────────────────────────
#  Application Lifespan
# ──────────────────────────────────────────────
manager = ConnectionManager()
executor = ThreadPoolExecutor(max_workers=3)
vision_pipeline: VisionPipeline | None = None
vision_lock = threading.Lock()
_server_start_time = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database tables exist
    models.Base.metadata.create_all(bind=engine)
    
    global _server_start_time
    _server_start_time = time.time()
    print("[Server] Focus Drive OS backend starting up...")
    Base.metadata.create_all(bind=engine)
    yield
    # Cleanup on shutdown
    global vision_pipeline
    with vision_lock:
        if vision_pipeline:
            vision_pipeline.release()
            vision_pipeline = None
    executor.shutdown(wait=False)
    print("[Server] Focus Drive OS backend shut down.")


app = FastAPI(title="Focus Drive OS Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────
#  HTTP Endpoints (Database APIs)
# ──────────────────────────────────────────────

@app.get("/api/user/{email}", response_model=schemas.UserResponse)
def get_user_profile(email: str, db: Session = Depends(get_db)):
    user = crud.get_user_by_email(db, email=email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.put("/api/user/{email}", response_model=schemas.UserResponse)
def update_user_profile(email: str, user_update: schemas.UserUpdate, db: Session = Depends(get_db)):
    updated_user = crud.create_or_update_user(db, email, user_update)
    if not updated_user:
        raise HTTPException(status_code=404, detail="Failed to update or initialize user")
    return updated_user

@app.get("/api/sessions", response_model=list[schemas.DrivingSessionResponse])
def get_sessions(skip: int = 0, limit: int = 50, email: str | None = None, db: Session = Depends(get_db)):
    return crud.get_driving_sessions(db, skip=skip, limit=limit, user_email=email)

@app.post("/api/sessions", response_model=schemas.DrivingSessionResponse)
def start_session(session_in: schemas.DrivingSessionCreate = None, db: Session = Depends(get_db)):
    user_email = session_in.user_email if session_in else None
    return crud.create_driving_session(db, user_email=user_email)

@app.put("/api/sessions/{session_id}", response_model=schemas.DrivingSessionResponse)
def update_session(session_id: int, session: schemas.DrivingSessionUpdate, db: Session = Depends(get_db)):
    updated = crud.update_driving_session(db, session_id, session)
    if not updated:
        raise HTTPException(status_code=404, detail="Session not found")
    return updated

# ──────────────────────────────────────────────
#  HTTP Endpoints (Health & Status)
# ──────────────────────────────────────────────
@app.get("/")
def health_check():
    """Basic health probe."""
    uptime = int(time.time() - _server_start_time)
    gpu_info = "N/A"
    cuda = False
    try:
        import torch
        cuda = torch.cuda.is_available()
        if cuda:
            gpu_info = torch.cuda.get_device_name(0)
    except ImportError:
        pass
    return {
        "status": "ok",
        "service": "Focus Drive OS API",
        "uptime_seconds": uptime,
        "cuda_available": cuda,
        "gpu": gpu_info,
        "connections": manager.stats,
    }


@app.get("/readiness")
def readiness():
    """Whether the vision pipeline is ready to stream."""
    return {
        "ready": vision_pipeline is not None and vision_pipeline.cap.isOpened(),
        "pipeline_active": vision_pipeline is not None,
    }


# ──────────────────────────────────────────────
#  Helper: Broadcast alerts to all /ws/alerts
# ──────────────────────────────────────────────
async def broadcast_alerts(alerts: dict):
    """
    Converts raw alert dict into distinct event payloads and
    broadcasts to all connected alert clients.
    """
    drowsy = alerts.get("drowsy", False)
    phone = alerts.get("phone_detected", False)
    seatbelt_on = alerts.get("seatbelt_on", True)
    yawning = alerts.get("yawning", False)
    head_down = alerts.get("head_down", False)

    events = []
    if drowsy:
        events.append({"event": "drowsiness", "message": "Drowsiness Detected - WAKE UP!"})
    if yawning:
        events.append({"event": "yawning", "message": "Frequent Yawning - Stay Alert!"})
    if head_down:
        events.append({"event": "head_down", "message": "Eyes Off Road - Look Ahead!"})
    if phone:
        events.append({"event": "distraction", "message": "Phone Detected! Please pull over."})
    if not seatbelt_on:
        events.append({"event": "seatbelt", "message": "Fasten Seatbelt"})

    # If everything is fine, send a clear event
    if not drowsy and not phone and seatbelt_on and not yawning and not head_down:
        events.append({"event": "clear", "message": "All clear"})

    dead: list[WebSocket] = []
    for ev in events:
        payload = json.dumps(ev)
        for client in manager.alert_clients:
            try:
                await client.send_text(payload)
                manager.inc_stat("alerts_sent")
            except Exception:
                dead.append(client)
                manager.inc_stat("errors")

    for c in dead:
        manager.remove_alert(c)


# ──────────────────────────────────────────────
#  WebSocket: Video Feed
# ──────────────────────────────────────────────
@app.websocket("/ws/video-feed")
async def websocket_video_feed(websocket: WebSocket):
    """
    Streams annotated base64 JPEG frames from the CV pipeline.
    Includes heartbeat monitoring and automatic camera recovery.
    """
    global vision_pipeline
    await websocket.accept()
    manager.add_video(websocket)
    print(f"[Video] Client connected. Active: {len(manager.video_clients)}")

    # ── Lazy-init pipeline with retry ──
    with vision_lock:
        if vision_pipeline is None:
            retries = 3
            for attempt in range(1, retries + 1):
                try:
                    vision_pipeline = VisionPipeline(camera_index=0, use_cuda=True)
                    print("[Server] Vision pipeline initialized.")
                    break
                except RuntimeError as e:
                    print(f"[Server] Pipeline init attempt {attempt}/{retries} failed: {e}")
                    if attempt == retries:
                        await websocket.send_text(json.dumps({"error": str(e)}))
                        await websocket.close()
                        manager.remove_video(websocket)
                        return
                    await asyncio.sleep(1)

    loop = asyncio.get_event_loop()
    last_heartbeat = time.time()
    consecutive_errors = 0
    MAX_CONSECUTIVE_ERRORS = 10

    try:
        gen = vision_pipeline.generate_frames()

        while True:
            try:
                result = await loop.run_in_executor(executor, next, gen)
                consecutive_errors = 0  # Reset on success
            except StopIteration:
                print("[Video] Generator exhausted, restarting pipeline...")
                with vision_lock:
                    if vision_pipeline:
                        vision_pipeline.release()
                    vision_pipeline = VisionPipeline(camera_index=0, use_cuda=True)
                    gen = vision_pipeline.generate_frames()
                continue
            except Exception as e:
                consecutive_errors += 1
                print(f"[Video] Frame error ({consecutive_errors}): {e}")
                if consecutive_errors >= MAX_CONSECUTIVE_ERRORS:
                    print("[Video] Too many errors, restarting pipeline...")
                    with vision_lock:
                        if vision_pipeline:
                            vision_pipeline.release()
                        vision_pipeline = VisionPipeline(camera_index=0, use_cuda=True)
                        gen = vision_pipeline.generate_frames()
                    consecutive_errors = 0
                await asyncio.sleep(0.05)
                continue

            frame_b64 = result["frame_b64"]
            alerts = result["alerts"]

            # Send frame to this video client
            try:
                await websocket.send_text(json.dumps({
                    "type": "frame",
                    "data": frame_b64,
                }))
                manager.inc_stat("frames_sent")
            except Exception:
                break  # Client disconnected

            # Broadcast alerts
            await broadcast_alerts(alerts)

            # ── Heartbeat: send a ping every 30s ──
            now = time.time()
            if now - last_heartbeat > 30:
                try:
                    await websocket.send_text(json.dumps({"type": "heartbeat", "ts": now}))
                    last_heartbeat = now
                except Exception:
                    break

            await asyncio.sleep(0.01)

    except WebSocketDisconnect:
        print("[Video] Client disconnected normally.")
    except Exception as e:
        print(f"[Video] Unexpected error: {e}")
    finally:
        manager.remove_video(websocket)
        # Only release pipeline if no other video clients are connected
        if len(manager.video_clients) == 0:
            with vision_lock:
                if vision_pipeline:
                    vision_pipeline.release()
                    vision_pipeline = None
                    print("[Server] Pipeline released (no clients).")


# ──────────────────────────────────────────────
#  WebSocket: Alerts
# ──────────────────────────────────────────────
@app.websocket("/ws/alerts")
async def websocket_alerts(websocket: WebSocket):
    """
    Clients connect here to receive real-time alert broadcasts.
    Includes keepalive pong responses.
    """
    await websocket.accept()
    manager.add_alert(websocket)
    print(f"[Alerts] Client connected. Active: {len(manager.alert_clients)}")

    try:
        while True:
            msg = await websocket.receive_text()
            # Respond to keepalive pings from the frontend
            if msg == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        manager.remove_alert(websocket)
        print(f"[Alerts] Client disconnected. Active: {len(manager.alert_clients)}")
 
