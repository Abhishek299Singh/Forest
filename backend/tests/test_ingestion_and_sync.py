import pytest
from pathlib import Path
from app.db.database import SessionLocal, Base, engine
from app.db.models import CameraStation, User, Tiger, Image, SyncOutbox
from app.services.ingestion import ingestion_manager
from app.services.sync_engine import sync_engine
from app.core.config import settings
from app.api.settings import get_policies

@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    yield session
    session.close()

@pytest.mark.asyncio
async def test_folder_ingestion_and_data_quality(db_session):
    demo_folder = settings.BASE_DIR / "demo_sd_cards" / "batch_01_core_turia"
    if not demo_folder.exists():
        demo_folder = Path("demo_sd_cards/batch_01_core_turia")

    if demo_folder.exists():
        report = await ingestion_manager.process_batch(
            db=db_session,
            batch_id="TEST-BATCH-01",
            folder_path=demo_folder
        )
        assert report["total_images"] >= 3
        assert report["processed"] >= 3
        assert report["status"] == "completed"
        assert "data_quality" in report
        assert "images_per_minute" in report

    # Test sync outbox queuing
    sync_engine.queue_outbox(
        db=db_session,
        entity_type="test_sighting",
        entity_id="test-123",
        action="insert",
        payload={"notes": "Field observation"}
    )
    summary = sync_engine.get_sync_summary(db_session)
    assert summary["pending_uploads"] >= 1

    # Test sync trigger
    synced_summary = await sync_engine.trigger_sync(db_session)
    assert synced_summary["pending_uploads"] == 0

def test_configurable_policies():
    policies = get_policies()
    assert policies["core_centroid_shift_threshold_km"] == 4.5
    assert policies["buffer_movement_threshold_km"] == 5.0
    assert policies["village_proximity_threshold_km"] == 1.5
    assert policies["min_observations_for_mcp"] == 5
    assert policies["prolonged_absence_days"] == 45
