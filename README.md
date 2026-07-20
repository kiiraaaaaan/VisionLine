# VisionLine — Real-Time Industrial Defect Detection Platform

> **Inspect. Stream. Review.**

VisionLine is a full-stack industrial quality inspection platform built on top of the RIDAC research pipeline. It replaces the original single-script Gradio application with a production-grade web platform featuring real-time live camera inspection, batch ZIP uploads, a persistent inspection history, manager review workflows, and an analytics dashboard.

---

## Architecture Overview

```
┌──────────────────────────────┐      HTTP / REST
│   Next.js 14 Frontend        │ ◄──────────────────► ┌──────────────────────┐
│   (TypeScript + Tailwind)    │                        │  FastAPI Backend     │
│                              │                        │  (Python 3.11+)      │
│  Pages:                      │                        │                      │
│  • Dashboard (analytics)     │                        │  AI Pipeline:        │
│  • Live Inspection           │                        │  • YOLOv8n (person)  │
│  • Upload Sandbox            │                        │  • Keras Classifier  │
│  • Inspection History        │                        │                      │
│  • Mobile Camera Streamer    │                        │  Database:           │
└──────────────────────────────┘                        │  PostgreSQL (async)  │
                                                        └──────────────────────┘
```

---

## Key Features

| Feature | Description |
|---|---|
| **Live Multi-Camera Inspection** | Connect multiple webcams or IP cameras simultaneously; each feed is independently analyzed in real time |
| **Mobile Camera Streamer** | Use any smartphone as a wireless inspection camera over Wi-Fi |
| **Batch Upload Sandbox** | Upload individual images or a ZIP archive for offline batch inspection |
| **Human Detection** | YOLOv8n COCO detector flags frames containing human operators with a blue border alert |
| **Annotated Results** | Every inspected image is returned with a ✅ green (normal) or 🔴 red (defective) border overlay |
| **Inspection History Gallery** | All inspections are persisted in PostgreSQL with full image data, status, and detection metadata |
| **Manager Review Workflow** | Defective results require manual review (PENDING → APPROVED / REJECTED) by a named reviewer |
| **Analytics Dashboard** | Live defect rate, daily trends (14-day chart), class breakdowns, and average inference time |
| **OOD Guard** | Blank/uniform frames are automatically rejected before reaching the classifier |

---

## AI Pipeline

The inspection pipeline runs two models in sequence:

```
Input Image
    │
    ▼
┌─────────────────────────────┐
│  OOD Heuristic Check        │  pixel std < 1.5 → UNSUPPORTED
└────────────┬────────────────┘
             │
    ▼
┌─────────────────────────────┐
│  YOLOv8n Person Detector    │  COCO class 0, conf ≥ 0.5 → HUMAN
│  (pre-trained, COCO)        │
└────────────┬────────────────┘
             │
    ▼
┌─────────────────────────────┐
│  Keras Binary Classifier    │  prob < threshold → DEFECTIVE
│  (industry_defect.keras)    │  prob ≥ threshold → NORMAL
└────────────┬────────────────┘
             │
    ▼
Annotated JPEG + JSON result
```

**Model files required** (place in `models/`):

| File | Purpose |
|---|---|
| `models/yolov8n.pt` | Pre-trained YOLOv8n COCO — human detection |
| `models/industry_defect.keras` | Fine-tuned Keras binary classifier — defect classification |

---

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Web framework | **FastAPI** 0.110+ |
| ASGI server | **Uvicorn** (with `standard` extras) |
| ML runtime | **PyTorch** 2.3+ / **Keras** (TF backend) |
| Object detection | **Ultralytics YOLOv8n** (COCO person detector) |
| Image processing | **OpenCV**, **Pillow**, **NumPy** |
| ORM | **SQLAlchemy** 2.0 (async) |
| Database driver | **asyncpg** (PostgreSQL) |
| Data validation | **Pydantic** v2 + **pydantic-settings** |
| File uploads | **python-multipart** |

### Frontend
| Layer | Technology |
|---|---|
| Framework | **Next.js** 14 (App Router) |
| Language | **TypeScript** |
| Styling | **Tailwind CSS** 3 |
| Charts | **Recharts** |
| Icons | **Lucide React** |
| Camera API | Browser `MediaDevices` / `getUserMedia` |

### Infrastructure
| Component | Technology |
|---|---|
| Database | **PostgreSQL** |
| Runtime | Python 3.11+, Node.js 18+ |

---

## Repository Structure

