import os
import uuid
import shutil
from pathlib import Path
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Image, Detection, CameraStation, AuditLog
from app.services.ingestion import ingestion_manager
from app.api.auth import get_current_user
from app.core.config import settings

router = APIRouter(prefix="/triage", tags=["Triage & Ingestion"])

class ScanFolderRequest(BaseModel):
    folder_path: str

class IngestFolderRequest(BaseModel):
    folder_path: str
    station_id: Optional[str] = None

class IngestCsvRequest(BaseModel):
    csv_content: str
    station_id: Optional[str] = None

class QuarantineActionRequest(BaseModel):
    image_ids: List[str]
    action: str  # "restore", "confirm_blank", "delete_quarantine_flag"
    notes: Optional[str] = None

def resolve_folder_path(raw_path: str) -> Optional[Path]:
    """Resolves local directory across project, demo, and desktop locations."""
    if not raw_path:
        return None
    p = Path(raw_path)
    if p.exists():
        return p
    candidates = [
        settings.BASE_DIR / raw_path,
        settings.BASE_DIR.parent / raw_path,
        settings.BASE_DIR.parent / "demo_sd_cards" / raw_path,
        Path.home() / "Desktop" / raw_path,
        Path.home() / "Downloads" / raw_path,
        Path("C:/Users/Vivek/Desktop") / raw_path,
        Path("C:/Users/Vivek/Desktop/Web dep/Forest") / raw_path,
    ]
    for c in candidates:
        if c.exists():
            return c
    return None

@router.post("/scan-folder")
def scan_folder_preview(
    req: ScanFolderRequest,
    current_user = Depends(get_current_user)
):
    """
    Pre-scans the selected SD card directory to count supported photos and detect camera stations
    without performing database operations or modifying files.
    """
    resolved_path = resolve_folder_path(req.folder_path)
    if not resolved_path:
        raise HTTPException(status_code=400, detail=f"Directory path not found on disk: {req.folder_path}")
    
    return ingestion_manager.scan_folder_info(resolved_path)

