import math
import json
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.db.models import (
    Tiger, TigerSighting, CameraStation, SurveyEffort, Alert, CameraDeployment, AuditLog
)
from app.core.config import settings
from app.core.events import event_bus

class MovementAlertEngine:
    """
    Survey-effort normalized movement deviation intelligence engine.
    Evaluates ecological changes and detects:
    - Territory Centroid Shift
    - Core to Buffer Zone Incursion
    - Village-adjacent station proximity
    - New Station colonization
    - Prolonged Absence
    """

    def haversine_distance_km(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        R = 6371.0  # Earth radius in km
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (
            math.sin(dlat / 2.0) ** 2
            + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2
        )
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return round(R * c, 2)

    def check_survey_effort_context(self, db: Session, station_id: str, sighting_date: datetime) -> Dict[str, Any]:
        """
        Determines whether the sighting at this station is explained by new camera effort.
        """
        deployment = (
            db.query(CameraDeployment)
            .filter(CameraDeployment.station_id == station_id)
            .order_by(CameraDeployment.install_date.desc())
            .first()
        )
        
        survey = (
            db.query(SurveyEffort)
            .filter(SurveyEffort.station_id == station_id)
            .order_by(SurveyEffort.created_at.desc())
            .first()
        )

        days_deployed = 365
        is_recent_deployment = False

        if deployment and deployment.install_date:
            days_deployed = (sighting_date - deployment.install_date).days
            if days_deployed < settings.SURVEY_EFFORT_MIN_DAYS:
                is_recent_deployment = True

        return {
            "is_recent_deployment": is_recent_deployment,
            "days_since_install": max(0, days_deployed),
            "active_trap_nights": survey.active_trap_nights if survey else 30,
            "operational_days": survey.operational_days if survey else 30,
            "effort_status": "Recently Deployed (<14 days)" if is_recent_deployment else "Established Camera Station"
        }

    async def evaluate_sighting_alerts(self, db: Session, sighting: TigerSighting) -> List[Alert]:
        tiger = db.query(Tiger).filter(Tiger.id == sighting.tiger_id).first()
        station = db.query(CameraStation).filter(CameraStation.id == sighting.station_id).first()
        if not tiger or not station:
            return []

        alerts_created = []
        effort_info = self.check_survey_effort_context(db, station.id, sighting.captured_at)

        # 1. Check Buffer Incursion (Core tiger detected in buffer)
        if "core" in tiger.primary_zone.lower() and station.zone.lower() == "buffer":
            severity = "HIGH"
            explanation = {
                "what_changed": f"Tiger {tiger.callsign} ({tiger.tiger_code}) detected at Buffer Station {station.code} ({station.name}).",
                "why_it_matters": "Resident Core individual has crossed management boundary into the multi-use Buffer Zone.",
                "supporting_evidence": f"Previous territory centered in Core at ({round(tiger.centroid_lat or 0, 4)}, {round(tiger.centroid_lon or 0, 4)}). New sighting at {station.name}.",
                "survey_effort": effort_info["effort_status"],
                "is_effort_artifact": effort_info["is_recent_deployment"],
                "confidence": 0.94,
                "location": f"Station {station.code} ({station.range_beat})"
            }

            alert = Alert(
                tiger_id=tiger.id,
                station_id=station.id,
                alert_type="buffer_movement",
                severity=severity,
                confidence=0.94,
                explanation_json=json.dumps(explanation),
                status="active"
            )
            db.add(alert)
            db.flush()
            alerts_created.append(alert)

        # 2. Check Village Proximity / Human Interface
        if station.is_village_adjacent:
            village_name = station.adjacent_village_name or "Settlement Edge"
            severity = "CRITICAL"
            explanation = {
                "what_changed": f"Individual {tiger.callsign} detected at village-fringe station {station.code} adjacent to {village_name}.",
                "why_it_matters": "Heightened human-tiger interface risk requiring active patrol mobilization and village awareness notification.",
                "supporting_evidence": f"Station {station.code} is situated within {settings.VILLAGE_PROXIMITY_THRESHOLD_KM} km of {village_name} agricultural boundary.",
                "survey_effort": effort_info["effort_status"],
                "is_effort_artifact": False,
                "confidence": 0.96,
                "location": f"{village_name} Fringe ({station.code})"
            }

            alert = Alert(
                tiger_id=tiger.id,
                station_id=station.id,
                alert_type="village_incursion",
                severity=severity,
                confidence=0.96,
                explanation_json=json.dumps(explanation),
                status="active"
            )
            db.add(alert)
            db.flush()
            alerts_created.append(alert)

        # 3. Check Centroid Shift / Distance from territory center
        if tiger.centroid_lat and tiger.centroid_lon:
            dist_km = self.haversine_distance_km(tiger.centroid_lat, tiger.centroid_lon, station.latitude, station.longitude)
            if dist_km >= settings.CENTROID_SHIFT_THRESHOLD_KM:
                severity = "HIGH" if dist_km > 6.0 else "MEDIUM"
                explanation = {
                    "what_changed": f"Territory centroid shift of {dist_km} km detected for {tiger.callsign}.",
                    "why_it_matters": f"Exceeds reserve territory deviation threshold of {settings.CENTROID_SHIFT_THRESHOLD_KM} km, indicating potential range expansion or displacement.",
                    "supporting_evidence": f"Centroid: ({round(tiger.centroid_lat, 4)}, {round(tiger.centroid_lon, 4)}) -> Sighting at ({station.latitude}, {station.longitude}). Distance: {dist_km} km.",
                    "survey_effort": effort_info["effort_status"],
                    "is_effort_artifact": effort_info["is_recent_deployment"],
                    "confidence": 0.90,
                    "location": f"Station {station.code} ({station.range_beat})"
                }

                alert = Alert(
                    tiger_id=tiger.id,
                    station_id=station.id,
                    alert_type="centroid_shift",
                    severity=severity,
                    confidence=0.90,
                    explanation_json=json.dumps(explanation),
                    status="active"
                )
                db.add(alert)
                db.flush()
                alerts_created.append(alert)

        if alerts_created:
            db.commit()
            for al in alerts_created:
                await event_bus.broadcast("new_alert", {
                    "alert_id": al.id,
                    "tiger_code": tiger.tiger_code,
                    "callsign": tiger.callsign,
                    "alert_type": al.alert_type,
                    "severity": al.severity,
                    "station_code": station.code,
                    "created_at": al.created_at.isoformat()
                })

        return alerts_created

    def evaluate_prolonged_absence(self, db: Session) -> List[Alert]:
        """Scans resident tigers for absence > 45 days."""
        now = datetime.now(timezone.utc)
        threshold_date = now - timedelta(days=settings.PROLONGED_ABSENCE_DAYS)
        
        absent_tigers = (
            db.query(Tiger)
            .filter(Tiger.status == "resident")
            .filter(Tiger.last_seen < threshold_date)
            .all()
        )

        alerts = []
        for t in absent_tigers:
            days_absent = (now - t.last_seen).days if t.last_seen else 999
            
            # Check if active alert already exists
            existing = (
                db.query(Alert)
                .filter(Alert.tiger_id == t.id)
                .filter(Alert.alert_type == "prolonged_absence")
                .filter(Alert.status == "active")
                .first()
            )
            if existing:
                continue

            explanation = {
                "what_changed": f"Resident tiger {t.callsign} ({t.tiger_code}) not captured for {days_absent} consecutive days.",
                "why_it_matters": f"Exceeds maximum resident observation gap threshold of {settings.PROLONGED_ABSENCE_DAYS} days.",
                "supporting_evidence": f"Last seen on {t.last_seen.strftime('%Y-%m-%d')} in {t.primary_zone}.",
                "survey_effort": "Regular ongoing camera trap grid",
                "is_effort_artifact": False,
                "confidence": 0.88,
                "location": t.primary_zone
            }

            al = Alert(
                tiger_id=t.id,
                alert_type="prolonged_absence",
                severity="MEDIUM",
                confidence=0.88,
                explanation_json=json.dumps(explanation),
                status="active"
            )
            db.add(al)
            alerts.append(al)

        if alerts:
            db.commit()
        return alerts

movement_alert_engine = MovementAlertEngine()
