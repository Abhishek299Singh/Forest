import pytest
from app.services.movement_alert import movement_alert_engine

def test_haversine_distance():
    # Distance between Turia (21.7584, 79.3142) and Gumtara (21.7120, 79.2350)
    dist = movement_alert_engine.haversine_distance_km(21.7584, 79.3142, 21.7120, 79.2350)
    assert 9.0 < dist < 11.5
