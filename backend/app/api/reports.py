import csv
import io
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Tiger, CameraStation, Alert, Image, SurveyEffort, AuditLog

router = APIRouter(prefix="/reports", tags=["Reports & Exports"])

@router.get("/tigers/csv")
def export_tigers_csv(db: Session = Depends(get_db)):
    tigers = db.query(Tiger).order_by(Tiger.tiger_code.asc()).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Tiger Code", "Callsign", "Sex", "Age Class", "Status",
        "Primary Zone", "Centroid Latitude", "Centroid Longitude",
        "Territory Area (km2)", "First Seen", "Last Seen", "Confidence", "Notes"
    ])
    for t in tigers:
        writer.writerow([
            t.tiger_code, t.callsign, t.sex, t.age_class, t.status,
            t.primary_zone, t.centroid_lat or "", t.centroid_lon or "",
            t.territory_area_km2,
            t.first_seen.strftime("%Y-%m-%d") if t.first_seen else "",
            t.last_seen.strftime("%Y-%m-%d") if t.last_seen else "",
            f"{int((t.confidence or 0.95)*100)}%", t.notes or ""
        ])

    output.seek(0)
    filename = f"pench_tiger_catalogue_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/alerts/csv")
def export_alerts_csv(db: Session = Depends(get_db)):
    alerts = (
        db.query(Alert, Tiger, CameraStation)
        .outerjoin(Tiger, Alert.tiger_id == Tiger.id)
        .outerjoin(CameraStation, Alert.station_id == CameraStation.id)
        .order_by(Alert.created_at.desc())
        .all()
    )
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Alert ID", "Timestamp", "Tiger Code", "Tiger Callsign",
        "Station Code", "Station Name", "Zone", "Alert Type",
        "Severity", "Confidence", "Status", "Resolution Notes"
    ])
    for al, t, st in alerts:
        writer.writerow([
            al.id, al.created_at.strftime("%Y-%m-%d %H:%M:%S") if al.created_at else "",
            t.tiger_code if t else "N/A", t.callsign if t else "N/A",
            st.code if st else "N/A", st.name if st else "N/A",
            st.zone if st else "N/A", al.alert_type,
            al.severity, f"{int((al.confidence or 0.9)*100)}%",
            al.status, al.resolution_notes or ""
        ])

    output.seek(0)
    filename = f"pench_movement_alerts_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/survey-effort/csv")
def export_survey_effort_csv(db: Session = Depends(get_db)):
    efforts = (
        db.query(SurveyEffort, CameraStation)
        .join(CameraStation, SurveyEffort.station_id == CameraStation.id)
        .order_by(CameraStation.code.asc())
        .all()
    )
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Station Code", "Station Name", "Zone", "Range Beat",
        "Latitude", "Longitude", "Year", "Season",
        "Active Trap Nights", "Operational Days", "Downtime Days"
    ])
    for eff, st in efforts:
        writer.writerow([
            st.code, st.name, st.zone, st.range_beat,
            st.latitude, st.longitude, eff.year, eff.season,
            eff.active_trap_nights, eff.operational_days, eff.downtime_days
        ])

    output.seek(0)
    filename = f"pench_survey_effort_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
