from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.db.database import engine, Base, SessionLocal
import app.db.models
from app.db.seed_data import seed_database

# Routers
from app.api.auth import router as auth_router
from app.api.images import router as images_router
from app.api.triage import router as triage_router
from app.api.tigers import router as tigers_router
from app.api.reviews import router as reviews_router
from app.api.stations import router as stations_router
from app.api.occupancy import router as occupancy_router
from app.api.alerts import router as alerts_router
from app.api.sync import router as sync_router
from app.api.external import router as external_router
from app.api.reports import router as reports_router
from app.api.ws import router as ws_router
from app.api.settings import router as settings_router

def ensure_sqlite_schema(db_engine):
    from sqlalchemy import text
    columns_to_ensure = [
        ("detections", "behavior", "TEXT"),
        ("detections", "sex", "TEXT"),
        ("detections", "age_class", "TEXT"),
        ("detections", "direction", "TEXT"),
        ("detections", "location_name", "TEXT"),
        ("detections", "image_quality", "TEXT"),
        ("tiger_sightings", "behavior", "TEXT"),
        ("tiger_sightings", "direction", "TEXT"),
        ("tiger_sightings", "location_name", "TEXT"),
        ("camera_stations", "camera_status", "TEXT DEFAULT 'operational'"),
        ("camera_stations", "battery_level", "INTEGER DEFAULT 95"),
    ]
    with db_engine.connect() as conn:
        for table, col, col_type in columns_to_ensure:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                conn.commit()
            except Exception:
                pass

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables
    Base.metadata.create_all(bind=engine)
    ensure_sqlite_schema(engine)
    # Seed baseline dataset
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    yield

app = FastAPI(
    title="Pench Tiger Reserve - Wildlife Intelligence System",
    description="Automated camera-trap triage, tiger flank stripe re-identification, home range estimation, survey-effort normalized movement alerts, and offline synchronization.",
    version=settings.VERSION,
    lifespan=lifespan
)

# Enable CORS for local Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers under API_V1_STR
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(images_router, prefix=settings.API_V1_STR)
app.include_router(triage_router, prefix=settings.API_V1_STR)
app.include_router(tigers_router, prefix=settings.API_V1_STR)
app.include_router(reviews_router, prefix=settings.API_V1_STR)
app.include_router(stations_router, prefix=settings.API_V1_STR)
app.include_router(occupancy_router, prefix=settings.API_V1_STR)
app.include_router(alerts_router, prefix=settings.API_V1_STR)
app.include_router(sync_router, prefix=settings.API_V1_STR)
app.include_router(external_router, prefix=settings.API_V1_STR)
app.include_router(reports_router, prefix=settings.API_V1_STR)
app.include_router(ws_router, prefix=settings.API_V1_STR)
app.include_router(settings_router, prefix=settings.API_V1_STR)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "system": "Pench Wildlife Intelligence Platform",
        "version": settings.VERSION,
        "mode": "Offline-First Local" if settings.IS_OFFLINE_MODE else "Online Cloud",
        "device_id": settings.DEVICE_ID
    }