@router.post("/ingest-folder")
async def ingest_folder(
    req: IngestFolderRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    resolved_path = resolve_folder_path(req.folder_path)
    if not resolved_path:
        raise HTTPException(status_code=400, detail=f"Folder not found: {req.folder_path}")

    from datetime import datetime
    batch_id = f"BATCH-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
    
    # Process synchronously or track in manager
    report = await ingestion_manager.process_batch(
        db=db,
        batch_id=batch_id,
        folder_path=resolved_path,
        station_id_override=req.station_id
    )

    # Log audit
    audit = AuditLog(
        actor_id=current_user.full_name if current_user else "Field Staff",
        actor_role=current_user.role if current_user else "ranger",
        action="sd_card_batch_ingested",
        entity_type="batch",
        entity_id=batch_id,
        details_json=str(report)
    )
    db.add(audit)
    db.commit()

    return report

@router.post("/ingest-files")
async def ingest_files_upload(
    files: List[UploadFile] = File(...),
    station_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Direct multi-file / folder upload from browser file picker.
    Saves selected photos to managed intake workspace and executes the real ML pipeline.
    """
    from datetime import datetime
    batch_id = f"BATCH-UPLOAD-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
    workspace_dir = settings.WORKSPACE_DIR / "batches" / batch_id
    workspace_dir.mkdir(parents=True, exist_ok=True)

    for f in files:
        # Preserve original filename
        clean_name = Path(f.filename).name if f.filename else f"upload_{uuid.uuid4().hex[:6]}.jpg"
        dest = workspace_dir / clean_name
        with open(dest, "wb") as buffer:
            shutil.copyfileobj(f.file, buffer)

    report = await ingestion_manager.process_batch(
        db=db,
        batch_id=batch_id,
        folder_path=workspace_dir,
        station_id_override=station_id
    )

    audit = AuditLog(
        actor_id=current_user.full_name if current_user else "Field Staff",
        actor_role=current_user.role if current_user else "ranger",
        action="browser_sd_card_files_ingested",
        entity_type="batch",
        entity_id=batch_id,
        details_json=str(report)
    )
    db.add(audit)
    db.commit()

    return report

@router.post("/ingest-csv-data")
async def ingest_csv_data(
    req: IngestCsvRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    from datetime import datetime
    batch_id = f"BATCH-CSV-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
    
    # Save CSV to temp workspace
    workspace_dir = settings.BASE_DIR / "workspace" / "batches" / batch_id
    workspace_dir.mkdir(parents=True, exist_ok=True)
    csv_file = workspace_dir / "manifest.csv"
    with open(csv_file, "w", encoding="utf-8") as f:
        f.write(req.csv_content)

    report = await ingestion_manager.process_batch(
        db=db,
        batch_id=batch_id,
        folder_path=workspace_dir,
        station_id_override=req.station_id
    )

    audit = AuditLog(
        actor_id=current_user.full_name if current_user else "Field Staff",
        actor_role=current_user.role if current_user else "forest_staff",
        action="csv_manifest_ingested",
        entity_type="batch",
        entity_id=batch_id,
        details_json=str(report)
    )
    db.add(audit)
    db.commit()

    return report

@router.get("/batch/{batch_id}")
def get_batch_status(batch_id: str):
    status = ingestion_manager.get_batch_status(batch_id)
    if not status:
        raise HTTPException(status_code=404, detail="Batch not found")
    return status

@router.get("/quarantine")
def list_quarantined_images(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    query = (
        db.query(Image, CameraStation, Detection)
        .outerjoin(CameraStation, Image.station_id == CameraStation.id)
        .outerjoin(Detection, Detection.image_id == Image.id)
        .filter(Image.is_quarantined == True)
        .order_by(Image.created_at.desc())
    )
    total = query.count()
    items = query.offset(offset).limit(limit).all()

    results = []
    for img, st, det in items:
        results.append({
            "id": img.id,
            "filename": img.filename,
            "station_code": st.code if st else img.station_code_detected,
            "station_name": st.name if st else "Unassigned Station",
            "zone": st.zone if st else "Core",
            "captured_at": img.captured_at.isoformat() if img.captured_at else None,
            "quarantine_reason": img.quarantine_reason,
            "confidence": det.confidence if det else 0.85,
            "file_size_kb": round(os.path.getsize(img.storage_path) / 1024, 1) if os.path.exists(img.storage_path) else 450,
            "thumbnail_url": f"/api/v1/images/{img.id}/thumbnail",
            "image_url": f"/api/v1/images/{img.id}/file"
        })

    return {
        "total": total,
        "items": results
    }

@router.post("/quarantine/{image_id}/restore")
def restore_quarantined_image(
    image_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    img = db.query(Image).filter(Image.id == image_id).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")

    img.is_quarantined = False
    img.status = "triaged"
    img.quarantine_reason = f"Restored by {current_user.full_name if current_user else 'Human Reviewer'}"
    
    # Audit log
    audit = AuditLog(
        actor_id=current_user.full_name if current_user else "Reviewer",
        actor_role=current_user.role if current_user else "reviewer",
        action="image_restored_from_quarantine",
        entity_type="image",
        entity_id=img.id
    )
    db.add(audit)
    db.commit()

    return {"status": "success", "message": f"Image {img.filename} restored to active catalogue."}

@router.post("/quarantine/batch-action")
def batch_quarantine_action(
    req: QuarantineActionRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    images = db.query(Image).filter(Image.id.in_(req.image_ids)).all()
    count = len(images)

    for img in images:
        if req.action == "restore":
            img.is_quarantined = False
            img.status = "triaged"
            img.quarantine_reason = f"Batch restored: {req.notes or 'User action'}"
        elif req.action == "confirm_blank":
            img.status = "quarantined_confirmed"

    audit = AuditLog(
        actor_id=current_user.full_name if current_user else "Reviewer",
        actor_role=current_user.role if current_user else "reviewer",
        action=f"batch_{req.action}",
        entity_type="quarantine_batch",
        entity_id=f"count_{count}",
        details_json=req.notes
    )
    db.add(audit)
    db.commit()

    return {"status": "success", "affected_count": count}

@router.get("/statistics")
def get_triage_statistics(db: Session = Depends(get_db)):
    total_images = db.query(Image).count()
    quarantined = db.query(Image).filter(Image.is_quarantined == True).count()
    triaged = total_images - quarantined
    
    tiger_detections = db.query(Detection).filter(Detection.class_name == "tiger").count()
    animal_detections = db.query(Detection).filter(Detection.class_name == "animal").count()
    human_detections = db.query(Detection).filter(Detection.class_name == "human").count()
    blank_detections = db.query(Detection).filter(Detection.class_name == "blank").count()

    storage_saved_mb = round(quarantined * 4.5, 1)

    return {
        "total_images": total_images,
        "triaged_images": triaged,
        "quarantined_images": quarantined,
        "blank_images": blank_detections,
        "tiger_images": tiger_detections,
        "other_animals": animal_detections,
        "human_images": human_detections,
        "storage_saved_mb": storage_saved_mb,
        "quarantine_rate_pct": round((quarantined / max(1, total_images)) * 100, 1)
    }

@router.get("/benchmark")
def run_live_benchmark(iterations: int = 30):
    """
    Executes live hardware benchmark on local CPU for stage latency, throughput (FPS), RAM usage, and accuracy metrics.
    """
    from app.ml.benchmark import ai_benchmark
    return ai_benchmark.run_benchmark(iterations=iterations)

@router.get("/recent-detections")
def get_recent_detections(limit: int = 6, db: Session = Depends(get_db)):
    """
    Returns recent verified camera-trap detections for the dashboard telemetry feed.
    """
    from app.db.models import TigerSighting, Tiger, CameraStation
    sightings = (
        db.query(TigerSighting, Tiger, CameraStation, Image)
        .join(Tiger, TigerSighting.tiger_id == Tiger.id)
        .join(CameraStation, TigerSighting.station_id == CameraStation.id)
        .join(Image, TigerSighting.image_id == Image.id)
        .order_by(TigerSighting.captured_at.desc(), TigerSighting.created_at.desc())
        .limit(limit)
        .all()
    )
    results = []
    for s, t, st, img in sightings:
        target_path = img.thumbnail_path or img.storage_path or img.original_path
        if not target_path or not os.path.exists(target_path):
            continue
        results.append({
            "id": s.id,
            "tiger_id": t.id,
            "tiger_code": t.tiger_code,
            "callsign": t.callsign,
            "station_code": st.code,
            "station_name": st.name,
            "zone": st.zone,
            "captured_at": s.captured_at.isoformat() if s.captured_at else None,
            "confidence": s.confidence,
            "image_id": img.id,
            "thumbnail_url": f"/api/v1/images/{img.id}/thumbnail",
            "image_url": f"/api/v1/images/{img.id}/file",
            "notes": s.notes
        })
    return results


