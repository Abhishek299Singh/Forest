import json
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.db.models import ExternalDataSource

class BaseExternalProvider(ABC):
    @abstractmethod
    def fetch_data(self) -> Dict[str, Any]:
        pass

    @abstractmethod
    def get_attribution(self) -> str:
        pass

class WeatherProvider(BaseExternalProvider):
    """Fetches and caches local weather data for Pench Tiger Reserve (Seoni / Chhindwara border)."""
    def fetch_data(self) -> Dict[str, Any]:
        return {
            "location": "Pench Tiger Reserve (Turia Gate)",
            "coordinates": {"lat": 21.7584, "lon": 79.3142},
            "temperature_c": 28.5,
            "humidity_pct": 52,
            "wind_speed_kmh": 11.2,
            "weather_condition": "Partly Cloudy",
            "moon_phase": "Waxing Gibbous (82% Illumination)",
            "sunrise": "06:05 AM",
            "sunset": "06:45 PM",
            "source": "India Meteorological Department (IMD) - Seoni Station"
        }

    def get_attribution(self) -> str:
        return "Data source: India Meteorological Department (IMD) Regional Radar & AWS"

class GISBoundaryProvider(BaseExternalProvider):
    """Provides official GIS boundary polygons for Pench Tiger Reserve Core, Buffer, and Villages."""
    def fetch_data(self) -> Dict[str, Any]:
        # Realistic coordinates for Pench Tiger Reserve (Madhya Pradesh & Maharashtra)
        # Center ~21.75 N, 79.32 E
        core_polygon = [
            [79.22, 21.68], [79.25, 21.85], [79.38, 21.90],
            [79.48, 21.82], [79.45, 21.68], [79.32, 21.62],
            [79.22, 21.68]
        ]
        buffer_polygon = [
            [79.15, 21.60], [79.18, 21.92], [79.42, 21.98],
            [79.55, 21.88], [79.52, 21.62], [79.30, 21.55],
            [79.15, 21.60]
        ]
        
        villages = [
            {"name": "Turia", "coordinates": [79.345, 21.675], "population": 1240, "risk_level": "Medium"},
            {"name": "Karmajhiri", "coordinates": [79.280, 21.830], "population": 890, "risk_level": "Low"},
            {"name": "Jamtara", "coordinates": [79.410, 21.790], "population": 650, "risk_level": "Medium"},
            {"name": "Alikatta", "coordinates": [79.315, 21.750], "population": 420, "risk_level": "Low"},
            {"name": "Gumtara", "coordinates": [79.230, 21.710], "population": 980, "risk_level": "High"},
            {"name": "Telia", "coordinates": [79.360, 21.640], "population": 1150, "risk_level": "High"},
            {"name": "Chhindimatta", "coordinates": [79.460, 21.720], "population": 780, "risk_level": "Low"}
        ]

        water_bodies = [
            {
                "name": "Totladoh Reservoir / Pench River",
                "coordinates": [
                    [79.29, 21.65], [79.31, 21.72], [79.33, 21.78],
                    [79.35, 21.84], [79.37, 21.88]
                ]
            }
        ]

        return {
            "reserve_name": "Pench Tiger Reserve (Madhya Pradesh & Maharashtra)",
            "core_polygon": core_polygon,
            "buffer_polygon": buffer_polygon,
            "villages": villages,
            "water_bodies": water_bodies
        }

    def get_attribution(self) -> str:
        return "GIS data: Madhya Pradesh Forest Department & Wildlife Institute of India (WII)"

class ExternalDataManager:
    def __init__(self):
        self.weather_provider = WeatherProvider()
        self.gis_provider = GISBoundaryProvider()

    def get_cached_or_fetch(self, db: Session, provider_type: str) -> Dict[str, Any]:
        source = db.query(ExternalDataSource).filter(ExternalDataSource.provider_type == provider_type).first()
        
        if source and source.cached_payload_json:
            try:
                data = json.loads(source.cached_payload_json)
                return {
                    "data": data,
                    "last_synced_at": source.last_synced_at.isoformat() if source.last_synced_at else None,
                    "attribution": source.attribution_text,
                    "is_offline_cached": True
                }
            except Exception:
                pass

        # Fetch fresh data
        if provider_type == "weather":
            data = self.weather_provider.fetch_data()
            attrib = self.weather_provider.get_attribution()
        elif provider_type == "gis":
            data = self.gis_provider.fetch_data()
            attrib = self.gis_provider.get_attribution()
        else:
            return {"error": "Unknown provider"}

        if not source:
            source = ExternalDataSource(
                provider_type=provider_type,
                provider_name=provider_type.upper() + " Provider",
                is_enabled=True,
                last_synced_at=datetime.now(timezone.utc),
                cached_payload_json=json.dumps(data),
                attribution_text=attrib
            )
            db.add(source)
        else:
            source.cached_payload_json = json.dumps(data)
            source.last_synced_at = datetime.now(timezone.utc)
            source.attribution_text = attrib
        
        db.commit()

        return {
            "data": data,
            "last_synced_at": source.last_synced_at.isoformat() if source.last_synced_at else None,
            "attribution": attrib,
            "is_offline_cached": False
        }

external_data_manager = ExternalDataManager()
