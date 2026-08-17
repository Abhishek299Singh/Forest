import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text, DateTime, ForeignKey, Index
)
from sqlalchemy.orm import relationship
from app.db.database import Base

def generate_uuid():
    return str(uuid.uuid4())

def get_utc_now():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    firebase_uid = Column(String(128), unique=True, index=True, nullable=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), default="ranger")  # admin, ranger, biologist, reviewer
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=get_utc_now)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now)

class CameraStation(Base):
    __tablename__ = "camera_stations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    code = Column(String(50), unique=True, index=True, nullable=False)  # e.g., "ST-014"
    name = Column(String(255), default="Camera Station")
    latitude = Column(Float, nullable=True)                           # e.g., 21.7584 (None if missing from EXIF)
    longitude = Column(Float, nullable=True)                          # e.g., 79.3142
    zone = Column(String(50), default="core")                          # "core", "buffer", "corridor"
    range_beat = Column(String(100), default="Turia Range")
    habitat = Column(String(100), default="Dry Deciduous Forest")
    elevation_m = Column(Float, default=450.0)
    status = Column(String(50), default="active")                      # "active", "maintenance", "inactive"
    camera_status = Column(String(50), default="operational")          # "operational", "low_battery", "offline"
    battery_level = Column(Integer, default=95)
    is_village_adjacent = Column(Boolean, default=False)
    adjacent_village_name = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=get_utc_now)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now)

    deployments = relationship("CameraDeployment", back_populates="station", cascade="all, delete-orphan")
    images = relationship("Image", back_populates="station")
    sightings = relationship("TigerSighting", back_populates="station")
    survey_efforts = relationship("SurveyEffort", back_populates="station", cascade="all, delete-orphan")

class CameraDeployment(Base):
    __tablename__ = "camera_deployments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    station_id = Column(String(36), ForeignKey("camera_stations.id"), nullable=False)
    camera_serial = Column(String(100), nullable=False)
    camera_model = Column(String(100), default="Cuddeback C1")
    install_date = Column(DateTime, nullable=False)
    removal_date = Column(DateTime, nullable=True)
    battery_level = Column(Integer, default=100)
    sd_card_id = Column(String(100), nullable=True)
    status = Column(String(50), default="deployed")
    created_at = Column(DateTime, default=get_utc_now)

    station = relationship("CameraStation", back_populates="deployments")

class SurveyEffort(Base):
    __tablename__ = "survey_effort"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    station_id = Column(String(36), ForeignKey("camera_stations.id"), nullable=False)
    year = Column(Integer, default=2026)
    season = Column(String(50), default="Winter")
    active_trap_nights = Column(Integer, default=30)
    operational_days = Column(Integer, default=30)
    downtime_days = Column(Integer, default=0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=get_utc_now)

    station = relationship("CameraStation", back_populates="survey_efforts")

class Image(Base):
    __tablename__ = "images"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    file_hash = Column(String(64), index=True, nullable=False)
    filename = Column(String(255), nullable=False)
    original_path = Column(Text, nullable=False)
    storage_path = Column(Text, nullable=False)
    thumbnail_path = Column(Text, nullable=True)
    station_id = Column(String(36), ForeignKey("camera_stations.id"), nullable=True)
    station_code_detected = Column(String(50), nullable=True)
    captured_at = Column(DateTime, nullable=False, index=True)
    width = Column(Integer, default=1920)
    height = Column(Integer, default=1080)
    exif_data_json = Column(Text, nullable=True)
    status = Column(String(50), default="triaged")  # raw, triaged, quarantined, reviewed, error
    is_quarantined = Column(Boolean, default=False, index=True)
    quarantine_reason = Column(String(255), nullable=True)
    quarantine_path = Column(Text, nullable=True)
    created_at = Column(DateTime, default=get_utc_now)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now)

    station = relationship("CameraStation", back_populates="images")
    detections = relationship("Detection", back_populates="image", cascade="all, delete-orphan")
    tiger_images = relationship("TigerImage", back_populates="image", cascade="all, delete-orphan")
    sightings = relationship("TigerSighting", back_populates="image", cascade="all, delete-orphan")

class Detection(Base):
    __tablename__ = "detections"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    image_id = Column(String(36), ForeignKey("images.id"), nullable=False)
    class_name = Column(String(50), nullable=False)  # blank, animal, tiger, human, other
    confidence = Column(Float, nullable=False)
    bbox_x = Column(Float, default=0.0)
    bbox_y = Column(Float, default=0.0)
    bbox_w = Column(Float, default=0.0)
    bbox_h = Column(Float, default=0.0)
    is_human_blurred = Column(Boolean, default=False)
    behavior = Column(String(100), nullable=True)
    sex = Column(String(50), nullable=True)
    age_class = Column(String(50), nullable=True)
    direction = Column(String(50), nullable=True)
    location_name = Column(String(255), nullable=True)
    image_quality = Column(String(50), nullable=True)
    model_version = Column(String(50), default="pench-triage-v2.1")
    inference_time_ms = Column(Float, default=12.5)
    created_at = Column(DateTime, default=get_utc_now)

    image = relationship("Image", back_populates="detections")

