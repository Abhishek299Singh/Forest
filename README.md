# Pench Tiger Reserve: Automated Camera Trap Triage & Tiger Movement Intelligence Platform

[![Python](https://img.shields.io/badge/Python-3.14-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-emerald.svg)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-cyan.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6.0-purple.svg)](https://vitejs.dev)
[![MapLibre](https://img.shields.io/badge/MapLibre_GL-3.0-orange.svg)](https://maplibre.org)
[![Offline--First](https://img.shields.io/badge/Offline--First-SQLite_%2B_Outbox-green.svg)]()

A production-grade, offline-first wildlife intelligence platform engineered for **Pench Tiger Reserve (Madhya Pradesh & Maharashtra)**. The platform provides end-to-end automated camera-trap triage, blank image quarantine preservation, individual tiger flank stripe re-identification, Minimum Convex Polygon (MCP 95%) home range calculation, and survey-effort normalized movement deviation alerting.

---

## 1. System Architecture

```text
       RAW FIELD SD CARDS (DCIM / RECONYX)
                     │
                     ▼
        [ Resumable Ingestion Engine ]
         (EXIF • GPS • Hasher • Clock Drift)
                     │
                     ▼
        [ Stage 1: Blank Triage Classifier ]
           ├─ Confidence ≥ 0.70  ──> [ Quarantine Vault ] (Zero Deletion)
           └─ Non-Blank / Animal ──> [ Stage 2: Torso & Flank Locator ]
                                             │
                                             ▼
                                 [ Stage 3: Stripe Texture Embedder ]
                                 (128-d Directional Gradient Vector)
                                             │
                                             ▼
                                 [ Stage 4: Cosine Catalogue Matcher ]
                                   ├─ Match ≥ 0.85 ──> Auto-Accepted Sighting
                                   ├─ 0.50–0.85    ──> Human Review Studio
                                   └─ Match < 0.50 ──> Provisional Individual (T-NEW-XXXX)
                                             │
                                             ▼
        [ Spatial Occupancy & Home Range Engine ]
        (Centroids • MCP 95% Polygons • Diurnal Curves • Territory Overlaps)
                     │
                     ▼
   [ Survey-Effort Normalized Movement Alert Engine ]
   (Buffer Incursions • Village Interfaces • Absence Scans)
                     │
                     ▼
    [ Offline SQLite Outbox ]  ◄───►  [ Central PostgreSQL Cloud Reconcile ]
                     │
                     ▼
    [ Interactive MapLibre Reserve GIS & Live Real-Time Dashboard ]
```

---

## 2. Key Features

### 🟢 Offline-First Field Operation
- Operates 100% locally on standard field laptops without internet connectivity.
- Local mutations queued in `sync_outbox` table with version tracking.
- Seamless one-click reconciliation when central connectivity is detected.

### 🛡️ Safe Blank Image Quarantine
- High-confidence blank captures are securely quarantined to save storage and analyst review time.
- **Zero Permanent Deletion Policy**: Raw files and metadata remain intact on disk with instant one-click restoration.

### 🐅 Stripe Re-Identification & Persistent Catalogue
- Isolates lateral flank stripe regions and computes 128-dimensional directional texture embeddings.
- Ranks candidate identities against the persistent reserve catalogue.
- Auto-enrolls unknown tigers as provisional individuals (`PTR-T-NEW-XXXX`) for biologist review.

### 🗺️ Interactive Reserve Map (MapLibre GL)
- Renders Pench Core Sanctuary, Multi-use Buffer Zone, River/Reservoir boundaries, and surrounding fringe villages (Turia, Jamtara, Karmajhiri, Gumtara, Telia, Chhindimatta).
- Displays camera stations, individual tiger home-range polygons (MCP 95%), activity centroids, chronological movement paths, and active alert beacons.

### 🚨 Survey-Effort Normalized Alerts
- Evaluates camera active trap-nights and deployment dates before alerting to distinguish genuine territorial shifts from new camera deployment artifacts.
- Alerts on Core $\to$ Buffer movement, Village-fringe proximity, Centroid deviation $> 4.0$ km, and Prolonged resident absence $> 45$ days.

---

## 3. Quick Start & Execution

### Prerequisites
- Python 3.10+ (Tested on Python 3.14)
- Node.js 18+ and npm

### Backend Setup
```bash
cd backend
..\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
API Documentation will be available at: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### Frontend Setup
```bash
cd frontend
npm.cmd install
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```
Frontend UI will be available at: [http://127.0.0.1:5173](http://127.0.0.1:5173)

---

## 4. Running Backend Automated Tests

```bash
cd backend
..\venv\Scripts\pytest
```

---

## 5. Sample SD Card Datasets (Demo Mode)

The system includes pre-generated demo SD card batches in `demo_sd_cards/`:
1. `demo_sd_cards/batch_01_core_turia` — Turia Core resident tiger captures and foliage blanks.
2. `demo_sd_cards/batch_02_buffer_gumtara` — Gumtara Buffer tiger incursion and forest staff images.
3. `demo_sd_cards/batch_03_mixed_messy` — Mixed nested folder structure (`DCIM/100EKTA`).

---

## 6. Security, RBAC & Privacy Compliance

- **Role-Based Access**:
  - `Admin` (Field Director): Complete administrative control and policy adjustment.
  - `Biologist`: Tiger catalogue updates, stripe identification, and territory analysis.
  - `Forest Staff`: Station maintenance, SD card ingestion, and alert patrol response.
  - `Reviewer`: Flank comparison and quarantine triage review.
- **Privacy Protection**: Human face and body captures are blurred with restricted access.
- **Auditability**: Every automated triage and human biologist decision is preserved in immutable audit logs.
