"""
SafeDrive OS - Computer Vision Pipeline (Hardened)
====================================================
Feature-rich hybrid ML approach:
  1. MediaPipe FaceLandmarker (CPU) → EAR drowsiness + MAR yawning + head pose
  2. YOLOv8 Nano (CUDA)            → Phone distraction + person bounding box
  3. OpenCV ROI + HoughLinesP       → Seatbelt heuristic (edge-based)
  4. Camera auto-recovery           → Handles USB disconnects / sleep events
  5. Adaptive frame skipping        → Dynamic YOLO skip based on processing time
"""

import cv2
import base64
import time
import math
import os
import numpy as np
from scipy.spatial import distance as dist

import mediapipe as mp
from mediapipe.tasks.python import BaseOptions
from mediapipe.tasks.python.vision import (
    FaceLandmarker,
    FaceLandmarkerOptions,
    RunningMode,
)

try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    print("[VisionPipeline] ultralytics not installed — YOLO disabled.")


# ──────────────────────────────────────────────
# CONSTANTS
# ──────────────────────────────────────────────
# Eye Aspect Ratio
EAR_THRESHOLD       = 0.25
EAR_CONSEC_FRAMES   = 20

# Mouth Aspect Ratio (yawn detection)
MAR_THRESHOLD       = 0.75
MAR_CONSEC_FRAMES   = 15

# Head pose: if nose-tip Y is significantly above chin midpoint
HEAD_DOWN_THRESHOLD = 0.12   # normalized distance ratio

# Seatbelt & Phone timeouts
SEATBELT_TIMEOUT_SEC = 5.0
PHONE_TIMEOUT_SEC    = 2.0

# YOLO adaptive skip
YOLO_MIN_SKIP  = 2   # minimum frames to skip between YOLO runs
YOLO_MAX_SKIP  = 6   # maximum frames to skip
YOLO_TARGET_MS = 50  # target YOLO latency in ms (aim for < 50ms)

FRAME_WIDTH  = 640
FRAME_HEIGHT = 480
MAX_CAMERA_RETRIES = 5
CAMERA_RETRY_DELAY = 1.0  # seconds

# MediaPipe FaceMesh landmark indices (478-point mesh)
LEFT_EYE_IDX   = [362, 385, 387, 263, 373, 380]
RIGHT_EYE_IDX  = [33,  160, 158, 133, 153, 144]
# Mouth landmarks for MAR: outer lip top/bottom/left/right + inner
MOUTH_IDX      = [61, 291, 0, 17, 13, 14, 78, 308]
# Head pose reference points
NOSE_TIP_IDX   = 1
CHIN_IDX       = 152
FOREHEAD_IDX   = 10


