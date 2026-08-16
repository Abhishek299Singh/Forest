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
        ptr_tigers = db_session.query(Tiger).filter(Tiger.tiger_code.like("PTR-T-%")).all()
        assert len(ptr_tigers) > 0
        assert ptr_tigers[0].tiger_code.startswith("PTR-T-")

@pytest.mark.asyncio
async def test_csv_manifest_import_and_map_sync(db_session, tmp_path):
    """
    Tests the exact CSV format specified by the user:
    image,camera_id,timestamp,latitude,longitude,animal,tiger_id,confidence
    IMG_C001.JPG,ST-001,2026-08-16 18:42:17,21.7856,79.2841,tiger,T-104,0.96
    IMG_C002.JPG,ST-001,2026-08-16 19:10:22,21.7856,79.2841,deer,,0.91
    """
    csv_dir = tmp_path / "csv_batch"
    csv_dir.mkdir(parents=True, exist_ok=True)
    manifest = csv_dir / "manifest.csv"
    manifest.write_text(
        "image,camera_id,timestamp,latitude,longitude,animal,tiger_id,confidence\n"
        "IMG_C001.JPG,ST-001,2026-08-16 18:42:17,21.7856,79.2841,tiger,T-104,0.96\n"
        "IMG_C002.JPG,ST-001,2026-08-16 19:10:22,21.7856,79.2841,deer,,0.91\n"
    )

    # 1. Pre-scan CSV folder info
    scan_info = ingestion_manager.scan_folder_info(csv_dir)
    assert scan_info["valid"] is True
    assert scan_info["csv_rows_count"] == 2
    assert "ST-001" in scan_info["detected_stations"]
    assert "tiger" in scan_info["detected_animals"]
    assert "deer" in scan_info["detected_animals"]
    assert scan_info["locations_count"] == 2

    # 2. Ingest CSV Batch
    batch_id = f"BATCH-CSV-{uuid.uuid4().hex[:6].upper()}"
    report = await ingestion_manager.process_batch(
        db=db_session,
        batch_id=batch_id,
        folder_path=csv_dir
    )

    # 3. Verify Batch Report Counts
    assert report["status"] == "completed"
    assert report["total_files"] == 2
    assert report["total_detections"] == 2
    assert report["tiger_detections"] == 1
    assert report["other_wildlife"] == 1
    assert report["locations_found"] == 2
    assert report["locations_unavailable"] == 0
    assert len(report["detections"]) == 2

    # 4. Verify Database Persistence for ST-001
    station = db_session.query(CameraStation).filter(CameraStation.code == "ST-001").first()
    assert station is not None
    assert round(station.latitude, 4) == 21.7856
    assert round(station.longitude, 4) == 79.2841

    # 5. Verify Database Persistence for Tiger T-104
    tiger = db_session.query(Tiger).filter(Tiger.tiger_code == "T-104").first()
    assert tiger is not None
    assert round(tiger.centroid_lat, 4) == 21.7856
    assert round(tiger.centroid_lon, 4) == 79.2841

    # 6. Verify Detection Records in Database
    img1 = db_session.query(Image).filter(Image.filename == "IMG_C001.JPG").first()
    assert img1 is not None
    det1 = db_session.query(Detection).filter(Detection.image_id == img1.id).first()
    assert det1 is not None
    assert det1.class_name == "tiger"
    assert det1.confidence == 0.96

    img2 = db_session.query(Image).filter(Image.filename == "IMG_C002.JPG").first()
    assert img2 is not None
    det2 = db_session.query(Detection).filter(Detection.image_id == img2.id).first()
    assert det2 is not None
    assert det2.class_name == "deer"
    assert det2.confidence == 0.91

