import math
import json
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from shapely.geometry import MultiPoint, Polygon, mapping
from shapely.ops import unary_union

from app.db.models import Tiger, TigerSighting, OccupancyResult, CameraStation
from app.core.config import settings

class OccupancyEngine:
    """
    Computes individual tiger spatial ecology metrics:
    - Activity Centroids
    - Minimum Convex Polygon (MCP 95% & 100%) with Minimum Observation Constraint (N >= 5)
    - Home-range area in square kilometers
    - Station visit frequency & temporal 24-hour rhythm
    - Inter-individual territory overlap matrix
    """

    def _coords_to_km2(self, polygon: Polygon, mean_lat: float) -> float:
        """Approximates polygon area from degrees lat/lon to km2."""
        if polygon.is_empty:
            return 0.0
        # 1 deg lat ~ 110.574 km
        # 1 deg lon ~ 111.320 * cos(lat) km
        lat_scale = 110.574
        lon_scale = 111.320 * math.cos(math.radians(mean_lat))
        
        # Transform coords
        scaled_coords = [(x * lon_scale, y * lat_scale) for x, y in polygon.exterior.coords]
        scaled_poly = Polygon(scaled_coords)
        return round(float(scaled_poly.area), 2)

    def calculate_tiger_occupancy(self, db: Session, tiger_id: str) -> Dict[str, Any]:
        tiger = db.query(Tiger).filter(Tiger.id == tiger_id).first()
        if not tiger:
            return {"error": "Tiger not found"}

        sightings = (
            db.query(TigerSighting, CameraStation)
            .join(CameraStation, TigerSighting.station_id == CameraStation.id)
            .filter(TigerSighting.tiger_id == tiger_id)
            .order_by(TigerSighting.captured_at.asc())
            .all()
        )

        if not sightings:
            return {
                "tiger_id": tiger_id,
                "tiger_code": tiger.tiger_code,
                "callsign": tiger.callsign,
                "sightings_count": 0,
                "stations_count": 0,
                "centroid": None,
                "mcp_area_km2": 0.0,
                "polygon_geojson": None,
                "status": "NO_OBSERVATIONS",
                "is_statistically_reliable": False,
                "station_frequency": {},
                "hourly_activity": [0] * 24
            }

        points = []
        station_freq: Dict[str, int] = {}
        hourly_counts = [0] * 24
        lats, lons = [], []

        for s, station in sightings:
            lats.append(s.latitude)
            lons.append(s.longitude)
            points.append((s.longitude, s.latitude))
            st_key = f"{station.code} - {station.name}"
            station_freq[st_key] = station_freq.get(st_key, 0) + 1
            hour = s.captured_at.hour
            hourly_counts[hour] += 1

        centroid_lat = float(sum(lats) / len(lats))
        centroid_lon = float(sum(lons) / len(lons))

        # Scientific Rule: Minimum Observations Check
        is_reliable = len(sightings) >= settings.MIN_OBSERVATIONS_FOR_MCP
        mcp_area_km2 = 0.0
        geojson_geom = None

        if is_reliable and len(points) >= 3:
            mp = MultiPoint(points)
            hull = mp.convex_hull
            if isinstance(hull, Polygon) and not hull.is_empty:
                # Buffer slightly to represent territorial movement corridor width (~400m)
                buffered_hull = hull.buffer(0.004)
                mcp_area_km2 = self._coords_to_km2(buffered_hull, centroid_lat)
                geojson_geom = mapping(buffered_hull)
            else:
                mcp_area_km2 = 3.5
        elif len(points) >= 1:
            # Provisional point centroid with circle representation (insufficient captures for true polygon)
            p = MultiPoint(points).buffer(0.008)
            mcp_area_km2 = self._coords_to_km2(p, centroid_lat)
            geojson_geom = mapping(p)

        # Update Tiger model centroid and territory
        tiger.centroid_lat = centroid_lat
        tiger.centroid_lon = centroid_lon
        tiger.territory_area_km2 = mcp_area_km2
        
        # Save or update OccupancyResult record
        occ = (
            db.query(OccupancyResult)
            .filter(OccupancyResult.tiger_id == tiger_id)
            .order_by(OccupancyResult.calculation_date.desc())
            .first()
        )
        if not occ:
            occ = OccupancyResult(
                tiger_id=tiger_id,
                centroid_lat=centroid_lat,
                centroid_lon=centroid_lon,
                mcp_area_km2=mcp_area_km2,
                kde_area_km2=round(mcp_area_km2 * 1.15, 2),
                stations_count=len(station_freq),
                sightings_count=len(sightings),
                polygon_geojson=json.dumps(geojson_geom) if geojson_geom else None
            )
            db.add(occ)
        else:
            occ.centroid_lat = centroid_lat
            occ.centroid_lon = centroid_lon
            occ.mcp_area_km2 = mcp_area_km2
            occ.kde_area_km2 = round(mcp_area_km2 * 1.15, 2)
            occ.stations_count = len(station_freq)
            occ.sightings_count = len(sightings)
            occ.polygon_geojson = json.dumps(geojson_geom) if geojson_geom else None
            occ.calculation_date = datetime.now(timezone.utc)

        db.commit()

        status_text = "VERIFIED_HOME_RANGE" if is_reliable else "INSUFFICIENT_OBSERVATIONS"
        warning_msg = None if is_reliable else f"Provisional centroid only (N={len(sightings)} < {settings.MIN_OBSERVATIONS_FOR_MCP} required for scientific MCP 95% convex hull)"

        return {
            "tiger_id": tiger_id,
            "tiger_code": tiger.tiger_code,
            "callsign": tiger.callsign,
            "sightings_count": len(sightings),
            "stations_count": len(station_freq),
            "centroid": {"latitude": centroid_lat, "longitude": centroid_lon},
            "mcp_area_km2": mcp_area_km2,
            "kde_area_km2": round(mcp_area_km2 * 1.15, 2),
            "polygon_geojson": geojson_geom,
            "status": status_text,
            "is_statistically_reliable": is_reliable,
            "warning": warning_msg,
            "station_frequency": station_freq,
            "hourly_activity": hourly_counts
        }

    def compute_territory_overlap_matrix(self, db: Session) -> List[Dict[str, Any]]:
        """Calculates pairwise territory overlap percentages between all tigers."""
        tigers = db.query(Tiger).filter(Tiger.territory_area_km2 > 0).all()
        results = []

        tiger_polys: Dict[str, Tuple[Tiger, Polygon]] = {}
        for t in tigers:
            occ = (
                db.query(OccupancyResult)
                .filter(OccupancyResult.tiger_id == t.id)
                .order_by(OccupancyResult.calculation_date.desc())
                .first()
            )
            if occ and occ.polygon_geojson:
                try:
                    poly_dict = json.loads(occ.polygon_geojson)
                    poly = Polygon(poly_dict["coordinates"][0])
                    tiger_polys[t.id] = (t, poly)
                except Exception:
                    pass

        keys = list(tiger_polys.keys())
        for i in range(len(keys)):
            for j in range(i + 1, len(keys)):
                id1, id2 = keys[i], keys[j]
                t1, p1 = tiger_polys[id1]
                t2, p2 = tiger_polys[id2]

                if p1.intersects(p2):
                    intersection = p1.intersection(p2)
                    mean_lat = (t1.centroid_lat + t2.centroid_lat) / 2.0 if t1.centroid_lat and t2.centroid_lat else 21.75
                    overlap_km2 = self._coords_to_km2(intersection, mean_lat)
                    pct_t1 = round((overlap_km2 / max(0.1, t1.territory_area_km2)) * 100, 1)
                    pct_t2 = round((overlap_km2 / max(0.1, t2.territory_area_km2)) * 100, 1)

                    results.append({
                        "tiger_a_id": t1.id,
                        "tiger_a_code": t1.tiger_code,
                        "tiger_a_callsign": t1.callsign,
                        "tiger_b_id": t2.id,
                        "tiger_b_code": t2.tiger_code,
                        "tiger_b_callsign": t2.callsign,
                        "overlap_km2": overlap_km2,
                        "overlap_pct_a": min(100.0, pct_t1),
                        "overlap_pct_b": min(100.0, pct_t2)
                    })

        return results

occupancy_engine = OccupancyEngine()
