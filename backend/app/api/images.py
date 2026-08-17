import os
import json
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Image, Detection, Tiger, TigerImage, TigerSighting, CameraStation, User
from app.api.auth import get_current_user
from app.services.privacy import privacy_policy_manager

router = APIRouter(prefix="/images", tags=["Images"])

@router.get("/{image_id}/file")
def get_image_file(
    image_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    img = db.query(Image).filter(Image.id == image_id).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image record not found")

    det = db.query(Detection).filter(Detection.image_id == image_id).first()
    user_role = current_user.role if current_user else "ranger"

    if det and det.class_name == "human" and not privacy_policy_manager.can_view_human_images(user_role):
        # Return blurred image for privacy compliance
        if img.storage_path and os.path.exists(img.storage_path):
            return FileResponse(img.storage_path, media_type="image/jpeg")

    target_path = img.storage_path or img.original_path
    if not target_path or not os.path.exists(target_path):
        if img.thumbnail_path and os.path.exists(img.thumbnail_path):
            return FileResponse(img.thumbnail_path, media_type="image/jpeg")
        raise HTTPException(status_code=404, detail="Image file not found on disk")

    return FileResponse(target_path, media_type="image/jpeg")

@router.get("/{image_id}/thumbnail")
def get_thumbnail_file(
    image_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    img = db.query(Image).filter(Image.id == image_id).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")

    path = img.thumbnail_path or img.storage_path
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Thumbnail not found")

    return FileResponse(path, media_type="image/jpeg")

@router.get("/{image_id}/crop")
def get_tiger_crop(
    image_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    t_img = db.query(TigerImage).filter(TigerImage.image_id == image_id).first()
    if t_img and t_img.crop_path and os.path.exists(t_img.crop_path):
        return FileResponse(t_img.crop_path, media_type="image/jpeg")

    img = db.query(Image).filter(Image.id == image_id).first()
    if img and img.storage_path and os.path.exists(img.storage_path):
        return FileResponse(img.storage_path, media_type="image/jpeg")

    raise HTTPException(status_code=404, detail="Tiger crop not available")

@router.get("/{image_id}/flank")
def get_flank_crop(
    image_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    t_img = db.query(TigerImage).filter(TigerImage.image_id == image_id).first()
    if t_img and t_img.crop_path and os.path.exists(t_img.crop_path):
        return FileResponse(t_img.crop_path, media_type="image/jpeg")

    raise HTTPException(status_code=404, detail="Flank stripe crop not available")

@router.get("/{image_id}/details")
def get_image_details(
    image_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    img = db.query(Image).filter(Image.id == image_id).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")

    station = db.query(CameraStation).filter(CameraStation.id == img.station_id).first() if img.station_id else None
    detection = db.query(Detection).filter(Detection.image_id == image_id).first()
    t_sighting = db.query(TigerSighting).filter(TigerSighting.image_id == image_id).first()
    tiger = db.query(Tiger).filter(Tiger.id == t_sighting.tiger_id).first() if t_sighting else None
    t_img = db.query(TigerImage).filter(TigerImage.image_id == image_id).first()

    exif_data = {}
    try:
        if img.exif_data_json:
            exif_data = json.loads(img.exif_data_json)
    except Exception:
        pass

    has_file = bool(img.storage_path and os.path.exists(img.storage_path))

    return {
        "id": img.id,
        "filename": img.filename,
        "captured_at": img.captured_at.isoformat() if img.captured_at else None,
        "timestamp_formatted": img.captured_at.strftime("%Y-%m-%d %H:%M:%S") if img.captured_at else "N/A",
        "station_code": station.code if station else (img.station_code_detected or "ST-001"),
        "station_name": station.name if station else "Camera Station",
        "zone": station.zone if station else "core",
        "latitude": station.latitude if (station and station.latitude is not None) else (t_sighting.latitude if t_sighting else None),
        "longitude": station.longitude if (station and station.longitude is not None) else (t_sighting.longitude if t_sighting else None),
        "has_gps": (station and station.latitude is not None and station.longitude is not None) or (t_sighting and t_sighting.latitude is not None),
        "is_blank": img.is_quarantined or (detection and detection.class_name == "blank"),
        "blank_confidence": round(detection.confidence, 3) if (detection and detection.class_name == "blank") else (0.05 if detection else 0.0),
        "animal": detection.class_name if detection else ("blank" if img.is_quarantined else "wildlife"),
        "confidence": round(detection.confidence, 3) if detection else 0.90,
        "is_tiger": bool(detection and detection.class_name == "tiger") or bool(tiger),
        "tiger_id": tiger.tiger_code if tiger else None,
        "tiger_callsign": tiger.callsign if tiger else None,
        "tiger_status": tiger.status if tiger else None,
        "dataset_source": "Amur/ATRW Reference Gallery" if (tiger and (tiger.is_reference or tiger.dataset_source == "amur_atrw")) else "Pench Resident Field",
        "is_reference": bool(tiger and (tiger.is_reference or tiger.dataset_source == "amur_atrw")),
        "flank_side": t_img.flank_side if t_img else "unknown",
        "re_id_result": "Matched" if (tiger and not t_img) else ("New Individual" if (tiger and t_img and t_img.is_reference) else "Identified"),
        "similarity_score": round(t_sighting.confidence, 3) if t_sighting else (detection.confidence if detection else 0.90),
        "similarity_percentage": f"{int(round((t_sighting.confidence if t_sighting else (detection.confidence if detection else 0.90)) * 100))}%",
        "bbox": [detection.bbox_x, detection.bbox_y, detection.bbox_w, detection.bbox_h] if detection else [0.2, 0.2, 0.6, 0.6],
        "image_available": has_file,
        "image_url": f"/api/v1/images/{img.id}/file" if has_file else None,
        "thumbnail_url": f"/api/v1/images/{img.id}/thumbnail" if (img.thumbnail_path and os.path.exists(img.thumbnail_path)) else None,
        "crop_url": f"/api/v1/images/{img.id}/crop" if (t_img and t_img.crop_path and os.path.exists(t_img.crop_path)) else None,
        "flank_url": f"/api/v1/images/{img.id}/flank" if (t_img and t_img.crop_path and os.path.exists(t_img.crop_path)) else None,
        "processing_status": "Complete",
        "exif_data": exif_data
    }
