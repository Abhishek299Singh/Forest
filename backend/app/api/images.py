import os
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Image, Detection, User
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
    user_role = current_user.role if current_user else "forest_staff"

    if det and det.class_name == "human" and not privacy_policy_manager.can_view_human_images(user_role):
        # Return blurred image
        if img.storage_path and os.path.exists(img.storage_path):
            return FileResponse(img.storage_path, media_type="image/jpeg")

    target_path = img.storage_path or img.original_path
    if not target_path or not os.path.exists(target_path):
        # Fallback to thumbnail or placeholder if raw path unmounted
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
