import os
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import CameraStation, CameraDeployment, SurveyEffort, TigerSighting, Image
from app.api.auth import get_current_user

router = APIRouter(prefix="/stations", tags=["Camera Stations"])

class StationCreateRequest(BaseModel):
    code: str
    name: str
    latitude: float
    longitude: float
    zone: str = "core"
    range_beat: str = "Turia Range"
    habitat: str = "Dry Deciduous Forest"
    is_village_adjacent: bool = False
    adjacent_village_name: Optional[str] = None

@router.get("")
def list_stations(zone: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(CameraStation)
    if zone:
        query = query.filter(CameraStation.zone == zone)

    stations = query.order_by(CameraStation.code.asc()).all()
    results = []

    for st in stations:
        latest_deploy = (
            db.query(CameraDeployment)
            .filter(CameraDeployment.station_id == st.id)
            .order_by(CameraDeployment.created_at.desc())
            .first()
        )
        latest_effort = (
            db.query(SurveyEffort)
            .filter(SurveyEffort.station_id == st.id)
            .order_by(SurveyEffort.created_at.desc())
            .first()
        )
        sightings_count = db.query(TigerSighting).filter(TigerSighting.station_id == st.id).count()
        images_count = db.query(Image).filter(Image.station_id == st.id).count()
        
        latest_img = (
            db.query(Image)
            .filter(Image.station_id == st.id)
            .order_by(Image.captured_at.desc(), Image.created_at.desc())
            .first()
        )
        
        latest_image_data = None
        if latest_img:
            target_path = latest_img.thumbnail_path or latest_img.storage_path or latest_img.original_path
            if target_path and os.path.exists(target_path):
                from app.db.models import Detection
                det = db.query(Detection).filter(Detection.image_id == latest_img.id).first()
                latest_image_data = {
                    "id": latest_img.id,
                    "filename": latest_img.filename,
                    "thumbnail_url": f"/api/v1/images/{latest_img.id}/thumbnail",
                    "image_url": f"/api/v1/images/{latest_img.id}/file",
                    "captured_at": latest_img.captured_at.isoformat() if latest_img.captured_at else None,
                    "class_name": det.class_name if det else ("blank" if latest_img.is_quarantined else "wildlife"),
                    "confidence": det.confidence if det else 0.90,
                    "is_quarantined": latest_img.is_quarantined
                }

        results.append({
            "id": st.id,
            "code": st.code,
            "name": st.name,
            "latitude": st.latitude,
            "longitude": st.longitude,
            "zone": st.zone,
            "range_beat": st.range_beat,
            "habitat": st.habitat,
            "status": st.status,
            "is_village_adjacent": st.is_village_adjacent,
            "adjacent_village_name": st.adjacent_village_name,
            "battery_level": latest_deploy.battery_level if latest_deploy else 95,
            "active_trap_nights": latest_effort.active_trap_nights if latest_effort else 30,
            "operational_days": latest_effort.operational_days if latest_effort else 30,
            "downtime_days": latest_effort.downtime_days if latest_effort else 0,
            "sightings_count": sightings_count,
            "images_count": images_count,
            "latest_image": latest_image_data
        })

    return results

@router.get("/{station_id}")
def get_station_detail(station_id: str, db: Session = Depends(get_db)):
    st = db.query(CameraStation).filter(CameraStation.id == station_id).first()
    if not st:
        raise HTTPException(status_code=404, detail="Station not found")

    deployments = (
        db.query(CameraDeployment)
        .filter(CameraDeployment.station_id == st.id)
        .order_by(CameraDeployment.created_at.desc())
        .all()
    )

    efforts = (
        db.query(SurveyEffort)
        .filter(SurveyEffort.station_id == st.id)
        .order_by(SurveyEffort.created_at.desc())
        .all()
    )

    return {
        "id": st.id,
        "code": st.code,
        "name": st.name,
        "latitude": st.latitude,
        "longitude": st.longitude,
        "zone": st.zone,
        "range_beat": st.range_beat,
        "status": st.status,
        "is_village_adjacent": st.is_village_adjacent,
        "adjacent_village_name": st.adjacent_village_name,
        "deployments": [
            {
                "camera_serial": d.camera_serial,
                "camera_model": d.camera_model,
                "install_date": d.install_date.isoformat() if d.install_date else None,
                "battery_level": d.battery_level,
                "status": d.status
            }
            for d in deployments
        ],
        "efforts": [
            {
                "year": e.year,
                "season": e.season,
                "active_trap_nights": e.active_trap_nights,
                "operational_days": e.operational_days,
                "downtime_days": e.downtime_days
            }
            for e in efforts
        ]
    }
