import io
import pytest
from PIL import Image as PILImage
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import get_db
from app.db.models import Image, Detection, Tiger, TigerSighting, CameraStation

client = TestClient(app)

def create_dummy_jpeg(filename: str, width: int = 640, height: int = 480) -> bytes:
    buf = io.BytesIO()
    im = PILImage.new('RGB', (width, height), color=(100, 150, 200))
    im.save(buf, format='JPEG', quality=90)
    buf.seek(0)
    return buf.getvalue()

def test_mandatory_csv_and_images_gate():
    """Requirement 1: Neither images nor CSV is optional."""
    # 1. Images without CSV -> 400 error
    files = [("files", ("img1.jpg", create_dummy_jpeg("img1.jpg"), "image/jpeg"))]
    res_no_csv = client.post("/api/v1/triage/ingest-files", files=files)
    assert res_no_csv.status_code == 400
    assert "CSV metadata file is required" in res_no_csv.json()["detail"]

    # 2. CSV without images -> 400 error
    csv_text = "image,camera_id,timestamp,latitude,longitude,animal,tiger_id,confidence\nimg1.jpg,CAM001,2026-08-17 10:00:00,21.7584,79.3142,tiger,T001,0.95"
    res_no_images = client.post(
        "/api/v1/triage/ingest-files",
        data={"coordinates_csv": csv_text}
    )
    assert res_no_images.status_code == 400
    assert "At least one image is required" in res_no_images.json()["detail"]

def test_csv_filename_mismatch_validation():
    """Requirement 2: Exact matching between CSV image names and uploaded image files."""
    # Case A: img2.jpg in CSV but not uploaded
    files = [("files", ("img1.jpg", create_dummy_jpeg("img1.jpg"), "image/jpeg"))]
    csv_text_missing_upload = """image,camera_id,timestamp,latitude,longitude,animal,tiger_id,confidence
img1.jpg,CAM001,2026-08-17 10:00:00,21.7584,79.3142,tiger,T001,0.95
img2.jpg,CAM001,2026-08-17 10:05:00,21.7584,79.3142,tiger,T001,0.95"""

    res = client.post(
        "/api/v1/triage/ingest-files",
        files=files,
        data={"coordinates_csv": csv_text_missing_upload}
    )
    assert res.status_code == 400
    assert "img2.jpg exists in CSV but was not uploaded" in res.json()["detail"]

    # Case B: img2.jpg uploaded but not in CSV
    files_2 = [
        ("files", ("img1.jpg", create_dummy_jpeg("img1.jpg"), "image/jpeg")),
        ("files", ("img2.jpg", create_dummy_jpeg("img2.jpg"), "image/jpeg"))
    ]
    csv_text_missing_csv = """image,camera_id,timestamp,latitude,longitude,animal,tiger_id,confidence
img1.jpg,CAM001,2026-08-17 10:00:00,21.7584,79.3142,tiger,T001,0.95"""

    res_b = client.post(
        "/api/v1/triage/ingest-files",
        files=files_2,
        data={"coordinates_csv": csv_text_missing_csv}
    )
    assert res_b.status_code == 400
    assert "img2.jpg was uploaded but does not exist in CSV" in res_b.json()["detail"]

