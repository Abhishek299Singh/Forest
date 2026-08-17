import os
import uuid
import shutil
from pathlib import Path
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Image, Detection, CameraStation, AuditLog, Tiger, TigerSighting
from app.services.ingestion import ingestion_manager
from app.api.auth import get_current_user
from app.core.config import settings

router = APIRouter(prefix="/triage", tags=["Triage & Ingestion"])

class ScanFolderRequest(BaseModel):
    folder_path: str

class IngestFolderRequest(BaseModel):
    folder_path: str
    station_id: Optional[str] = None
    coordinates_csv: Optional[str] = None

class ValidateIntakeRequest(BaseModel):
    folder_path: Optional[str] = None
    image_filenames: Optional[List[str]] = None
    coordinates_csv: Optional[str] = None

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

@router.post("/validate-intake")
def validate_intake_preview(
    req: ValidateIntakeRequest,
    current_user = Depends(get_current_user)
):
    """
    Validates Image List / Folder + Metadata CSV prior to processing.
    Enforces mandatory image and CSV presence and bidirectional filename matching.
    """
    resolved_path = resolve_folder_path(req.folder_path) if req.folder_path else None
    return ingestion_manager.validate_intake(
        folder_path=resolved_path,
        image_filenames=req.image_filenames,
        coordinates_csv_content=req.coordinates_csv
    )

@router.post("/scan-folder")
def scan_folder_preview(
    req: ScanFolderRequest,
    current_user = Depends(get_current_user)
):
    """
    Pre-scans the selected directory to count photos and detect metadata
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
    
    try:
        report = await ingestion_manager.process_batch(
            db=db,
            batch_id=batch_id,
            folder_path=resolved_path,
            station_id_override=req.station_id,
            coordinates_csv_content=req.coordinates_csv
        )
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))

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
    files: Optional[List[UploadFile]] = File(None),
    station_id: Optional[str] = Form(None),
    coordinates_csv: Optional[str] = Form(None),
    csv_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Direct multi-file upload requiring BOTH images and a CSV metadata file.
    Validates bidirectional filename matching and coordinates before executing AI inference for every image.
    """
    if not files or len(files) == 0:
        raise HTTPException(status_code=400, detail="At least one image is required. Please upload images before starting analysis.")

    # Resolve CSV content
    csv_text = coordinates_csv
    if (not csv_text or not csv_text.strip()) and csv_file:
        content_bytes = await csv_file.read()
        csv_text = content_bytes.decode("utf-8-sig", errors="ignore")

    if not csv_text or not csv_text.strip():
        raise HTTPException(status_code=400, detail="CSV metadata file is required. Please upload the CSV before starting analysis.")

    image_names = [f.filename for f in files if f.filename]
    val_res = ingestion_manager.validate_and_parse_intake_csv(csv_text, image_names)
    if not val_res["valid"]:
        raise HTTPException(status_code=400, detail="\n".join(val_res["errors"]))

    from datetime import datetime
    batch_id = f"BATCH-UPLOAD-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
    workspace_dir = settings.WORKSPACE_DIR / "batches" / batch_id
    workspace_dir.mkdir(parents=True, exist_ok=True)

    for f in files:
        clean_name = Path(f.filename).name if f.filename else f"upload_{uuid.uuid4().hex[:6]}.jpg"
        dest = workspace_dir / clean_name
        with open(dest, "wb") as buffer:
            shutil.copyfileobj(f.file, buffer)

    try:
        report = await ingestion_manager.process_batch(
            db=db,
            batch_id=batch_id,
            folder_path=workspace_dir,
            station_id_override=station_id,
            coordinates_csv_content=csv_text
        )
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))

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
    
    workspace_dir = settings.BASE_DIR / "workspace" / "batches" / batch_id
    workspace_dir.mkdir(parents=True, exist_ok=True)
    csv_file = workspace_dir / "manifest.csv"
    with open(csv_file, "w", encoding="utf-8") as f:
        f.write(req.csv_content)

    try:
        report = await ingestion_manager.process_batch(
            db=db,
            batch_id=batch_id,
            folder_path=workspace_dir,
            station_id_override=req.station_id
        )
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))

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
    """
    Computes live dynamic dataset metrics from actual SQLite database records.
    """
    total_images = db.query(Image).count()
    quarantined = db.query(Image).filter(Image.is_quarantined == True).count()
    triaged = total_images - quarantined
    
    tiger_detections = db.query(Detection).filter(Detection.class_name == "tiger").count()
    animal_detections = db.query(Detection).filter(Detection.class_name.in_(["animal", "wildlife"])).count()
    human_detections = db.query(Detection).filter(Detection.class_name == "human").count()
    blank_detections = db.query(Detection).filter(Detection.class_name == "blank").count()

    unique_tigers = db.query(Tiger).count()
    active_cameras = db.query(CameraStation).count()

    detections = db.query(Detection).all()
    avg_conf = (sum(d.confidence for d in detections) / len(detections) * 100) if detections else 0.0

    latest_sighting = db.query(TigerSighting).order_by(TigerSighting.captured_at.desc()).first()
    latest_img = db.query(Image).order_by(Image.captured_at.desc()).first()
    latest_time = None
    if latest_sighting and latest_sighting.captured_at:
        latest_time = latest_sighting.captured_at.strftime("%I:%M %p")
    elif latest_img and latest_img.captured_at:
        latest_time = latest_img.captured_at.strftime("%I:%M %p")

    gps_locations = db.query(TigerSighting).filter(TigerSighting.latitude != None, TigerSighting.longitude != None).count()

    return {
        "total_images": total_images,
        "triaged_images": triaged,
        "quarantined_images": quarantined,
        "blank_images": blank_detections,
        "tiger_images": tiger_detections,
        "tiger_detections": tiger_detections,
        "other_animals": animal_detections,
        "human_images": human_detections,
        "unique_tigers": unique_tigers,
        "active_cameras": active_cameras,
        "average_confidence": round(avg_conf, 1),
        "latest_detection": latest_time or "N/A",
        "total_gps_locations": gps_locations,
        "storage_saved_mb": round(quarantined * 4.5, 1),
        "quarantine_rate_pct": round((quarantined / max(1, total_images)) * 100, 1)
    }

