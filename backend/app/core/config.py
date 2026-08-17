import os
from typing import Optional
from pathlib import Path
from pydantic import BaseModel

_BASE_DIR = Path(__file__).resolve().parent.parent.parent
(_BASE_DIR / "data").mkdir(parents=True, exist_ok=True)

class Settings(BaseModel):
    PROJECT_NAME: str = "Pench Wildlife Intelligence Platform"
    VERSION: str = "2.5.0"
    API_V1_STR: str = "/api/v1"
    
    # Mode
    IS_OFFLINE_MODE: bool = True
    DEVICE_ID: str = "PTR-TURIA-LAPTOP-01"
    
    # Base Dir
    BASE_DIR: Path = _BASE_DIR
    
    # Database URL
    DATABASE_URL: str = f"sqlite:///{_BASE_DIR.as_posix()}/data/pench_offline.db"
    SQLITE_DB_PATH: str = str(_BASE_DIR / "data" / "pench_offline.db")
    
    # Storage Paths
    BASE_STORAGE_PATH: str = "data"
    IMAGE_STORAGE_PATH: str = "data/images"
    QUARANTINE_PATH: str = "data/quarantine"
    CROPS_PATH: str = "data/crops"
    
    # Security
    SECRET_KEY: str = "pench-reserve-secret-key-production-offline-token-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    
    # --- AI Triage & Ecological Movement Threshold Policies ---
    # 1. Blank vs Animal Triage
    BLANK_CONFIDENCE_THRESHOLD: float = 0.70  # >= 70% blankness moved to Quarantine Vault
    BLANK_UNCERTAIN_LOWER: float = 0.40
    
    # 2. Tiger Flank Stripe Re-Identification (Asymmetric Lateral Stripes)
    TIGER_AUTO_MATCH_THRESHOLD: float = 0.85  # >= 85% cosine similarity -> Auto-accepted
    TIGER_AMBIGUOUS_LOWER_THRESHOLD: float = 0.50  # 50% - 85% -> Routed to Human Review Studio
    TIGER_AMBIGUOUS_THRESHOLD: float = 0.50
    # < 50% -> Provisional Individual (PTR-T-NEW-XXXX)
    
    # 3. Minimum Observations for Scientific Home Range (MCP 95%)
    MIN_OBSERVATIONS_FOR_MCP: int = 5  # Scientifically defensible minimum sightings for convex hull
    
    # 4. Movement Deviation Alert Thresholds (Aligned with Pench Ecological Zones)
    CORE_CENTROID_SHIFT_THRESHOLD_KM: float = 4.5   # Core sanctuary territory radius (~15-20 sq km territory)
    CENTROID_SHIFT_THRESHOLD_KM: float = 4.5
    BUFFER_MOVEMENT_THRESHOLD_KM: float = 5.0       # Buffer zone expansion threshold (explicit 5.0 km)
    VILLAGE_PROXIMITY_THRESHOLD_KM: float = 1.5     # Critical human-wildlife conflict interface boundary
    PROLONGED_ABSENCE_DAYS: int = 45                # NTCA Phase-IV 45-day survey window
    SURVEY_EFFORT_BASELINE_DAYS: int = 14           # Minimum camera trap-nights before movement alert triggers
    SURVEY_EFFORT_MIN_DAYS: int = 14
    
    # Privacy Protection
    BLUR_HUMAN_FACES: bool = True

    @property
    def IMAGES_DIR(self) -> Path:
        p = self.BASE_DIR / self.IMAGE_STORAGE_PATH
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def QUARANTINE_DIR(self) -> Path:
        p = self.BASE_DIR / self.QUARANTINE_PATH
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def CROPS_DIR(self) -> Path:
        p = self.BASE_DIR / self.CROPS_PATH
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def THUMBNAILS_DIR(self) -> Path:
        p = self.BASE_DIR / "data/thumbnails"
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def REFERENCE_GALLERY_DIR(self) -> Path:
        p = self.BASE_DIR / "data/reference_gallery"
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def WORKSPACE_DIR(self) -> Path:
        p = self.BASE_DIR / "workspace"
        p.mkdir(parents=True, exist_ok=True)
        return p

settings = Settings()
