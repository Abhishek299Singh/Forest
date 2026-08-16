import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Alert, Tiger, CameraStation, TigerImage, AuditLog
from app.api.auth import get_current_user
from app.services.movement_alert import movement_alert_engine

router = APIRouter(prefix="/alerts", tags=["Movement & Ecological Alerts"])

class AlertStatusUpdateRequest(BaseModel):
    status: str  # "active", "investigating", "acknowledged", "resolved", "dismissed"
    assigned_to: Optional[str] = None
    resolution_notes: Optional[str] = None

@router.get("")
def list_alerts(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    tiger_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = (
        db.query(Alert, Tiger, CameraStation)
        .outerjoin(Tiger, Alert.tiger_id == Tiger.id)
        .outerjoin(CameraStation, Alert.station_id == CameraStation.id)
    )
    if status:
        query = query.filter(Alert.status == status)
    if severity:
        query = query.filter(Alert.severity == severity)
    if tiger_id:
        query = query.filter(Alert.tiger_id == tiger_id)

    alerts = query.order_by(Alert.created_at.desc()).all()
    results = []

    for al, t, st in alerts:
        explanation = json.loads(al.explanation_json) if al.explanation_json else {}
        
        # Get tiger thumbnail
        t_img = None
        if t:
            t_img = db.query(TigerImage).filter(TigerImage.tiger_id == t.id).first()

        results.append({
            "id": al.id,
            "tiger_id": al.tiger_id,
            "tiger_code": t.tiger_code if t else "N/A",
            "callsign": t.callsign if t else "Unknown Individual",
            "station_code": st.code if st else "N/A",
            "station_name": st.name if st else "N/A",
            "zone": st.zone if st else (t.primary_zone if t else "Core"),
            "alert_type": al.alert_type,
            "severity": al.severity,
            "confidence": al.confidence,
            "status": al.status,
            "assigned_to": al.assigned_to,
            "resolution_notes": al.resolution_notes,
            "created_at": al.created_at.isoformat() if al.created_at else None,
            "explanation": explanation,
            "thumbnail_url": f"/api/v1/images/{t_img.image_id}/thumbnail" if t_img else None
        })

    return results

@router.put("/{alert_id}/status")
def update_alert_status(
    alert_id: str,
    req: AlertStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    old_status = alert.status
    alert.status = req.status
    if req.assigned_to:
        alert.assigned_to = req.assigned_to
    if req.resolution_notes:
        alert.resolution_notes = req.resolution_notes

    audit = AuditLog(
        actor_id=current_user.full_name if current_user else "Forest Staff",
        actor_role=current_user.role if current_user else "forest_staff",
        action="alert_status_updated",
        entity_type="alert",
        entity_id=alert.id,
        details_json=json.dumps({"old_status": old_status, "new_status": req.status, "notes": req.resolution_notes})
    )
    db.add(audit)
    db.commit()

    return {"status": "success", "alert_id": alert.id, "current_status": alert.status}

@router.post("/scan-absences")
def scan_prolonged_absences(db: Session = Depends(get_db)):
    alerts = movement_alert_engine.evaluate_prolonged_absence(db)
    return {"status": "success", "new_alerts_count": len(alerts)}
