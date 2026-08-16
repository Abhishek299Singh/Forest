import pytest
from shapely.geometry import Polygon
from app.services.occupancy import occupancy_engine

def test_coords_to_km2_conversion():
    # Square of 0.05 deg ~ 5.5 km x 5.5 km ~ 30 sq km
    poly = Polygon([(79.30, 21.75), (79.35, 21.75), (79.35, 21.80), (79.30, 21.80)])
    area_km2 = occupancy_engine._coords_to_km2(poly, 21.775)
    assert 25.0 < area_km2 < 35.0
