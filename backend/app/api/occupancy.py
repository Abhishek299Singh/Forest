import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Tiger, OccupancyResult, TigerSighting, CameraStation
from app.services.occupancy import occupancy_engine

router = APIRouter(prefix="/occupancy", tags=["Occupancy & Home Range"])

@router.get("/summary")
def get_occupancy_summary(db: Session = Depends(get_db)):
    tigers = db.query(Tiger).filter(Tiger.territory_area_km2 > 0).all()
    results = []

    for t in tigers:
        occ = (
            db.query(OccupancyResult)
            .filter(OccupancyResult.tiger_id == t.id)
            .order_by(OccupancyResult.calculation_date.desc())
            .first()
        )
        results.append({
            "tiger_id": t.id,
            "tiger_code": t.tiger_code,
            "callsign": t.callsign,
            "sex": t.sex,
            "status": t.status,
            "primary_zone": t.primary_zone,
            "mcp_area_km2": t.territory_area_km2,
            "centroid": {"latitude": t.centroid_lat, "longitude": t.centroid_lon} if t.centroid_lat else None,
            "polygon_geojson": json.loads(occ.polygon_geojson) if occ and occ.polygon_geojson else None
        })

    return results

@router.get("/tiger/{tiger_id}")
def get_tiger_occupancy(tiger_id: str, db: Session = Depends(get_db)):
    return occupancy_engine.calculate_tiger_occupancy(db, tiger_id)

@router.get("/overlaps")
def get_territory_overlaps(db: Session = Depends(get_db)):
    return occupancy_engine.compute_territory_overlap_matrix(db)

@router.get("/geojson")
def get_occupancy_geojson(db: Session = Depends(get_db)):
    """Returns a full GeoJSON FeatureCollection of all tiger home-range polygons and centroids."""
    tigers = db.query(Tiger).all()
    features = []

    for t in tigers:
        occ = (
            db.query(OccupancyResult)
            .filter(OccupancyResult.tiger_id == t.id)
            .order_by(OccupancyResult.calculation_date.desc())
            .first()
        )
        if occ and occ.polygon_geojson:
            try:
                poly = json.loads(occ.polygon_geojson)
                features.append({
                    "type": "Feature",
                    "geometry": poly,
                    "properties": {
                        "tiger_id": t.id,
                        "tiger_code": t.tiger_code,
                        "callsign": t.callsign,
                        "mcp_area_km2": t.territory_area_km2,
                        "zone": t.primary_zone,
                        "sex": t.sex,
                        "layer_type": "home_range_polygon"
                    }
                })
            except Exception:
                pass

        if t.centroid_lat and t.centroid_lon:
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [t.centroid_lon, t.centroid_lat]
                },
                "properties": {
                    "tiger_id": t.id,
                    "tiger_code": t.tiger_code,
                    "callsign": t.callsign,
                    "layer_type": "activity_centroid"
                }
            })

    return {
        "type": "FeatureCollection",
        "features": features
    }
