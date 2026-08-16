import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.db.models import AuditLog

class AuditLogger:
    @staticmethod
    def log(
        db: Session,
        actor_id: str,
        actor_role: str,
        action: str,
        entity_type: str,
        entity_id: str,
        details: Optional[Dict[str, Any]] = None
    ) -> AuditLog:
        entry = AuditLog(
            actor_id=actor_id,
            actor_role=actor_role,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details_json=json.dumps(details or {}),
            created_at=datetime.now(timezone.utc)
        )
        db.add(entry)
        db.commit()
        return entry

audit_logger = AuditLogger()