@router.get("/movement-tracks")
def get_tiger_movement_tracks(db: Session = Depends(get_db)):
    """
    Returns chronological GPS tracks and observed range polygons for each identified tiger.
    """
    tigers = db.query(Tiger).all()
    tracks = []
    
    for t in tigers:
        sightings = (
            db.query(TigerSighting, CameraStation, Image)
            .outerjoin(CameraStation, TigerSighting.station_id == CameraStation.id)
            .outerjoin(Image, TigerSighting.image_id == Image.id)
            .filter(TigerSighting.tiger_id == t.id)
            .filter(TigerSighting.latitude != None, TigerSighting.longitude != None)
            .order_by(TigerSighting.captured_at.asc())
            .all()
        )
        
        points = []
        for s, st, img in sightings:
            points.append({
                "sighting_id": s.id,
                "latitude": s.latitude,
                "longitude": s.longitude,
                "captured_at": s.captured_at.isoformat() if s.captured_at else None,
                "timestamp_formatted": s.captured_at.strftime("%d %b %Y, %I:%M %p") if s.captured_at else "N/A",
                "camera_code": st.code if st else "CAM001",
                "confidence": s.confidence,
                "confidence_pct": f"{int(round(s.confidence * 100))}%",
                "image_id": img.id if img else None,
                "thumbnail_url": f"/api/v1/images/{img.id}/thumbnail" if img else None,
                "image_url": f"/api/v1/images/{img.id}/file" if img else None,
                "behavior": s.behavior or "-",
                "location_name": s.location_name or (st.name if st else "Field Location")
            })
            
        can_calculate_range = len(points) >= 3
        hull_coords = []
        if can_calculate_range:
            coords = [[p["longitude"], p["latitude"]] for p in points]
            hull_coords = coords + [coords[0]]

        tracks.append({
            "tiger_id": t.id,
            "tiger_code": t.tiger_code,
            "callsign": t.callsign,
            "sex": t.sex,
            "sightings_count": len(points),
            "points": points,
            "can_calculate_range": can_calculate_range,
            "range_message": "Observed range calculated from GPS sightings." if can_calculate_range else "Insufficient detections to calculate reliable tiger range.",
            "hull_polygon": hull_coords if can_calculate_range else []
        })
        
    return tracks

@router.get("/benchmark")
def run_live_benchmark(iterations: int = 30):
    from app.ml.benchmark import ai_benchmark
    return ai_benchmark.run_benchmark(iterations=iterations)

@router.get("/recent-detections")
def get_recent_detections(limit: int = 100, db: Session = Depends(get_db)):
    sightings = (
        db.query(TigerSighting, Tiger, CameraStation, Image)
        .outerjoin(Tiger, TigerSighting.tiger_id == Tiger.id)
        .outerjoin(CameraStation, TigerSighting.station_id == CameraStation.id)
        .outerjoin(Image, TigerSighting.image_id == Image.id)
        .order_by(TigerSighting.captured_at.desc(), TigerSighting.created_at.desc())
        .limit(limit)
        .all()
    )
    results = []
    for s, t, st, img in sightings:
        results.append({
            "id": s.id,
            "image_id": img.id if img else None,
            "image_filename": img.filename if img else "capture.jpg",
            "tiger_id": t.tiger_code if t else "Tiger",
            "tiger_uuid": t.id if t else None,
            "callsign": t.callsign if t else "Identified Tiger",
            "animal": "Tiger",
            "camera_id": st.code if st else "CAM001",
            "station_code": st.code if st else "CAM001",
            "station_name": st.name if st else "Station",
            "zone": st.zone if st else "Core",
            "captured_at": s.captured_at.isoformat() if s.captured_at else None,
            "timestamp": s.captured_at.isoformat() if s.captured_at else None,
            "timestamp_formatted": s.captured_at.strftime("%d %b %Y, %I:%M %p") if s.captured_at else "N/A",
            "confidence": s.confidence,
            "confidence_pct": f"{int(round(s.confidence * 100))}%" if s.confidence else "95%",
            "thumbnail_url": f"/api/v1/images/{img.id}/thumbnail" if img else None,
            "image_url": f"/api/v1/images/{img.id}/file" if img else None,
            "latitude": s.latitude,
            "longitude": s.longitude,
            "behavior": s.behavior or "-",
            "notes": s.notes
        })
    return results
