from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.services.external_adapters import external_data_manager

router = APIRouter(prefix="/external", tags=["External Data Adapters"])

@router.get("/weather")
def get_weather_data(db: Session = Depends(get_db)):
    return external_data_manager.get_cached_or_fetch(db, "weather")

@router.get("/gis")
def get_gis_layers(db: Session = Depends(get_db)):
    return external_data_manager.get_cached_or_fetch(db, "gis")
