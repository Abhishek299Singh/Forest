import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import SyncOutbox, SyncInbox, SyncLog
from app.services.sync_engine import sync_engine
from app.api.auth import get_current_user

router = APIRouter(prefix="/sync", tags=["Offline & Online Synchronization"])

class ToggleConnectivityRequest(BaseModel):
    is_online: bool

@router.get("/status")
def get_sync_status(db: Session = Depends(get_db)):
    return sync_engine.get_sync_summary(db)

@router.post("/toggle-connectivity")
async def toggle_connectivity(
    req: ToggleConnectivityRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return await sync_engine.toggle_online_state(db, req.is_online)

@router.post("/trigger")
async def trigger_sync(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    return await sync_engine.trigger_sync(db)

@router.get("/outbox")
def list_outbox_items(limit: int = 50, db: Session = Depends(get_db)):
    items = (
        db.query(SyncOutbox)
        .order_by(SyncOutbox.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": it.id,
            "entity_type": it.entity_type,
            "entity_id": it.entity_id,
            "action": it.action,
            "version": it.version,
            "sync_status": it.sync_status,
            "device_id": it.device_id,
            "created_at": it.created_at.isoformat() if it.created_at else None,
            "synced_at": it.synced_at.isoformat() if it.synced_at else None
        }
        for it in items
    ]

@router.get("/logs")
def list_sync_logs(limit: int = 20, db: Session = Depends(get_db)):
    logs = db.query(SyncLog).order_by(SyncLog.started_at.desc()).limit(limit).all()
    return [
        {
            "id": l.id,
            "direction": l.sync_direction,
            "entities_count": l.entities_count,
            "status": l.status,
            "started_at": l.started_at.isoformat() if l.started_at else None,
            "completed_at": l.completed_at.isoformat() if l.completed_at else None
        }
        for l in logs
    ]
