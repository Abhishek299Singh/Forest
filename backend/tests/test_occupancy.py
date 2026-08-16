import pytest
from datetime import datetime, timezone
from shapely.geometry import Polygon
from app.services.occupancy import occupancy_engine
from app.db.database import SessionLocal, Base, engine
from app.db.models import Tiger, TigerSighting, CameraStation, Image

@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    yield session
    session.close()

def test_coords_to_km2_conversion():
    # Square of 0.05 deg ~ 5.5 km x 5.5 km ~ 30 sq km
    poly = Polygon([(79.30, 21.75), (79.35, 21.75), (79.35, 21.80), (79.30, 21.80)])
    area_km2 = occupancy_engine._coords_to_km2(poly, 21.775)
    assert 25.0 < area_km2 < 35.0

def test_minimum_observations_rule(db_session):
    # Create test tiger
    t = Tiger(tiger_code="TEST-T-99", callsign="Test Transient", status="transient", primary_zone="Core")
    db_session.add(t)
    db_session.flush()

    st = db_session.query(CameraStation).first()
    if not st:
        st = CameraStation(code="ST-T1", name="Test Station", latitude=21.75, longitude=79.32, zone="core", range_beat="Turia", habitat="Sal")
        db_session.add(st)
        db_session.flush()

    now = datetime.now(timezone.utc)
    img1 = Image(filename="occ_01.jpg", original_path="data/raw/occ_01.jpg", storage_path="data/images/occ_01.jpg", file_hash="hash1", station_id=st.id, captured_at=now)
    img2 = Image(filename="occ_02.jpg", original_path="data/raw/occ_02.jpg", storage_path="data/images/occ_02.jpg", file_hash="hash2", station_id=st.id, captured_at=now)
    db_session.add_all([img1, img2])
    db_session.flush()

    # Add only 2 sightings (< 5 minimum observation rule)
    s1 = TigerSighting(tiger_id=t.id, image_id=img1.id, station_id=st.id, latitude=21.75, longitude=79.32, captured_at=now, confidence=0.9)
    s2 = TigerSighting(tiger_id=t.id, image_id=img2.id, station_id=st.id, latitude=21.76, longitude=79.33, captured_at=now, confidence=0.9)
    db_session.add_all([s1, s2])
    db_session.commit()

    occ_result = occupancy_engine.calculate_tiger_occupancy(db_session, t.id)
    assert occ_result["is_statistically_reliable"] == False
    assert occ_result["status"] == "INSUFFICIENT_OBSERVATIONS"
    assert "N=2 < 5" in occ_result["warning"]
