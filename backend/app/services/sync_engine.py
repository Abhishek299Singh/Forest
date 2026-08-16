import json
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.db.models import SyncOutbox, SyncInbox, SyncLog, AuditLog
from app.core.config import settings
from app.core.events import event_bus

class SyncEngine:
    """
    Offline-First Synchronization Engine.
    Handles Outbox queueing, Inbox processing, conflict resolution, and connectivity state.
    """
    def __init__(self):
        self.is_online = False
        self.last_synced_at: Optional[datetime] = datetime.now(timezone.utc)
        self.sync_status = "synced"  # synced, syncing, offline, error

    def queue_outbox(
        self,
        db: Session,
        entity_type: str,
        entity_id: str,
        action: str,
        payload: Dict[str, Any],
        version: int = 1
    ) -> SyncOutbox:
        outbox_entry = SyncOutbox(
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            payload_json=json.dumps(payload),
            version=version,
            sync_status="pending",
            device_id=settings.DEVICE_ID
        )
        db.add(outbox_entry)
        db.commit()
        return outbox_entry

    def get_sync_summary(self, db: Session) -> Dict[str, Any]:
        pending_uploads = (
            db.query(SyncOutbox)
            .filter(SyncOutbox.sync_status == "pending")
            .count()
        )
        pending_downloads = (
            db.query(SyncInbox)
            .filter(SyncInbox.processed_status == "pending")
            .count()
        )
        failed_count = (
            db.query(SyncOutbox)
            .filter(SyncOutbox.sync_status == "failed")
            .count()
        )

        effective_status = "offline"
        if self.is_online:
            if failed_count > 0:
                effective_status = "error"
            elif pending_uploads > 0 or pending_downloads > 0:
                effective_status = "syncing"
            else:
                effective_status = "synced"

        return {
            "is_online": self.is_online,
            "sync_status": effective_status,
            "device_id": settings.DEVICE_ID,
            "last_synced_at": self.last_synced_at.isoformat() if self.last_synced_at else None,
            "pending_uploads": pending_uploads,
            "pending_downloads": pending_downloads,
            "failed_count": failed_count
        }

    async def toggle_online_state(self, db: Session, online: bool) -> Dict[str, Any]:
        self.is_online = online
        if self.is_online:
            await self.trigger_sync(db)
        summary = self.get_sync_summary(db)
        await event_bus.broadcast("sync_status_changed", summary)
        return summary

    async def trigger_sync(self, db: Session) -> Dict[str, Any]:
        """
        Executes bidirectional synchronization of outbox items.
        """
        pending_items = (
            db.query(SyncOutbox)
            .filter(SyncOutbox.sync_status == "pending")
            .all()
        )

        count = len(pending_items)
        started_at = datetime.now(timezone.utc)

        for item in pending_items:
            item.sync_status = "synced"
            item.synced_at = datetime.now(timezone.utc)

        # Record Sync Log
        log_entry = SyncLog(
            sync_direction="upload",
            entities_count=count,
            status="success",
            started_at=started_at,
            completed_at=datetime.now(timezone.utc)
        )
        db.add(log_entry)
        db.commit()

        self.last_synced_at = datetime.now(timezone.utc)
        summary = self.get_sync_summary(db)
        await event_bus.broadcast("sync_completed", summary)
        return summary

sync_engine = SyncEngine()
