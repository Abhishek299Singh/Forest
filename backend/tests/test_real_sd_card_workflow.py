import pytest
import os
import shutil
import uuid
from pathlib import Path
from PIL import Image as PILImage, ImageDraw
from datetime import datetime, timezone

from app.db.database import SessionLocal, Base, engine
from app.db.models import Tiger, Image, CameraStation, Detection, Alert, TigerSighting, TigerImage
from app.services.ingestion import ingestion_manager
from app.core.config import settings

@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    yield session
    session.close()

@pytest.fixture
def temp_sd_card(tmp_path):
    """
    Creates a simulated raw SD card directory:
    SD_CARD/
      DCIM/
        100CUDD/
          IMG_0001.JPG (tiger image)
          IMG_0002.JPG (blank image)
    """
    sd_root = tmp_path / "SD_CARD"
    cam_folder = sd_root / "DCIM" / "100CUDD"
    cam_folder.mkdir(parents=True, exist_ok=True)

    # 1. Tiger image
    img1 = PILImage.new("RGB", (640, 480), (25, 45, 25))
    d1 = ImageDraw.Draw(img1)
    d1.ellipse([100, 100, 400, 350], fill=(215, 115, 20)) # Amber body
    d1.line([(150, 150), (140, 280)], fill=(15, 15, 15), width=8) # Stripes
    d1.line([(220, 150), (210, 280)], fill=(15, 15, 15), width=8)
    t1_path = cam_folder / "IMG_0001.JPG"
    img1.save(t1_path, "JPEG")

    # 2. Blank image (pure dark green background with leaf lines)
    img2 = PILImage.new("RGB", (640, 480), (35, 55, 30))
    d2 = ImageDraw.Draw(img2)
    d2.line([(50, 480), (80, 200)], fill=(45, 75, 40), width=3)
    t2_path = cam_folder / "IMG_0002.JPG"
    img2.save(t2_path, "JPEG")

    return sd_root

@pytest.mark.asyncio
async def test_full_sd_card_import_and_dynamic_tiger_generation(db_session, temp_sd_card):
    # Verify initial clean/empty state for this test scope
    initial_tigers = db_session.query(Tiger).count()

    # 1. Pre-scan SD Card directory info
    scan_info = ingestion_manager.scan_folder_info(temp_sd_card)
    assert scan_info["valid"] is True
    assert scan_info["total_images_found"] == 2
    assert "ST-100CUDD" in scan_info["detected_stations"]

    # 2. Ingest Batch
    batch_id = f"BATCH-TEST-{uuid.uuid4().hex[:6].upper()}"
    report = await ingestion_manager.process_batch(
        db=db_session,
        batch_id=batch_id,
        folder_path=temp_sd_card
    )

    # 3. Verify Batch Report Metrics
    assert report["status"] == "completed"
    assert report["total_images"] == 2
    assert report["processed"] == 2
    assert "data_quality" in report
    assert "images_per_minute" in report

    # 4. Verify Original SD card was NEVER modified or deleted
    assert (temp_sd_card / "DCIM" / "100CUDD" / "IMG_0001.JPG").exists()
    assert (temp_sd_card / "DCIM" / "100CUDD" / "IMG_0002.JPG").exists()

    # 5. Verify Safe Local Workspace was created
    workspace_dir = settings.BASE_DIR / "workspace" / "batches" / batch_id
    assert workspace_dir.exists()

    # 6. Verify Dynamic Station and Tiger Registration
    station = db_session.query(CameraStation).filter(CameraStation.code == "ST-100CUDD").first()
    assert station is not None

    if report["tiger_images"] > 0:
        tigers = db_session.query(Tiger).all()
        assert len(tigers) > initial_tigers
        new_tiger = tigers[-1]
        assert new_tiger.tiger_code.startswith("PTR-T-")
