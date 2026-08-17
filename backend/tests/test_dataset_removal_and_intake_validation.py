"""
Test Dataset Removal Tool, CSV Coordinate Validation, and Amur Tiger Re-ID Pipeline
"""
import pytest
import os
import tempfile
from pathlib import Path
from datetime import datetime, timezone

from app.db.database import SessionLocal, engine, Base
from app.db.models import User, CameraStation, Image, Tiger, TigerEmbedding, AuditLog
from app.services.ingestion import IngestionManager
from app.ml.amur_dataset import AmurTigerDataset
from app.ml.train_reid import train_reid_model
from remove_dataset import remove_dataset, get_registered_datasets

@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()

def test_parse_coordinates_csv_valid():
    manager = IngestionManager()
    
    csv_text = """camera_id,latitude,longitude,station_name,zone
CAM_001,21.6452,79.3124,Station_A,Core
CAM_002,21.6528,79.3251,Station_B,Buffer
CAM_003,21.6387,79.3412,Station_C,Core
"""
    res = manager.parse_coordinates_csv_content(csv_text)
    assert len(res["errors"]) == 0
    assert len(res["stations"]) == 3
    assert res["stations"]["CAM_001"]["latitude"] == 21.6452
    assert res["stations"]["CAM_001"]["longitude"] == 79.3124
    assert res["stations"]["CAM_002"]["zone"] == "buffer"

def test_parse_coordinates_csv_out_of_range():
    manager = IngestionManager()
    
    bad_csv = """camera_id,latitude,longitude
CAM_001,999.0,79.3124
CAM_002,21.6528,-500.0
"""
    res = manager.parse_coordinates_csv_content(bad_csv)
    assert len(res["errors"]) == 2
    assert "Latitude 999.0 out of valid range" in res["errors"][0]
    assert "Longitude -500.0 out of valid range" in res["errors"][1]

def test_validate_intake_matching():
    manager = IngestionManager()
    csv_text = """camera_id,latitude,longitude
ST-001,21.7584,79.3142
ST-002,21.7821,79.2954
"""
    val = manager.validate_intake(
        folder_path=None,
        coordinates_csv_content=csv_text
    )
    assert val["valid"] is True
    assert val["csv_stations_count"] == 2
    assert len(val["errors"]) == 0

def test_amur_tiger_dataset_and_training(tmp_path):
    # Create mock ATRW directory structure
    tiger_a_dir = tmp_path / "tiger_001"
    tiger_b_dir = tmp_path / "tiger_002"
    tiger_a_dir.mkdir(parents=True)
    tiger_b_dir.mkdir(parents=True)

    from PIL import Image as PILImage
    img1 = PILImage.new("RGB", (100, 100), color="orange")
    img1.save(tiger_a_dir / "left_01.jpg")
    img1.save(tiger_a_dir / "left_02.jpg")
    img1.save(tiger_b_dir / "right_01.jpg")
    img1.save(tiger_b_dir / "right_02.jpg")

    dataset = AmurTigerDataset(tmp_path)
    summary = dataset.get_summary()
    assert summary["total_images"] == 4
    assert summary["total_individuals"] == 2

    triplets = dataset.generate_triplets(batch_size=2)
    assert len(triplets) == 2

    # Test training
    weights_path = tmp_path / "weights.json"
    meta = train_reid_model(dataset_dir=str(tmp_path), epochs=2, batch_size=2, output_weights=str(weights_path))
    assert meta["model_architecture"] == "ResNet-Stripe-Triplet-128D"
    assert weights_path.exists()
