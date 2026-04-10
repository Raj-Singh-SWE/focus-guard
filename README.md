# SafeDrive OS

> Real-time AI-powered driver safety monitoring system with computer vision, WebSocket streaming, and a modern Next.js dashboard.

![SafeDrive OS](https://img.shields.io/badge/SafeDrive-OS-indigo?style=for-the-badge) ![Python](https://img.shields.io/badge/Python-FastAPI-green?style=flat-square) ![Next.js](https://img.shields.io/badge/Next.js-Dashboard-black?style=flat-square) ![YOLO](https://img.shields.io/badge/YOLOv8-CUDA-red?style=flat-square)

## Features

- **Drowsiness Detection** — MediaPipe FaceLandmarker with Eye Aspect Ratio (EAR)
- **Yawn Detection** — Mouth Aspect Ratio (MAR) monitoring
- **Phone Distraction** — YOLOv8 (COCO class 67) with 2-second threshold
- **Seatbelt Detection** — ROI-based heuristic using Canny + HoughLinesP
- **Head Pose Monitoring** — Detects eyes-off-road via facial landmark ratios
- **Real-time WebSocket Streaming** — Annotated video feed + JSON alert payloads
- **Audio & Visual Alarms** — Looping alarm with full-screen overlays
- **Smart Warnings** — Late night driving (1-5 AM) and 3-hour break reminders
- **Auth System** — Login page with mock authentication
- **Admin Panel** — License/Insurance expiry tracking with 30-day warnings

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15 (App Router), Tailwind CSS, Lucide Icons |
| **Backend** | Python FastAPI, WebSockets, SQLAlchemy |
| **CV/ML** | OpenCV, MediaPipe, YOLOv8 (Ultralytics), PyTorch |
| **Database** | SQLite (prototyping) |

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
# Download required model files:
# - face_landmarker.task (MediaPipe)
# - yolov8n.pt (auto-downloads on first run)
python -m uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` → Login → Start Drive Session.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | `localhost:8000` | Backend WebSocket/API host |

## Project Structure
```
├── backend/
│   ├── main.py          # FastAPI server + WebSocket endpoints
│   ├── vision.py        # CV pipeline (MediaPipe + YOLO + OpenCV)
│   ├── models.py        # SQLAlchemy ORM models
│   ├── database.py      # Database connection
│   └── requirements.txt
├── frontend/
│   └── app/
│       ├── login/       # Auth login page
│       ├── dashboard/   # Protected dashboard routes
│       ├── components/  # LiveMonitoring, AlertFeed, Sidebar, AuthGuard
│       └── lib/         # Centralized config
└── README.md
```

## Hardware

Optimized for **NVIDIA RTX 4050** (CUDA) with Intel i5. Falls back to CPU gracefully.

## License

MIT