class Tiger(Base):
    __tablename__ = "tigers"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tiger_code = Column(String(50), unique=True, index=True, nullable=False)  # e.g., "PTR-T-014"
    callsign = Column(String(100), nullable=False)                           # e.g., "Baghin Nala Female"
    sex = Column(String(10), default="Female")                               # "Male", "Female", "Unknown"
    age_class = Column(String(50), default="Adult")                          # "Adult", "Sub-Adult", "Cub"
    status = Column(String(50), default="resident")                          # "resident", "transient", "provisional", "dispersed"
    first_seen = Column(DateTime, nullable=True)
    last_seen = Column(DateTime, nullable=True)
    primary_zone = Column(String(50), default="Core (Turia)")
    confidence = Column(Float, default=0.98)
    notes = Column(Text, nullable=True)
    dataset_source = Column(String(50), default="pench_field")  # "amur_atrw", "pench_field"
    is_reference = Column(Boolean, default=False)
    territory_area_km2 = Column(Float, default=0.0)
    centroid_lat = Column(Float, nullable=True)
    centroid_lon = Column(Float, nullable=True)
    created_at = Column(DateTime, default=get_utc_now)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now)

    tiger_images = relationship("TigerImage", back_populates="tiger", cascade="all, delete-orphan")
    sightings = relationship("TigerSighting", back_populates="tiger", cascade="all, delete-orphan")
    occupancy_results = relationship("OccupancyResult", back_populates="tiger", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="tiger", cascade="all, delete-orphan")

class TigerImage(Base):
    __tablename__ = "tiger_images"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tiger_id = Column(String(36), ForeignKey("tigers.id"), nullable=False)
    image_id = Column(String(36), ForeignKey("images.id"), nullable=False)
    flank_side = Column(String(20), default="left")  # left, right, frontal, unknown
    crop_path = Column(Text, nullable=False)
    original_image_path = Column(Text, nullable=True)
    dataset_source = Column(String(50), default="pench_field")  # "amur_atrw", "pench_field"
    quality_score = Column(Float, default=0.88)
    is_reference = Column(Boolean, default=False)
    created_at = Column(DateTime, default=get_utc_now)

    tiger = relationship("Tiger", back_populates="tiger_images")
    image = relationship("Image", back_populates="tiger_images")
    embeddings = relationship("TigerEmbedding", back_populates="tiger_image", cascade="all, delete-orphan")

class TigerEmbedding(Base):
    __tablename__ = "tiger_embeddings"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tiger_id = Column(String(36), ForeignKey("tigers.id"), nullable=False)
    tiger_image_id = Column(String(36), ForeignKey("tiger_images.id"), nullable=False)
    embedding_json = Column(Text, nullable=False)  # Stored float vector (128-dim)
    dataset_source = Column(String(50), default="pench_field")  # "amur_atrw", "pench_field"
    model_version = Column(String(50), default="stripe-embed-v2")
    created_at = Column(DateTime, default=get_utc_now)

    tiger_image = relationship("TigerImage", back_populates="embeddings")

class TigerSighting(Base):
    __tablename__ = "tiger_sightings"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tiger_id = Column(String(36), ForeignKey("tigers.id"), nullable=False)
    image_id = Column(String(36), ForeignKey("images.id"), nullable=False)
    station_id = Column(String(36), ForeignKey("camera_stations.id"), nullable=True)
    captured_at = Column(DateTime, nullable=False, index=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    confidence = Column(Float, default=0.95)
    behavior = Column(String(100), nullable=True)
    direction = Column(String(50), nullable=True)
    location_name = Column(String(255), nullable=True)
    is_verified = Column(Boolean, default=True)
    verified_by = Column(String(100), default="System AI / Field Biologist")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=get_utc_now)

    tiger = relationship("Tiger", back_populates="sightings")
    image = relationship("Image", back_populates="sightings")
    station = relationship("CameraStation", back_populates="sightings")

class MovementRecord(Base):
    __tablename__ = "movement_records"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tiger_id = Column(String(36), ForeignKey("tigers.id"), nullable=False)
    from_station_id = Column(String(36), nullable=False)
    to_station_id = Column(String(36), nullable=False)
    from_time = Column(DateTime, nullable=False)
    to_time = Column(DateTime, nullable=False)
    distance_km = Column(Float, nullable=False)
    speed_kmh = Column(Float, default=0.0)
    zone_transition = Column(String(100), nullable=True)  # e.g., "Core -> Buffer"
    created_at = Column(DateTime, default=get_utc_now)

