import os
from pathlib import Path
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
IMAGES_DIR = DATA_DIR / "images"
QUARANTINE_DIR = DATA_DIR / "quarantine"
CROPS_DIR = DATA_DIR / "crops"
EXPORT_DIR = DATA_DIR / "exports"

for d in [DATA_DIR, IMAGES_DIR, QUARANTINE_DIR, CROPS_DIR, EXPORT_DIR]:
    d.mkdir(parents=True, exist_ok=True)

class Settings(BaseModel):
    PROJECT_NAME: str = "Pench Tiger Reserve - Wildlife Intelligence System"
    VERSION: str = "2.4.0"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "pench_reserve_super_secret_jwt_key_2026_!#@")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days for field laptops
    
    # Offline SQLite Database by default, fallback / switchable to PostgreSQL
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR}/pench_offline.db")
    CENTRAL_DATABASE_URL: str = os.getenv("CENTRAL_DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/pench_central")
    
    # Offline / Device identity
    DEVICE_ID: str = os.getenv("DEVICE_ID", "PENCH-FIELD-LAPTOP-01")
    IS_OFFLINE_MODE: bool = True
    
    # ML & Triage Policy Thresholds (Configurable)
    BLANK_CONFIDENCE_THRESHOLD: float = 0.70  # >= 0.70 moves to quarantine
    BLANK_UNCERTAIN_LOWER: float = 0.40       # 0.40 - 0.70 goes to Human Review
    TIGER_AUTO_MATCH_THRESHOLD: float = 0.85  # >= 0.85 auto assigned
    TIGER_AMBIGUOUS_THRESHOLD: float = 0.50   # 0.50 - 0.85 goes to Human Review
    
    # Movement & Alert Engine Thresholds (Configurable Policy)
    CENTROID_SHIFT_THRESHOLD_KM: float = 4.0      # ~15-20 sq km territory shift
    BUFFER_MOVEMENT_THRESHOLD_KM: float = 3.5     # Movement toward buffer zone
    VILLAGE_PROXIMITY_THRESHOLD_KM: float = 1.5   # Incursion near human settlements
    PROLONGED_ABSENCE_DAYS: int = 45              # Resident tiger absence threshold
    SURVEY_EFFORT_MIN_DAYS: int = 14              # Trap-nights needed to establish baseline

    # Paths
    BASE_DIR: Path = BASE_DIR
    DATA_DIR: Path = DATA_DIR
    IMAGES_DIR: Path = IMAGES_DIR
    QUARANTINE_DIR: Path = QUARANTINE_DIR
    CROPS_DIR: Path = CROPS_DIR
    EXPORT_DIR: Path = EXPORT_DIR

settings = Settings()