class VisionPipeline:
    """
    Production-grade computer vision processor with:
      - Drowsiness (EAR), Yawning (MAR), Head-down detection
      - Phone distraction (YOLO class 67)
      - ROI seatbelt heuristic (Canny + HoughLinesP)
      - Camera auto-recovery
      - Adaptive YOLO frame skipping
    """

    def __init__(self, camera_index: int = 0, use_cuda: bool = True):
        self._camera_index = camera_index
        self.cap = self._open_camera(camera_index)

        # ── MediaPipe FaceLandmarker ──
        options = FaceLandmarkerOptions(
            base_options=BaseOptions(model_asset_path="face_landmarker.task"),
            running_mode=RunningMode.IMAGE,
            num_faces=1,
            min_face_detection_confidence=0.5,
            min_face_presence_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        self.face_landmarker = FaceLandmarker.create_from_options(options)
        print("[VisionPipeline] FaceLandmarker initialized.")

        # ── YOLOv8 ──
        self.yolo_model = None
        self._yolo_device = "cpu"
        if YOLO_AVAILABLE:
            device = "cuda" if use_cuda else "cpu"
            try:
                import torch
                if not torch.cuda.is_available():
                    device = "cpu"
                self.yolo_model = YOLO("yolov8n.pt")
                self.yolo_model.to(device)
                self._yolo_device = device
                print(f"[VisionPipeline] General YOLO loaded on: {device}")
                
                # Seatbelt-specific YOLO (Optional Custom Neural Net)
                if os.path.exists("seatbelt.pt"):
                    self.seatbelt_model = YOLO("seatbelt.pt")
                    self.seatbelt_model.to(device)
                    print(f"[VisionPipeline] Custom Seatbelt YOLO loaded on: {device}")
                else:
                    self.seatbelt_model = None
            except Exception as e:
                print(f"[VisionPipeline] YOLO init failed ({e})")
                self.yolo_model = None
                self.seatbelt_model = None

        # ── State: Drowsiness ──
        self.ear_counter = 0
        self.is_drowsy = False

        # ── State: Yawning ──
        self.mar_counter = 0
        self.is_yawning = False

        # ── State: Head Pose ──
        self.head_down = False

        # ── State: Seatbelt ──
        self.seatbelt_on = True
        self.last_seatbelt_seen = time.time()

        # ── State: Phone ──
        self.phone_detected = False
        self.first_phone_seen = 0.0

        # ── Frame counter & adaptive skip ──
        self.frame_count = 0
        self.yolo_skip = YOLO_MIN_SKIP
        self._last_yolo_ms = 0.0

        # ── Performance stats ──
        self._fps_counter = 0
        self._fps_timer = time.time()
        self._current_fps = 0.0

    # ──────────────────────────────────────────
    #  Camera Open / Recovery
    # ──────────────────────────────────────────
    @staticmethod
    def _open_camera(index: int) -> cv2.VideoCapture:
        cap = cv2.VideoCapture(index, cv2.CAP_DSHOW)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_WIDTH)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_HEIGHT)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        if not cap.isOpened():
            raise RuntimeError(f"Cannot open webcam at index {index}.")
        print(f"[VisionPipeline] Camera opened: {FRAME_WIDTH}x{FRAME_HEIGHT}")
        return cap

    def _recover_camera(self) -> bool:
        """Attempt to re-open the camera after a failure."""
        print("[VisionPipeline] Attempting camera recovery...")
        for attempt in range(1, MAX_CAMERA_RETRIES + 1):
            try:
                if self.cap:
                    self.cap.release()
                self.cap = self._open_camera(self._camera_index)
                print(f"[VisionPipeline] Camera recovered on attempt {attempt}.")
                return True
            except RuntimeError:
                print(f"[VisionPipeline] Recovery attempt {attempt}/{MAX_CAMERA_RETRIES} failed.")
                time.sleep(CAMERA_RETRY_DELAY)
        print("[VisionPipeline] Camera recovery FAILED after all retries.")
        return False

    # ──────────────────────────────────────────
    #  Metric Helpers
    # ──────────────────────────────────────────
    @staticmethod
    def _compute_ear(eye_points: np.ndarray) -> float:
        """Eye Aspect Ratio: low = eyes closed."""
        A = dist.euclidean(eye_points[1], eye_points[5])
        B = dist.euclidean(eye_points[2], eye_points[4])
        C = dist.euclidean(eye_points[0], eye_points[3])
        if C == 0:
            return 0.3
        return (A + B) / (2.0 * C)

    @staticmethod
    def _compute_mar(mouth_points: np.ndarray) -> float:
        """
        Mouth Aspect Ratio: high = mouth open wide (yawning).
        Uses outer lip landmarks: top(13), bottom(14), left(78), right(308)
        and inner references (61, 291, 0, 17).
        
        MAR = vertical_opening / horizontal_width
        """
        # Vertical: distance between top lip and bottom lip inner edges
        A = dist.euclidean(mouth_points[4], mouth_points[5])  # 13 ↔ 14
        B = dist.euclidean(mouth_points[2], mouth_points[3])  # 0  ↔ 17
        # Horizontal: mouth width
        C = dist.euclidean(mouth_points[0], mouth_points[1])  # 61 ↔ 291
        if C == 0:
            return 0.0
        return (A + B) / (2.0 * C)

    @staticmethod
    def _draw_landmarks(frame, landmarks, w, h, indices, color=(0, 255, 0)):
        pts = np.array([(int(landmarks[i].x * w), int(landmarks[i].y * h)) for i in indices])
        cv2.polylines(frame, [pts], True, color, 1)
        return pts

    @staticmethod
    def _extract_points(landmarks, indices, w, h) -> np.ndarray:
        return np.array([(int(landmarks[i].x * w), int(landmarks[i].y * h)) for i in indices])

    def _update_fps(self):
        """Track actual processing FPS."""
        self._fps_counter += 1
        now = time.time()
        elapsed = now - self._fps_timer
        if elapsed >= 1.0:
            self._current_fps = self._fps_counter / elapsed
            self._fps_counter = 0
            self._fps_timer = now

    # ──────────────────────────────────────────
    #  Adaptive YOLO Frame Skip
    # ──────────────────────────────────────────
    def _update_yolo_skip(self, elapsed_ms: float):
        """
        Dynamically adjust how many frames we skip between YOLO runs.
        If YOLO is fast (< target), skip fewer frames for better detection.
        If YOLO is slow (> target), skip more frames to maintain FPS.
        """
        self._last_yolo_ms = elapsed_ms
        if elapsed_ms < YOLO_TARGET_MS * 0.7:
            self.yolo_skip = max(YOLO_MIN_SKIP, self.yolo_skip - 1)
        elif elapsed_ms > YOLO_TARGET_MS * 1.3:
            self.yolo_skip = min(YOLO_MAX_SKIP, self.yolo_skip + 1)

    # ──────────────────────────────────────────
    #  Main Processing
    # ──────────────────────────────────────────
    def process_frame(self, frame: np.ndarray) -> dict:
        h, w, _ = frame.shape
        alerts = {
            "drowsy": self.is_drowsy,
            "seatbelt_on": self.seatbelt_on,
            "phone_detected": self.phone_detected,
            "yawning": self.is_yawning,
            "head_down": self.head_down,
        }

        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        # ─────────── MEDIAPIPE: Face Analysis ───────────
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

        try:
            result = self.face_landmarker.detect(mp_image)
        except Exception as e:
            print(f"[VisionPipeline] FaceLandmarker error: {e}")
            return {"frame": frame, "alerts": alerts}

        if result.face_landmarks:
            for face_lms in result.face_landmarks:
                # Draw sparse face mesh (every 4th point for performance)
                for i, lm in enumerate(face_lms):
                    if i % 4 == 0:
                        cx, cy = int(lm.x * w), int(lm.y * h)
                        if 0 <= cy < h and 0 <= cx < w:
                            cv2.circle(frame, (cx, cy), 1, (80, 180, 80), -1)

                # ── EYE ASPECT RATIO (Drowsiness) ──
                left_eye  = self._draw_landmarks(frame, face_lms, w, h, LEFT_EYE_IDX, (0, 255, 0))
                right_eye = self._draw_landmarks(frame, face_lms, w, h, RIGHT_EYE_IDX, (0, 255, 0))

                left_ear  = self._compute_ear(left_eye)
                right_ear = self._compute_ear(right_eye)
                avg_ear   = (left_ear + right_ear) / 2.0

                cv2.putText(frame, f"EAR: {avg_ear:.2f}", (10, 30),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)

                if avg_ear < EAR_THRESHOLD:
                    self.ear_counter += 1
                    if self.ear_counter >= EAR_CONSEC_FRAMES:
                        self.is_drowsy = True
                else:
                    self.ear_counter = 0
                    self.is_drowsy = False

                alerts["drowsy"] = self.is_drowsy

                if self.is_drowsy:
                    cv2.putText(frame, "!! DROWSY !!", (w // 2 - 100, 50),
                               cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 255), 3)

                # ── MOUTH ASPECT RATIO (Yawn Detection) ──
                mouth_pts = self._extract_points(face_lms, MOUTH_IDX, w, h)
                mar = self._compute_mar(mouth_pts)

                cv2.putText(frame, f"MAR: {mar:.2f}", (10, 60),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 200, 0), 2)
                cv2.polylines(frame, [mouth_pts], True, (255, 200, 0), 1)

                if mar > MAR_THRESHOLD:
                    self.mar_counter += 1
                    if self.mar_counter >= MAR_CONSEC_FRAMES:
                        self.is_yawning = True
                else:
                    self.mar_counter = 0
                    self.is_yawning = False

                alerts["yawning"] = self.is_yawning

                if self.is_yawning:
                    cv2.putText(frame, "YAWNING!", (w // 2 - 80, 90),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 165, 255), 2)

                # ── HEAD POSE (looking down / eyes off road) ──
                nose = face_lms[NOSE_TIP_IDX]
                chin = face_lms[CHIN_IDX]
                forehead = face_lms[FOREHEAD_IDX]

                # Normalized vertical span of the face
                face_height = abs(forehead.y - chin.y)
                if face_height > 0.01:
                    # If nose tip is much closer to chin than forehead → head tilted down
                    nose_to_chin = abs(nose.y - chin.y)
                    ratio = nose_to_chin / face_height

                    if ratio < HEAD_DOWN_THRESHOLD:
                        self.head_down = True
                    else:
                        self.head_down = False
                else:
                    self.head_down = False

                alerts["head_down"] = self.head_down

                if self.head_down:
                    cv2.putText(frame, "HEAD DOWN!", (10, 90),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
        else:
            # No face detected — reset counters but keep last state for a grace period
            self.ear_counter = max(0, self.ear_counter - 1)
            self.mar_counter = max(0, self.mar_counter - 1)

        # ─────────── YOLO: Phone + Person (Adaptive Skip) ───────────
        self.frame_count += 1
        if self.yolo_model and self.frame_count % self.yolo_skip == 0:
            yolo_start = time.time()
            results = self.yolo_model(rgb_frame, verbose=False)
            yolo_elapsed_ms = (time.time() - yolo_start) * 1000
            self._update_yolo_skip(yolo_elapsed_ms)

            seatbelt_detected_this_frame = False
            phone_detected_this_frame = False

            for res in results:
                for box in res.boxes:
                    cls_id = int(box.cls[0])
                    conf   = float(box.conf[0])
                    label  = self.yolo_model.names[cls_id]
                    x1, y1, x2, y2 = map(int, box.xyxy[0])

                    # ── PHONE (Class 67) ──
                    if label == "cell phone" and conf > 0.4:
                        phone_detected_this_frame = True
                        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 3)
                        cv2.putText(frame, f"PHONE {conf:.0%}", (x1, y1 - 10),
                                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)

                    # ── PERSON → ROI SEATBELT ──
                    if label == "person" and conf > 0.5:
                        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)

                    # ── Seatbelt Detection Override ──
                    if getattr(self, "seatbelt_model", None) is not None:
                        # Direct neural net classification for Seatbelt
                        sb_res = self.seatbelt_model(frame, verbose=False, device=self._yolo_device)
                        for r_sb in sb_res:
                            for sb_box in r_sb.boxes:
                                if int(sb_box.cls[0]) == 0 and float(sb_box.conf[0]) > 0.6:  # Conf > 60%
                                    seatbelt_detected_this_frame = True
                                    sx1, sy1, sx2, sy2 = map(int, sb_box.xyxy[0])
                                    cv2.rectangle(frame, (sx1, sy1), (sx2, sy2), (0, 255, 0), 2)
                                    cv2.putText(frame, "Seatbelt Active", (sx1, sy1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
                                    break
                    else:
                        # Fallback Region-of-Interest heuristic logic
                        box_h = y2 - y1
                        box_w = x2 - x1

                        # ROI: chest/shoulder area (25%-75% height, 20%-80% width)
                        roi_y1 = max(0, int(y1 + box_h * 0.25))
                        roi_y2 = min(h, int(y1 + box_h * 0.75))
                        roi_x1 = max(0, int(x1 + box_w * 0.20))
                        roi_x2 = min(w, int(x1 + box_w * 0.80))

                        if roi_y2 > roi_y1 + 10 and roi_x2 > roi_x1 + 10:
                            roi = frame[roi_y1:roi_y2, roi_x1:roi_x2]
                            cv2.rectangle(frame, (roi_x1, roi_y1), (roi_x2, roi_y2), (255, 0, 255), 1)

                            gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
                            blur = cv2.GaussianBlur(gray, (5, 5), 0)
                            edges = cv2.Canny(blur, 50, 150, apertureSize=3)

                            lines = cv2.HoughLinesP(
                                edges, 1, np.pi / 180,
                                threshold=40, minLineLength=30, maxLineGap=10
                            )

                            if lines is not None:
                                for line in lines:
                                    lx1, ly1, lx2, ly2 = line[0]
                                    angle = abs(math.atan2(ly2 - ly1, lx2 - lx1) * 180.0 / math.pi)
                                    if 25 < angle < 75:
                                        seatbelt_detected_this_frame = True
                                        cv2.line(frame,
                                                 (roi_x1 + lx1, roi_y1 + ly1),
                                                 (roi_x1 + lx2, roi_y1 + ly2),
                                                 (0, 255, 255), 3)
                                        break

            # ── Seatbelt state machine ──
            if seatbelt_detected_this_frame:
                self.last_seatbelt_seen = time.time()
                self.seatbelt_on = True
            elif time.time() - self.last_seatbelt_seen > SEATBELT_TIMEOUT_SEC:
                self.seatbelt_on = False

            # ── Phone distraction state machine ──
            if phone_detected_this_frame:
                if self.first_phone_seen == 0.0:
                    self.first_phone_seen = time.time()
                elif time.time() - self.first_phone_seen > PHONE_TIMEOUT_SEC:
                    self.phone_detected = True
            else:
                self.first_phone_seen = 0.0
                self.phone_detected = False

            alerts["seatbelt_on"] = self.seatbelt_on
            alerts["phone_detected"] = self.phone_detected

            if not self.seatbelt_on:
                cv2.putText(frame, "NO SEATBELT!", (w // 2 - 100, h - 50),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 3)
            if self.phone_detected:
                cv2.putText(frame, "DISTRACTION!", (w // 2 - 90, h - 20),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 3)

        # ── FPS + YOLO latency overlay ──
        self._update_fps()
        cv2.putText(frame, f"FPS: {self._current_fps:.0f}", (w - 120, 30),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 2)
        if self._last_yolo_ms > 0:
            cv2.putText(frame, f"YOLO: {self._last_yolo_ms:.0f}ms (skip:{self.yolo_skip})",
                       (w - 260, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (150, 150, 150), 1)

        return {"frame": frame, "alerts": alerts}

    # ──────────────────────────────────────────
    #  Frame Generator (with auto-recovery)
    # ──────────────────────────────────────────
    def generate_frames(self):
        consecutive_failures = 0

        while True:
            if not self.cap or not self.cap.isOpened():
                if not self._recover_camera():
                    return  # Give up if recovery fails
                consecutive_failures = 0

            ret, frame = self.cap.read()

            if not ret:
                consecutive_failures += 1
                if consecutive_failures > 30:
                    print(f"[VisionPipeline] {consecutive_failures} consecutive read failures, recovering...")
                    if not self._recover_camera():
                        return
                    consecutive_failures = 0
                time.sleep(0.02)
                continue

            consecutive_failures = 0

            result = self.process_frame(frame)
            annotated = result["frame"]

            _, buffer = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 70])
            frame_b64 = base64.b64encode(buffer).decode("utf-8")

            yield {
                "frame_b64": frame_b64,
                "alerts": result["alerts"],
            }

    def release(self):
        if self.cap:
            self.cap.release()
        try:
            self.face_landmarker.close()
        except Exception:
            pass
        print("[VisionPipeline] Resources released.")