class OccupancyResult(Base):
    __tablename__ = "occupancy_results"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tiger_id = Column(String(36), ForeignKey("tigers.id"), nullable=False)
    calculation_date = Column(DateTime, default=get_utc_now)
    centroid_lat = Column(Float, nullable=False)
    centroid_lon = Column(Float, nullable=False)
    mcp_area_km2 = Column(Float, default=0.0)
    kde_area_km2 = Column(Float, default=0.0)
    stations_count = Column(Integer, default=0)
    sightings_count = Column(Integer, default=0)
    polygon_geojson = Column(Text, nullable=True)
    created_at = Column(DateTime, default=get_utc_now)

    tiger = relationship("Tiger", back_populates="occupancy_results")

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tiger_id = Column(String(36), ForeignKey("tigers.id"), nullable=True)
    station_id = Column(String(36), ForeignKey("camera_stations.id"), nullable=True)
    alert_type = Column(String(50), nullable=False)  # centroid_shift, buffer_movement, village_incursion, prolonged_absence, new_station
    severity = Column(String(20), default="HIGH")    # INFO, LOW, MEDIUM, HIGH, CRITICAL
    confidence = Column(Float, default=0.90)
    explanation_json = Column(Text, nullable=False)  # What changed, why it matters, survey effort, evidence
    status = Column(String(50), default="active")    # active, investigating, acknowledged, resolved, dismissed
    assigned_to = Column(String(100), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=get_utc_now, index=True)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now)

    tiger = relationship("Tiger", back_populates="alerts")

class ReviewTask(Base):
    __tablename__ = "review_tasks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    task_type = Column(String(50), nullable=False)  # tiger_id_ambiguity, blank_quarantine, metadata_correction, provisional_tiger
    image_id = Column(String(36), ForeignKey("images.id"), nullable=False)
    detection_id = Column(String(36), nullable=True)
    candidate_tiger_ids_json = Column(Text, nullable=True)
    similarity_scores_json = Column(Text, nullable=True)
    status = Column(String(50), default="pending")  # pending, approved, rejected, resolved
    priority = Column(String(20), default="medium") # low, medium, high, urgent
    created_at = Column(DateTime, default=get_utc_now)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now)

class ReviewDecision(Base):
    __tablename__ = "review_decisions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    task_id = Column(String(36), nullable=True)
    entity_type = Column(String(50), nullable=False)  # image, tiger, sighting, quarantine
    entity_id = Column(String(36), nullable=False)
    reviewer_id = Column(String(100), default="Field Biologist")
    action_taken = Column(String(100), nullable=False)  # confirm_tiger, reject, create_new_tiger, restore_from_quarantine, mark_as_blank
    old_value_json = Column(Text, nullable=True)
    new_value_json = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=get_utc_now)

class SyncOutbox(Base):
    __tablename__ = "sync_outbox"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(String(36), nullable=False)
    action = Column(String(20), nullable=False)  # insert, update, delete
    payload_json = Column(Text, nullable=False)
    version = Column(Integer, default=1)
    sync_status = Column(String(20), default="pending")  # pending, in_progress, synced, failed
    attempts = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    device_id = Column(String(100), default="PENCH-FIELD-LAPTOP-01")
    created_at = Column(DateTime, default=get_utc_now)
    synced_at = Column(DateTime, nullable=True)

class SyncInbox(Base):
    __tablename__ = "sync_inbox"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(String(36), nullable=False)
    action = Column(String(20), nullable=False)
    payload_json = Column(Text, nullable=False)
    version = Column(Integer, default=1)
    processed_status = Column(String(20), default="pending")  # pending, applied, conflict, error
    error_message = Column(Text, nullable=True)
    source_device_id = Column(String(100), nullable=True)
    received_at = Column(DateTime, default=get_utc_now)
    processed_at = Column(DateTime, nullable=True)

class SyncLog(Base):
    __tablename__ = "sync_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    sync_direction = Column(String(20), default="bidirectional")  # upload, download, bidirectional
    entities_count = Column(Integer, default=0)
    status = Column(String(20), default="success")  # success, partial, failed
    error_details = Column(Text, nullable=True)
    started_at = Column(DateTime, default=get_utc_now)
    completed_at = Column(DateTime, default=get_utc_now)

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    actor_id = Column(String(100), default="System")
    actor_role = Column(String(50), default="system")
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(String(36), nullable=False)
    details_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=get_utc_now, index=True)

class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String(100), primary_key=True)
    value_json = Column(Text, nullable=False)
    description = Column(String(255), nullable=True)
    updated_by = Column(String(100), default="admin")
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now)

class ExternalDataSource(Base):
    __tablename__ = "external_data_sources"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    provider_type = Column(String(50), nullable=False)  # weather, gis, station_telemetry, wildlife_feed
    provider_name = Column(String(100), nullable=False) # e.g. "IMD Seoni Weather Station", "Pench GIS Gateway"
    is_enabled = Column(Boolean, default=True)
    last_synced_at = Column(DateTime, nullable=True)
    cached_payload_json = Column(Text, nullable=True)
    attribution_text = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=get_utc_now)
