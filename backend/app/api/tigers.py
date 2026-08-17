import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import (
    Tiger, TigerImage, TigerSighting, CameraStation, OccupancyResult, AuditLog
)
from app.api.auth import get_current_user
from app.services.occupancy import occupancy_engine

router = APIRouter(prefix="/tigers", tags=["Tigers Catalogue"])

class TigerUpdateRequest(BaseModel):
    callsign: Optional[str] = None
    sex: Optional[str] = None
    age_class: Optional[str] = None
    status: Optional[str] = None
    primary_zone: Optional[str] = None
    notes: Optional[str] = None

@router.get("")
def list_tigers(
    status: Optional[str] = None,
    zone: Optional[str] = None,
    source: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Tiger)
    if status:
        query = query.filter(Tiger.status == status)
    if zone:
        query = query.filter(Tiger.primary_zone.ilike(f"%{zone}%"))
    if source and source != "all":
        if source == "reference":
            query = query.filter((Tiger.is_reference == True) | (Tiger.dataset_source == "amur_atrw"))
        elif source == "pench":
            query = query.filter((Tiger.is_reference == False) & (Tiger.dataset_source == "pench_field"))
        else:
            query = query.filter(Tiger.dataset_source == source)
    if search:
        query = query.filter(
            (Tiger.tiger_code.ilike(f"%{search}%")) |
            (Tiger.callsign.ilike(f"%{search}%"))
        )

    tigers = query.order_by(Tiger.last_seen.desc()).all()
    results = []
    for t in tigers:
        ref_image = (
            db.query(TigerImage)
            .filter(TigerImage.tiger_id == t.id)
            .order_by(TigerImage.is_reference.desc(), TigerImage.created_at.desc())
            .first()
        )
        sightings_count = db.query(TigerSighting).filter(TigerSighting.tiger_id == t.id).count()
        is_ref = bool(t.is_reference or t.dataset_source == "amur_atrw")
        
        results.append({
            "id": t.id,
            "tiger_code": t.tiger_code,
            "callsign": t.callsign,
            "sex": t.sex,
            "age_class": t.age_class,
            "status": t.status,
            "primary_zone": t.primary_zone,
            "dataset_source": "Amur/ATRW Reference Gallery" if is_ref else "Pench Resident Catalogue",
            "source_type": "amur_atrw" if is_ref else "pench_field",
            "is_reference": is_ref,
            "first_seen": t.first_seen.isoformat() if t.first_seen else None,
            "last_seen": t.last_seen.isoformat() if t.last_seen else None,
            "confidence": t.confidence,
            "territory_area_km2": t.territory_area_km2,
            "centroid": {"lat": t.centroid_lat, "lon": t.centroid_lon} if t.centroid_lat else None,
            "sightings_count": sightings_count,
            "reference_thumbnail": f"/api/v1/images/{ref_image.image_id}/thumbnail" if ref_image else None,
            "reference_crop": f"/api/v1/images/{ref_image.image_id}/flank" if ref_image else None,
            "notes": t.notes
        })

    return results

@router.get("/{tiger_id}")
def get_tiger_profile(tiger_id: str, db: Session = Depends(get_db)):
    tiger = db.query(Tiger).filter(Tiger.id == tiger_id).first()
    if not tiger:
        raise HTTPException(status_code=404, detail="Tiger profile not found")

    images = (
        db.query(TigerImage)
        .filter(TigerImage.tiger_id == tiger.id)
        .order_by(TigerImage.created_at.desc())
        .all()
    )

    sightings = (
        db.query(TigerSighting, CameraStation)
        .join(CameraStation, TigerSighting.station_id == CameraStation.id)
        .filter(TigerSighting.tiger_id == tiger.id)
        .order_by(TigerSighting.captured_at.desc())
        .all()
    )

    occ = (
        db.query(OccupancyResult)
        .filter(OccupancyResult.tiger_id == tiger.id)
        .order_by(OccupancyResult.calculation_date.desc())
        .first()
    )

    gallery = []
    for img in images:
        gallery.append({
            "id": img.id,
            "image_id": img.image_id,
            "flank_side": img.flank_side,
            "quality_score": img.quality_score,
            "is_reference": img.is_reference,
            "crop_url": f"/api/v1/images/{img.image_id}/file",
            "thumbnail_url": f"/api/v1/images/{img.image_id}/thumbnail",
            "created_at": img.created_at.isoformat() if img.created_at else None
        })

    sightings_timeline = []
    for s, st in sightings:
        sightings_timeline.append({
            "id": s.id,
            "image_id": s.image_id,
            "station_code": st.code,
            "station_name": st.name,
            "zone": st.zone,
            "latitude": s.latitude,
            "longitude": s.longitude,
            "captured_at": s.captured_at.isoformat() if s.captured_at else None,
            "confidence": s.confidence,
            "is_verified": s.is_verified,
            "thumbnail_url": f"/api/v1/images/{s.image_id}/thumbnail",
            "notes": s.notes
        })

    return {
        "id": tiger.id,
        "tiger_code": tiger.tiger_code,
        "callsign": tiger.callsign,
        "sex": tiger.sex,
        "age_class": tiger.age_class,
        "status": tiger.status,
        "primary_zone": tiger.primary_zone,
        "first_seen": tiger.first_seen.isoformat() if tiger.first_seen else None,
        "last_seen": tiger.last_seen.isoformat() if tiger.last_seen else None,
        "confidence": tiger.confidence,
        "territory_area_km2": tiger.territory_area_km2,
        "centroid": {"lat": tiger.centroid_lat, "lon": tiger.centroid_lon} if tiger.centroid_lat else None,
        "notes": tiger.notes,
        "gallery": gallery,
        "sightings_timeline": sightings_timeline,
        "occupancy_polygon": json.loads(occ.polygon_geojson) if occ and occ.polygon_geojson else None
    }

@router.put("/{tiger_id}")
def update_tiger_profile(
    tiger_id: str,
    req: TigerUpdateRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    tiger = db.query(Tiger).filter(Tiger.id == tiger_id).first()
    if not tiger:
        raise HTTPException(status_code=404, detail="Tiger not found")

    old_vals = {
        "callsign": tiger.callsign,
        "status": tiger.status,
        "primary_zone": tiger.primary_zone
    }

    if req.callsign is not None:
        tiger.callsign = req.callsign
    if req.sex is not None:
        tiger.sex = req.sex
    if req.age_class is not None:
        tiger.age_class = req.age_class
    if req.status is not None:
        tiger.status = req.status
    if req.primary_zone is not None:
        tiger.primary_zone = req.primary_zone
    if req.notes is not None:
        tiger.notes = req.notes

    audit = AuditLog(
        actor_id=current_user.full_name if current_user else "Biologist",
        actor_role=current_user.role if current_user else "biologist",
        action="tiger_profile_updated",
        entity_type="tiger",
        entity_id=tiger.id,
        details_json=json.dumps({"old": old_vals, "new": req.dict(exclude_none=True)})
    )
    db.add(audit)
    db.commit()

    return {"status": "success", "tiger_code": tiger.tiger_code, "callsign": tiger.callsign}