def test_full_batch_processing_and_reid():
    """Requirement 3 & 4: Process EVERY image in the batch (20/20) and verify tiger Re-ID & GPS mapping."""
    num_images = 20
    files = []
    csv_rows = ["image,camera_id,timestamp,latitude,longitude,animal,tiger_id,confidence,behavior,sex,age"]

    # Generate 20 test images: 12 tiger images of T001, 5 tiger images of T002, 3 blank images
    for i in range(1, num_images + 1):
        fn = f"img{i}.jpg"
        files.append(("files", (fn, create_dummy_jpeg(fn, 800, 600), "image/jpeg")))
        
        if i <= 12:
            csv_rows.append(f"{fn},CAM001,2026-08-17 10:{i:02d}:00,21.758{i % 5},79.314{i % 5},tiger,T001,0.94,walking,Female,Adult")
        elif i <= 17:
            csv_rows.append(f"{fn},CAM002,2026-08-17 11:{i:02d}:00,21.782{i % 5},79.295{i % 5},tiger,T002,0.91,resting,Male,Adult")
        else:
            csv_rows.append(f"{fn},CAM003,2026-08-17 12:{i:02d}:00,21.7410,79.3360,blank,-,0.99,-,-,-")

    csv_content = "\n".join(csv_rows)

    # Ingest full batch
    res = client.post(
        "/api/v1/triage/ingest-files",
        files=files,
        data={"coordinates_csv": csv_content}
    )
    assert res.status_code == 200, res.text
    report = res.json()

    # Verify all 20 images processed
    assert report["total_images"] == 20
    assert report["processed"] == 20
    assert len(report["detections"]) == 20
    assert report["tiger_detections"] == 17
    assert report["blank"] == 3

    # Check that individual detection records have high-res image_url and GPS
    for det in report["detections"]:
        assert det["image_available"] is True
        assert det["image_url"].startswith("/api/v1/images/")
        assert det["image_url"].endswith("/file")
        assert det["latitude"] is not None
        assert det["longitude"] is not None

    # Check Re-ID: All T001 images associated with T001
    t001_dets = [d for d in report["detections"] if d["tiger_id"] == "T001"]
    assert len(t001_dets) == 12

    t002_dets = [d for d in report["detections"] if d["tiger_id"] == "T002"]
    assert len(t002_dets) == 5

def test_movement_tracks_endpoint():
    """Requirement 10 & 11: Chronological movement path and observed range calculation."""
    res = client.get("/api/v1/triage/movement-tracks")
    assert res.status_code == 200
    tracks = res.json()
    assert len(tracks) >= 2

    t001_track = next((t for t in tracks if t["tiger_code"] == "T001"), None)
    assert t001_track is not None
    assert t001_track["sightings_count"] >= 12
    assert t001_track["can_calculate_range"] is True
    assert len(t001_track["hull_polygon"]) >= 3

    # Check timestamps sorted chronologically
    timestamps = [p["captured_at"] for p in t001_track["points"]]
    assert timestamps == sorted(timestamps)

def test_dynamic_statistics():
    """Requirement 14: Dynamic real statistics calculated from actual database records."""
    res = client.get("/api/v1/triage/statistics")
    assert res.status_code == 200
    stats = res.json()

    assert stats["total_images"] >= 20
    assert stats["tiger_detections"] >= 17
    assert stats["unique_tigers"] >= 2
    assert stats["active_cameras"] >= 3
    assert stats["average_confidence"] > 0
    assert stats["total_gps_locations"] >= 17

def test_ai_species_recognition_without_animal_column():
    """Verify that CSV without animal column is accepted and AI classifier recognizes species."""
    files = [
        ("files", ("tiger_sample.jpg", create_dummy_jpeg("tiger_sample.jpg"), "image/jpeg")),
        ("files", ("deer_sample.jpg", create_dummy_jpeg("deer_sample.jpg"), "image/jpeg")),
        ("files", ("blank_sample.jpg", create_dummy_jpeg("blank_sample.jpg"), "image/jpeg"))
    ]
    # CSV containing only core spatial-temporal coordinates, NO animal column
    csv_text = """image,camera_id,timestamp,latitude,longitude
tiger_sample.jpg,CAM001,2026-08-17 10:00:00,21.7584,79.3142
deer_sample.jpg,CAM002,2026-08-17 10:15:00,21.7821,79.2954
blank_sample.jpg,CAM003,2026-08-17 10:30:00,21.7412,79.3367"""

    res = client.post(
        "/api/v1/triage/ingest-files",
        files=files,
        data={"coordinates_csv": csv_text}
    )
    assert res.status_code == 200, res.text
    report = res.json()
    assert report["total_images"] == 3
    assert report["processed"] == 3

    # Check that AI classifier assigned species and confidence
    for det in report["detections"]:
        assert det["animal"] is not None and len(det["animal"]) > 0
        assert det["confidence"] > 0.0
        assert det["confidence_pct"].endswith("%")

