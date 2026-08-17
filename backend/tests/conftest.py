"""
Pytest Test Suite Configuration & Complete Data Isolation Fixture.
Guarantees that all tests run inside a temporary sandbox directory without
polluting or modifying the production backend/data/ directory or database.
"""
import os
import sys
import pytest
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Ensure backend root is in sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.config import settings
from app.core.security import get_password_hash
import app.db.database as db_module
from app.db.models import Base, User, CameraStation

@pytest.fixture(scope="session", autouse=True)
def isolate_test_environment(tmp_path_factory):
    """
    Autouse session fixture:
    1. Redirects settings.BASE_DIR to a pytest tmp_path sandbox.
    2. Points DATABASE_URL to an isolated test SQLite database.
    3. Initializes tables and seeds essential test records.
    4. Ensures zero writes to production backend/data/.
    """
    temp_base = tmp_path_factory.mktemp("pench_test_sandbox")
    
    # Store original configuration to restore after test session if needed
    orig_base_dir = settings.BASE_DIR
    orig_db_url = settings.DATABASE_URL
    orig_sqlite_path = settings.SQLITE_DB_PATH

    # Override settings to point to sandbox
    settings.BASE_DIR = temp_base
    test_db_path = temp_base / "test_offline.db"
    settings.DATABASE_URL = f"sqlite:///{test_db_path.as_posix()}"
    settings.SQLITE_DB_PATH = str(test_db_path)

    # Rebind SQLAlchemy engine and SessionLocal
    test_engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
    db_module.engine.dispose()
    db_module.engine = test_engine
    db_module.SessionLocal.configure(bind=test_engine)

    # Create all database schemas in test database
    Base.metadata.create_all(bind=test_engine)

    # Seed test users and default camera stations in test database
    db = db_module.SessionLocal()
    try:
        # Admin User
        admin_user = User(
            email="admin@pench.gov.in",
            hashed_password=get_password_hash("pench123"),
            full_name="Dr. Alok Shukla (Director)",
            role="admin",
            is_active=True
        )
        db.add(admin_user)

        # Ranger User
        ranger_user = User(
            email="ranger@pench.gov.in",
            hashed_password=get_password_hash("pench123"),
            full_name="Rajesh Kumar",
            role="ranger",
            is_active=True
        )
        db.add(ranger_user)

        # Standard Stations
        stations = [
            ("ST01", "Turia Gate Waterhole", "core", 21.7580, 79.3140, "Turia Beat 1"),
            ("ST02", "Karmajhiri Stream Crossing", "core", 21.7920, 79.3450, "Karmajhiri North"),
            ("ST03", "Chhindimatta Ridge", "core", 21.8210, 79.2980, "Chhindimatta Deep"),
            ("ST04", "Alikatta Grassland", "core", 21.7450, 79.3620, "Alikatta Plains"),
            ("ST05", "Jamun Nala Crossing", "buffer", 21.7120, 79.2840, "Buffer South"),
            ("ST06", "Sillari Boundary Track", "buffer", 21.6890, 79.3110, "Sillari Sector"),
            ("ST07", "Khumari Village Border", "buffer", 21.6740, 79.3580, "Khumari Interface"),
            ("ST08", "Ghatkohka Buffer Corridor", "buffer", 21.8450, 79.3820, "Ghatkohka East")
        ]
        for code, name, zone, lat, lon, beat in stations:
            st = CameraStation(
                code=code,
                name=name,
                zone=zone,
                latitude=lat,
                longitude=lon,
                range_beat=beat,
                status="active"
            )
            db.add(st)

        db.commit()
    finally:
        db.close()

    yield temp_base

    # Teardown & cleanup
    db_module.engine.dispose()
    settings.BASE_DIR = orig_base_dir
    settings.DATABASE_URL = orig_db_url
    settings.SQLITE_DB_PATH = orig_sqlite_path
