import pytest
import json
from datetime import datetime, timezone
from app.services.movement_alert import movement_alert_engine
from app.db.database import SessionLocal, Base, engine
from app.db.models import Tiger, TigerSighting, CameraStation, Alert, Image

@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    yield session
    session.close()

def test_haversine_distance():
    dist = movement_alert_engine.haversine_distance_km(21.7584, 79.3142, 21.7120, 79.2350)
    assert 9.0 < dist < 11.5

@pytest.mark.asyncio
async def test_buffer_and_village_alerts_with_explainability(db_session):
    # Core tiger
    t = Tiger(
        tiger_code="TEST-T-CORE",
        callsign="Core Dominant Male",
        status="resident",
        primary_zone="Core",
        centroid_lat=21.7584,
        centroid_lon=79.3142
    )
    db_session.add(t)
    db_session.flush()

    # Village-adjacent buffer station
    st = CameraStation(
        code="ST-VILLAGE",
        name="Village Edge Trap",
        latitude=21.7100,
        longitude=79.2300,
        zone="buffer",
        range_beat="Telia",
        habitat="Grassland",
        is_village_adjacent=True,
        adjacent_village_name="Telia"
    )
    db_session.add(st)
    db_session.flush()

    now = datetime.now(timezone.utc)
    img = Image(
        filename="alert_img.jpg",
        original_path="data/raw/alert_img.jpg",
        storage_path="data/images/alert_img.jpg",
        file_hash="hash_alert_1",
        station_id=st.id,
        captured_at=now
    )
    db_session.add(img)
    db_session.flush()

    # Sighting
    s = TigerSighting(
        tiger_id=t.id,
        image_id=img.id,
        station_id=st.id,
        latitude=st.latitude,
        longitude=st.longitude,
        captured_at=now,
        confidence=0.95
    )
    db_session.add(s)
    db_session.commit()

    alerts = await movement_alert_engine.evaluate_sighting_alerts(db_session, s)
    assert len(alerts) >= 1
    
    for al in alerts:
        expl = json.loads(al.explanation_json)
        assert "what_changed" in expl
        assert "why_it_matters" in expl
        assert "supporting_evidence" in expl
        assert "survey_effort" in expl
        assert expl["confidence"] >= 0.85