```
VisionLine/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app, CORS, lifespan
│   │   ├── config.py                # Settings (DB URL, model paths, thresholds)
│   │   ├── database.py              # Async SQLAlchemy engine + session
│   │   ├── api/
│   │   │   ├── router.py            # Top-level API router
│   │   │   └── endpoints/
│   │   │       ├── inspections.py   # Inspect, list, get, review endpoints
│   │   │       └── analytics.py     # Dashboard stats endpoint
│   │   ├── models/
│   │   │   ├── inspection.py        # Inspection ORM model
│   │   │   └── detection.py         # Detection ORM model
│   │   ├── schemas/
│   │   │   ├── inspection.py        # Pydantic request/response schemas
│   │   │   └── detection.py         # Detection schema
│   │   └── services/
│   │       ├── ai_service.py        # Main inference pipeline (OOD + YOLO + Keras)
│   │       ├── classifier_service.py # Pluggable classifier backend factory
│   │       └── db_service.py        # All database CRUD + analytics queries
│   └── requirements.txt             # Backend Python dependencies
├── frontend/
│   ├── app/
│   │   ├── layout.tsx               # Root layout (navbar, fonts)
│   │   ├── page.tsx                 # Dashboard — analytics + stats
│   │   ├── live/page.tsx            # Live multi-camera inspection
│   │   ├── upload/page.tsx          # Batch upload sandbox
│   │   ├── inspections/[id]/page.tsx # Inspection detail + review
│   │   ├── mobile-cam/page.tsx      # Mobile camera streamer
│   │   ├── config.ts                # API_BASE URL config
│   │   └── globals.css              # Global styles
│   └── package.json
├── models/
│   ├── yolov8n.pt                   # YOLOv8n COCO person detector
│   └── industry_defect.keras        # Keras defect classifier
├── requirements.txt                 # Root-level dependency reference
├── LICENSE
└── README.md
```

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL (running locally or via Docker)

### 1. Clone the repository

```bash
git clone https://github.com/kiiraaaaaan/VisionLine.git
cd VisionLine
```

### 2. Set up the Python environment

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
```

> For GPU inference, install a CUDA-matched PyTorch build first:
> https://pytorch.org/get-started/locally/

### 3. Configure the database

Create a PostgreSQL database named `ridac` and set the connection string:

```bash
# Default (matches local PostgreSQL)
export DATABASE_URL="postgresql+asyncpg://postgres:postgrespassword@localhost:5432/ridac"
```

The backend will **auto-create all tables** on first startup via SQLAlchemy.

### 4. Place model files

```bash
models/
├── yolov8n.pt             # Download from ultralytics.com
└── industry_defect.keras  # Your trained Keras classifier
```

### 5. Start the backend

```bash
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 6. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

### 7. Open the app

| Service | URL |
|---|---|
| Frontend (VisionLine) | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| Swagger API Docs | http://localhost:8000/docs |

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/inspections/inspect` | Upload a single image for inspection |
| `POST` | `/api/inspections/inspect-batch` | Upload a ZIP file for batch inspection |
| `GET` | `/api/inspections/` | List all inspections (paginated, filterable) |
| `GET` | `/api/inspections/{id}` | Get a single inspection with full detection data |
| `GET` | `/api/inspections/{id}/image/original` | Serve the original image |
| `GET` | `/api/inspections/{id}/image/annotated` | Serve the annotated result image |
| `PATCH` | `/api/inspections/{id}/review` | Submit manager review (APPROVED/REJECTED) |
| `GET` | `/api/analytics/dashboard` | Aggregated dashboard stats + daily trends |

---

## Inspection Statuses

| Status | Meaning |
|---|---|
| `NORMAL` | Classifier determined the item is defect-free |
| `DEFECTIVE` | Classifier detected a defect (requires manager review) |
| `HUMAN` | A human operator was detected in the frame |
| `UNSUPPORTED` | Frame was blank/uniform — rejected by OOD guard |
| `ERROR` | Image could not be decoded |

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgrespassword@localhost:5432/ridac` | PostgreSQL connection string |
| `KERAS_MODEL_PATH` | `models/industry_defect.keras` | Path to the Keras classifier checkpoint |
| `CLASSIFIER_BACKEND` | `keras` | Classifier backend (`keras` supported) |
| `LOW_CONFIDENCE_THRESHOLD` | `0.70` | Confidence below this triggers a manual review warning |

---

## License

RIDAC / VisionLine source code is licensed under the [MIT License](LICENSE).

---

## Author

**Kamaraj Mathiarasan**
- GitHub: [kiiraaaaaan](https://github.com/kiiraaaaaan)

Contributions, bug reports, and deployment improvements are welcome.
