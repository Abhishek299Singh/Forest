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
    - Territory Centroid Shift (>4.5 km core, >5.0 km buffer)
    - Core to Buffer Zone Incursion
    - Village-adjacent station proximity (<=1.5 km)
    - First-time station colonization
    - Prolonged Absence (>45 days)
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
            if days_deployed < settings.SURVEY_EFFORT_BASELINE_DAYS:
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

        # Historical stations for this tiger
        prior_sightings = (
            db.query(TigerSighting, CameraStation)
            .join(CameraStation, TigerSighting.station_id == CameraStation.id)
            .filter(TigerSighting.tiger_id == tiger.id)
            .filter(TigerSighting.id != sighting.id)
            .all()
        )
        prior_station_codes = list(set([st.code for _, st in prior_sightings]))
        is_first_time_station = station.code not in prior_station_codes and len(prior_station_codes) > 0

        # Calculate distance to historical centroid
        dist_from_centroid = 0.0
        if tiger.centroid_lat and tiger.centroid_lon:
            dist_from_centroid = self.haversine_distance_km(
                tiger.centroid_lat, tiger.centroid_lon, station.latitude, station.longitude
            )

        # 1. Check Buffer Incursion (Core resident detected in buffer zone)
        if "core" in tiger.primary_zone.lower() and station.zone.lower() == "buffer":
            severity = "HIGH"
            previous_summary = ", ".join(prior_station_codes[:4]) if prior_station_codes else "None (Baseline)"
            explanation = {
                "what_changed": f"Tiger {tiger.callsign} ({tiger.tiger_code}) detected at Buffer Station {station.code} ({station.name}).",
                "why_it_matters": "Resident Core individual has crossed management boundary into the multi-use Buffer Zone.",
                "supporting_evidence": f"Previous stations: {previous_summary}. Current: {station.code}. Distance from centroid: {dist_from_centroid} km. Active trap-nights: {effort_info['active_trap_nights']}.",
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

        # 2. Check Village Proximity / Human Interface (<= 1.5 km)
        if station.is_village_adjacent:
            village_name = station.adjacent_village_name or "Settlement Edge"
            severity = "CRITICAL"
            explanation = {
                "what_changed": f"Individual {tiger.callsign} ({tiger.tiger_code}) detected at village-fringe station {station.code} adjacent to {village_name}.",
                "why_it_matters": f"Station is situated within {settings.VILLAGE_PROXIMITY_THRESHOLD_KM} km of {village_name} boundary. Immediate patrol deployment recommended to prevent livestock conflict.",
                "supporting_evidence": f"Consecutive sighting at {station.code} ({station.latitude:.4f}, {station.longitude:.4f}). Distance from centroid: {dist_from_centroid} km. Active trap-nights: {effort_info['active_trap_nights']}.",
                "survey_effort": effort_info["effort_status"],
                "is_effort_artifact": False,
                "confidence": 0.97,
                "location": f"{village_name} Fringe ({station.code})"
            }

            alert = Alert(
                tiger_id=tiger.id,
                station_id=station.id,
                alert_type="village_incursion",
                severity=severity,
                confidence=0.97,
                explanation_json=json.dumps(explanation),
                status="active"
            )
            db.add(alert)
            db.flush()
            alerts_created.append(alert)

        # 3. Check Centroid Shift (>4.5 km core or >5.0 km buffer)
        threshold_dist = settings.BUFFER_MOVEMENT_THRESHOLD_KM if station.zone.lower() == "buffer" else settings.CORE_CENTROID_SHIFT_THRESHOLD_KM
        if dist_from_centroid >= threshold_dist:
            severity = "HIGH" if dist_from_centroid > 6.0 else "MEDIUM"
            previous_summary = ", ".join(prior_station_codes[:4]) if prior_station_codes else "Baseline Centroid"
            explanation = {
                "what_changed": f"Territory centroid shift of {dist_from_centroid} km detected for {tiger.callsign} ({tiger.tiger_code}).",
                "why_it_matters": f"Exceeds territory deviation threshold of {threshold_dist} km ({station.zone.upper()} zone), indicating potential range expansion or displacement.",
                "supporting_evidence": f"Historical centroid: ({round(tiger.centroid_lat or 0, 4)}, {round(tiger.centroid_lon or 0, 4)}). Current station: {station.code} ({station.name}). Previous stations: {previous_summary}.",
                "survey_effort": effort_info["effort_status"],
                "is_effort_artifact": effort_info["is_recent_deployment"],
                "confidence": 0.91,
                "location": f"Station {station.code} ({station.range_beat})"
            }

            alert = Alert(
                tiger_id=tiger.id,
                station_id=station.id,
                alert_type="centroid_shift",
                severity=severity,
                confidence=0.91,
                explanation_json=json.dumps(explanation),
                status="active"
            )
            db.add(alert)
            db.flush()
            alerts_created.append(alert)

        # 4. First-Time Station Colonization
        if is_first_time_station and not any(a.alert_type in ["buffer_movement", "village_incursion"] for a in alerts_created):
            explanation = {
                "what_changed": f"Tiger {tiger.callsign} ({tiger.tiger_code}) captured at Station {station.code} for the first time.",
                "why_it_matters": f"First documented occurrence at {station.name}. Expands known spatial range for this individual.",
                "supporting_evidence": f"Prior stations: {', '.join(prior_station_codes[:5])}. Current station: {station.code}. Distance from centroid: {dist_from_centroid} km. Active trap-nights: {effort_info['active_trap_nights']}.",
                "survey_effort": effort_info["effort_status"],
                "is_effort_artifact": effort_info["is_recent_deployment"],
                "confidence": 0.89,
                "location": f"Station {station.code} ({station.name})"
            }

            alert = Alert(
                tiger_id=tiger.id,
                station_id=station.id,
                alert_type="new_station",
                severity="LOW",
                confidence=0.89,
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
                "why_it_matters": f"Exceeds maximum resident observation gap threshold of {settings.PROLONGED_ABSENCE_DAYS} days (NTCA 45-day survey window).",
                "supporting_evidence": f"Last seen on {t.last_seen.strftime('%Y-%m-%d')} in {t.primary_zone}. Historical territory area: {t.territory_area_km2} km².",
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
