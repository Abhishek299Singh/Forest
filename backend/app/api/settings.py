import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import get_db
from app.db.models import AuditLog
from app.api.auth import get_current_user

router = APIRouter(prefix="/settings", tags=["Configuration & Thresholds"])

class PolicyUpdateRequest(BaseModel):
    blank_confidence_threshold: Optional[float] = None
    tiger_auto_match_threshold: Optional[float] = None
    tiger_ambiguous_lower_threshold: Optional[float] = None
    core_centroid_shift_threshold_km: Optional[float] = None
    buffer_movement_threshold_km: Optional[float] = None
    village_proximity_threshold_km: Optional[float] = None
    min_observations_for_mcp: Optional[int] = None
    prolonged_absence_days: Optional[int] = None
    survey_effort_baseline_days: Optional[int] = None

@router.get("/policies")
def get_policies():
    """
    Returns the centralized configuration and threshold policies for ML triage,
    stripe re-identification, home-range estimation, and spatial deviation alerts.
    """
    return {
        "blank_confidence_threshold": settings.BLANK_CONFIDENCE_THRESHOLD,
        "tiger_auto_match_threshold": settings.TIGER_AUTO_MATCH_THRESHOLD,
        "tiger_ambiguous_lower_threshold": settings.TIGER_AMBIGUOUS_LOWER_THRESHOLD,
        "core_centroid_shift_threshold_km": settings.CORE_CENTROID_SHIFT_THRESHOLD_KM,
        "buffer_movement_threshold_km": settings.BUFFER_MOVEMENT_THRESHOLD_KM,
        "village_proximity_threshold_km": settings.VILLAGE_PROXIMITY_THRESHOLD_KM,
        "min_observations_for_mcp": settings.MIN_OBSERVATIONS_FOR_MCP,
        "prolonged_absence_days": settings.PROLONGED_ABSENCE_DAYS,
        "survey_effort_baseline_days": settings.SURVEY_EFFORT_BASELINE_DAYS,
    }

@router.put("/policies")
def update_policies(
    req: PolicyUpdateRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Dynamically updates runtime policy parameters without requiring code edits or server rebuilds.
    Audited in local database ledger.
    """
    updated = {}

    if req.blank_confidence_threshold is not None:
        settings.BLANK_CONFIDENCE_THRESHOLD = req.blank_confidence_threshold
        updated["blank_confidence_threshold"] = req.blank_confidence_threshold

    if req.tiger_auto_match_threshold is not None:
        settings.TIGER_AUTO_MATCH_THRESHOLD = req.tiger_auto_match_threshold
        updated["tiger_auto_match_threshold"] = req.tiger_auto_match_threshold

    if req.tiger_ambiguous_lower_threshold is not None:
        settings.TIGER_AMBIGUOUS_LOWER_THRESHOLD = req.tiger_ambiguous_lower_threshold
        settings.TIGER_AMBIGUOUS_THRESHOLD = req.tiger_ambiguous_lower_threshold
        updated["tiger_ambiguous_lower_threshold"] = req.tiger_ambiguous_lower_threshold

    if req.core_centroid_shift_threshold_km is not None:
        settings.CORE_CENTROID_SHIFT_THRESHOLD_KM = req.core_centroid_shift_threshold_km
        settings.CENTROID_SHIFT_THRESHOLD_KM = req.core_centroid_shift_threshold_km
        updated["core_centroid_shift_threshold_km"] = req.core_centroid_shift_threshold_km

    if req.buffer_movement_threshold_km is not None:
        settings.BUFFER_MOVEMENT_THRESHOLD_KM = req.buffer_movement_threshold_km
        updated["buffer_movement_threshold_km"] = req.buffer_movement_threshold_km

    if req.village_proximity_threshold_km is not None:
        settings.VILLAGE_PROXIMITY_THRESHOLD_KM = req.village_proximity_threshold_km
        updated["village_proximity_threshold_km"] = req.village_proximity_threshold_km

    if req.min_observations_for_mcp is not None:
        settings.MIN_OBSERVATIONS_FOR_MCP = req.min_observations_for_mcp
        updated["min_observations_for_mcp"] = req.min_observations_for_mcp

    if req.prolonged_absence_days is not None:
        settings.PROLONGED_ABSENCE_DAYS = req.prolonged_absence_days
        updated["prolonged_absence_days"] = req.prolonged_absence_days

    if req.survey_effort_baseline_days is not None:
        settings.SURVEY_EFFORT_BASELINE_DAYS = req.survey_effort_baseline_days
        updated["survey_effort_baseline_days"] = req.survey_effort_baseline_days

    # Record in AuditLog
    actor = current_user.full_name if current_user else "Field Biologist"
    role = current_user.role if current_user else "admin"
    audit = AuditLog(
        actor_id=actor,
        actor_role=role,
        action="threshold_policies_updated",
        entity_type="configuration",
        entity_id="global_settings",
        details_json=json.dumps(updated)
    )
    db.add(audit)
    db.commit()

    return {
        "status": "success",
        "updated_policies": updated,
        "active_policies": get_policies()
    }
