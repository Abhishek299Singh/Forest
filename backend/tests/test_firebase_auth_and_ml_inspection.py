import pytest
import uuid
import os
import json
import base64
from pathlib import Path
from PIL import Image as PILImage, ImageDraw

from app.db.database import SessionLocal, Base, engine
from app.db.models import User, Image, CameraStation, Detection, Tiger, TigerImage, TigerSighting
from app.services.ingestion import ingestion_manager
from app.ml.pipeline import TriagePipeline
from app.core.config import settings
from app.core.security import get_password_hash, create_access_token
from app.api.auth import verify_firebase_id_token, require_admin, require_ranger
from fastapi import HTTPException

@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    yield session
    session.close()

def create_mock_firebase_token(uid: str, email: str) -> str:
    """Creates a mock JWT matching standard Firebase token structure."""
    header = base64.urlsafe_b64encode(json.dumps({"alg": "RS256", "typ": "JWT"}).encode()).decode().rstrip("=")
    payload = base64.urlsafe_b64encode(json.dumps({
        "iss": "https://securetoken.google.com/pench-wildlife-platform",
        "aud": "pench-wildlife-platform",
        "auth_time": 1700000000,
        "user_id": uid,
        "sub": uid,
        "email": email,
        "email_verified": True
    }).encode()).decode().rstrip("=")
    signature = base64.urlsafe_b64encode(b"mock_signature_for_test").decode().rstrip("=")
    return f"{header}.{payload}.{signature}"

def test_firebase_token_verification_and_rbac(db_session):
    # 1. Seed Admin and Ranger in DB
    admin = db_session.query(User).filter(User.email == "admin@pench.gov.in").first()
    if not admin:
        admin = User(
            email="admin@pench.gov.in",
            full_name="Dr. Shubham Sharma (Admin)",
            hashed_password=get_password_hash("pench123"),
            role="admin",
            is_active=True
        )
        db_session.add(admin)

    ranger = db_session.query(User).filter(User.email == "ranger@pench.gov.in").first()
    if not ranger:
        ranger = User(
            email="ranger@pench.gov.in",
            full_name="Rajesh Uikey (Ranger)",
            hashed_password=get_password_hash("pench123"),
            role="ranger",
            is_active=True
        )
        db_session.add(ranger)
    db_session.commit()

    # 2. Test Firebase token parser
    admin_token = create_mock_firebase_token("fb_uid_admin_001", "admin@pench.gov.in")
    claims = verify_firebase_id_token(admin_token)
    assert claims["uid"] == "fb_uid_admin_001"
    assert claims["email"] == "admin@pench.gov.in"

    # 3. Test RBAC permissions
    admin_user = require_admin(admin)
    assert admin_user.role == "admin"

    ranger_user = require_ranger(ranger)
    assert ranger_user.role == "ranger"

    # 4. Verify Ranger is blocked from Admin endpoints (403)
    with pytest.raises(HTTPException) as excinfo:
        require_admin(ranger)
    assert excinfo.value.status_code == 403

def test_real_ml_pipeline_body_and_flank_crops(db_session, tmp_path):
    """
    Verifies that the ML pipeline analyzes a real image file from disk,
    crops the real body and flank sub-rectangles, and saves them to managed storage.
    """
    # Create test camera trap image
    cam_dir = tmp_path / "camera_input"
    cam_dir.mkdir(parents=True, exist_ok=True)
    # Real RGB image with tiger colors and unique salt
    unique_salt = uuid.uuid4().hex[:6]
    img_file = cam_dir / f"IMG_REAL_{unique_salt}.JPG"
    img = PILImage.new("RGB", (640, 480), (30, 45, 30))
    draw = ImageDraw.Draw(img)
    draw.rectangle([120, 100, 520, 380], fill=(210, 115, 20)) # Tiger body
    draw.line([(200, 150), (190, 320)], fill=(10, 10, 10), width=6) # Stripes
    draw.line([(300, 150), (290, 320)], fill=(10, 10, 10), width=6)
    draw.text((10, 10), unique_salt, fill=(255, 255, 255))
    img.save(img_file, "JPEG")

    pipeline = TriagePipeline()
    result = pipeline.process_image(
        db=db_session,
        image_path=img_file,
        station_code_hint="ST-TEST-01"
    )

    assert result["status"] == "success"
    assert result["class_name"] in ["tiger", "animal"]

    # Verify that crops were saved on disk
    body_crop_file = settings.CROPS_DIR / f"body_{result['image_id']}.jpg"
    flank_crop_file = settings.CROPS_DIR / f"flank_{result['image_id']}_{result.get('flank_side', 'left')}.jpg"

    assert body_crop_file.exists()
    assert flank_crop_file.exists()

    # Verify crops can be opened and are non-empty
    with PILImage.open(body_crop_file) as b_img:
        assert b_img.width > 0 and b_img.height > 0
    with PILImage.open(flank_crop_file) as f_img:
        assert f_img.width > 0 and f_img.height > 0
