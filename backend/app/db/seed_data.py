import json
import math
import shutil
from datetime import datetime, timezone, timedelta
from pathlib import Path
from PIL import Image as PILImage, ImageDraw, ImageFont
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_password_hash
from app.db.models import (
    User, CameraStation, CameraDeployment, SurveyEffort, Image,
    Detection, Tiger, TigerImage, TigerEmbedding, TigerSighting,
    OccupancyResult, Alert, ReviewTask, AuditLog, ExternalDataSource
)
from app.ml.stripe_embedder import stripe_embedder
from app.services.occupancy import occupancy_engine

def generate_sample_image(
    file_path: Path,
    title: str,
    img_type: str = "tiger",
    station_code: str = "ST-01",
    timestamp: datetime = None
):
    """Generates a realistic mock camera-trap image with dark forest palette and camera watermark."""
    width, height = 1280, 720
    dt_str = (timestamp or datetime.now(timezone.utc)).strftime("%Y-%m-%d %H:%M:%S")
    
    # Background forest color
    if img_type == "tiger":
        bg_color = (25, 45, 25) # Deep forest green
    elif img_type == "blank":
        bg_color = (35, 55, 30) # Foliage
    elif img_type == "human":
        bg_color = (30, 40, 35) # Forest path
    else:
        bg_color = (30, 35, 30)

    img = PILImage.new("RGB", (width, height), bg_color)
    draw = ImageDraw.Draw(img)

    # Draw natural habitat foliage background
    for i in range(0, width, 40):
        shade = 20 + (i % 25)
        draw.line([(i, height), (i + 15, height // 3)], fill=(shade, shade + 20, shade), width=4)

    # If tiger: draw realistic tiger body silhouette with amber coat and black stripes
    if img_type == "tiger":
        # Body oval (amber)
        body_box = [width // 4, height // 3, width * 3 // 4, height * 4 // 5]
        draw.ellipse(body_box, fill=(215, 115, 20)) # Rufous tiger amber
        
        # Head
        head_box = [width * 3 // 4 - 50, height // 3 - 40, width * 3 // 4 + 100, height // 2 + 30]
        draw.ellipse(head_box, fill=(210, 110, 15))
        
        # White belly contour
        belly_box = [width // 4 + 40, height * 3 // 5, width * 3 // 4 - 40, height * 4 // 5 - 10]
        draw.ellipse(belly_box, fill=(240, 235, 220))
        
        # Distinctive Black Flank Stripes
        stripe_color = (15, 15, 15)
        for sx in range(width // 4 + 80, width * 3 // 4 - 80, 45):
            draw.line([(sx, height // 3 + 30), (sx - 15, height * 3 // 5 + 20)], fill=stripe_color, width=14)
            draw.line([(sx + 15, height // 3 + 60), (sx + 2, height * 3 // 5)], fill=stripe_color, width=10)

    elif img_type == "human":
        # Human silhouette
        draw.ellipse([width // 2 - 40, height // 4, width // 2 + 40, height // 4 + 80], fill=(180, 140, 110))
        draw.rectangle([width // 2 - 60, height // 4 + 85, width // 2 + 60, height * 3 // 4], fill=(40, 70, 120))

    # Camera trap metadata data-strip bar (standard Cuddeback / Reconyx layout)
    draw.rectangle([0, height - 50, width, height], fill=(10, 10, 10))
    watermark_text = f"PENCH TIGER RESERVE | {station_code} | {dt_str} | 26°C | CUDDEBACK C1 #8492"
    draw.text((20, height - 38), watermark_text, fill=(240, 240, 240))
    draw.text((20, 25), f"SAMPLE CAPTURE: {title}", fill=(200, 230, 200))

    file_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(file_path, "JPEG", quality=85)
    return file_path

def seed_database(db: Session):
    """Initializes the complete Pench Tiger Reserve baseline dataset."""
    
    # 1. Users
    if db.query(User).count() == 0:
        users = [
            User(
                email="admin@pench.gov.in",
                full_name="Dr. Shubham Sharma (Field Director)",
                hashed_password=get_password_hash("pench123"),
                role="admin"
            ),
            User(
                email="biologist@pench.gov.in",
                full_name="Priya Sengupta (Wildlife Biologist)",
                hashed_password=get_password_hash("pench123"),
                role="biologist"
            ),
            User(
                email="staff@pench.gov.in",
                full_name="Rajesh Uikey (Turia Range Forest Officer)",
                hashed_password=get_password_hash("pench123"),
                role="forest_staff"
            ),
            User(
                email="reviewer@pench.gov.in",
                full_name="Amitabh Verma (Camera Trap Data Analyst)",
                hashed_password=get_password_hash("pench123"),
                role="reviewer"
            )
        ]
        db.add_all(users)
        db.commit()

    # 2. Camera Stations (Pench Core & Buffer Grid)
    if db.query(CameraStation).count() == 0:
        stations_data = [
            ("ST-01", "Baghin Nala Crossing", 21.7584, 79.3142, "core", "Turia Range", False, None),
            ("ST-02", "Jhandi Matta Waterhole", 21.7821, 79.3385, "core", "Turia Range", False, None),
            ("ST-03", "Alikatta Machaan Junction", 21.7450, 79.3080, "core", "Turia Range", False, None),
            ("ST-04", "Chhindimatta Fireline", 21.7250, 79.4420, "core", "Karmajhiri Range", False, None),
            ("ST-05", "Pyorthadi Stream Point", 21.8310, 79.2850, "core", "Karmajhiri Range", False, None),
            ("ST-06", "Mahadev Ghat Bank", 21.7920, 79.4050, "core", "Jamtara Range", False, None),
            ("ST-07", "Bodanala Water Point", 21.8150, 79.3750, "core", "Jamtara Range", False, None),
            ("ST-08", "Gumtara Buffer North", 21.7120, 79.2350, "buffer", "Gumtara Buffer", True, "Gumtara"),
            ("ST-09", "Telia Lake Fringe", 21.6420, 79.3580, "buffer", "Telia Buffer", True, "Telia"),
            ("ST-10", "Karmajhiri Village Edge", 21.8280, 79.2780, "buffer", "Karmajhiri Buffer", True, "Karmajhiri"),
            ("ST-11", "Kurai Corridor Crossing", 21.6150, 79.4950, "corridor", "Kurai Range", True, "Kurai"),
            ("ST-12", "Totladoh Reservoir Shore", 21.7710, 79.2950, "core", "Turia Range", False, None),
            ("ST-13", "Sitaghat Stream Nala", 21.7640, 79.3280, "core", "Turia Range", False, None),
            ("ST-14", "Raiyakhor Ridge", 21.8450, 79.3200, "core", "Karmajhiri Range", False, None),
            ("ST-15", "Kumbhadeo Trail", 21.7750, 79.3850, "core", "Jamtara Range", False, None),
            ("ST-16", "Turia Gate Boundary Road", 21.6780, 79.3420, "buffer", "Turia Buffer", True, "Turia")
        ]

        now = datetime.now(timezone.utc)
        stations = []
        for code, name, lat, lon, zone, beat, is_vill, vill_name in stations_data:
            st = CameraStation(
                code=code,
                name=name,
                latitude=lat,
                longitude=lon,
                zone=zone,
                range_beat=beat,
                is_village_adjacent=is_vill,
                adjacent_village_name=vill_name,
                status="active"
            )
            stations.append(st)
        db.add_all(stations)
        db.commit()

        # Add deployments and survey effort
        all_st = db.query(CameraStation).all()
        for idx, st in enumerate(all_st):
            # Deployment
            deploy = CameraDeployment(
                station_id=st.id,
                camera_serial=f"CUDD-PTR-{8400 + idx}",
                camera_model="Cuddeback C1 Color",
                install_date=now - timedelta(days=90 if idx != 7 else 5), # ST-08 recently deployed!
                battery_level=92 - (idx % 15),
                status="deployed"
            )
            db.add(deploy)

            # Survey Effort (Trap-nights)
            survey = SurveyEffort(
                station_id=st.id,
                year=2026,
                season="Winter-Spring",
                active_trap_nights=90 if idx != 7 else 5,
                operational_days=88 if idx != 7 else 5,
                downtime_days=2 if idx != 7 else 0,
                notes="Phase-IV National Tiger Monitoring Protocol grid"
            )
            db.add(survey)
        db.commit()

    # 3. Persistent Tiger Catalogue & Profiles
    if db.query(Tiger).count() == 0:
        tigers_data = [
            ("PTR-T-014", "Baghin Nala Female", "Female", "Adult (6 yrs)", "resident", "Core (Turia)", 21.7610, 79.3190, 24.5, "Dominant breeding female of Turia core territory."),
            ("PTR-T-032", "Collarwali Lineage Male", "Male", "Adult (7 yrs)", "resident", "Core (Turia-Karmajhiri)", 21.7750, 79.3120, 38.2, "Prime territorial male covering central Pench."),
            ("PTR-T-048", "Raiyakhor Dominant Male", "Male", "Adult (5 yrs)", "resident", "Core (Karmajhiri)", 21.8380, 79.3150, 32.0, "Northern core dominant male with distinctive double-fork flank stripe."),
            ("PTR-T-009", "Jamtara Tigress", "Female", "Adult (4 yrs)", "resident", "Core (Jamtara)", 21.8020, 79.3900, 21.8, "Eastern core resident female around Bodanala."),
            ("PTR-T-021", "Telia Dispersing Male", "Male", "Sub-Adult (2.5 yrs)", "transient", "Buffer (Telia)", 21.6550, 79.3520, 18.0, "Young male dispersing toward southern buffer edge."),
            ("PTR-T-055", "Gumtara Buffer Tigress", "Female", "Adult (4 yrs)", "resident", "Buffer (Gumtara)", 21.7150, 79.2380, 19.4, "Buffer resident tigress near western fringe."),
            ("PTR-T-NEW-0102", "Provisional Individual (T-NEW-0102)", "Unknown", "Sub-Adult", "provisional", "Core (Turia)", 21.7580, 79.3140, 8.5, "Awaiting formal review confirmation.")
        ]

        now = datetime.now(timezone.utc)
        tigers_list = []
        for code, callsign, sex, age, status, zone, lat, lon, area, notes in tigers_data:
            t = Tiger(
                tiger_code=code,
                callsign=callsign,
                sex=sex,
                age_class=age,
                status=status,
                primary_zone=zone,
                centroid_lat=lat,
                centroid_lon=lon,
                territory_area_km2=area,
                first_seen=now - timedelta(days=400),
                last_seen=now - timedelta(days=2 if "014" in code or "032" in code else 15),
                notes=notes,
                confidence=0.98 if status != "provisional" else 0.72
            )
            tigers_list.append(t)
        db.add_all(tigers_list)
        db.commit()

        # Generate sample tiger reference images & stripe embeddings
        tigers = db.query(Tiger).all()
        stations = db.query(CameraStation).all()
        st_map = {s.code: s for s in stations}

        for t in tigers:
            # Generate 2 reference images per tiger
            for flank in ["left", "right"]:
                img_path = settings.IMAGES_DIR / f"ref_{t.tiger_code}_{flank}.jpg"
                crop_path = settings.CROPS_DIR / f"crop_{t.tiger_code}_{flank}.jpg"
                
                generate_sample_image(
                    img_path,
                    f"Reference Profile: {t.callsign} ({flank.upper()} Flank)",
                    img_type="tiger",
                    station_code="ST-01",
                    timestamp=t.first_seen or now
                )
                
                shutil.copy2(img_path, crop_path)
                stripe_vec = stripe_embedder.extract_embedding(crop_path)

                db_img = Image(
                    file_hash=f"hash_{t.tiger_code}_{flank}",
                    filename=img_path.name,
                    original_path=str(img_path),
                    storage_path=str(img_path),
                    thumbnail_path=str(img_path),
                    station_id=stations[0].id,
                    captured_at=t.first_seen or now,
                    status="triaged",
                    is_quarantined=False
                )
                db.add(db_img)
                db.flush()

                t_img = TigerImage(
                    tiger_id=t.id,
                    image_id=db_img.id,
                    flank_side=flank,
                    crop_path=str(crop_path),
                    quality_score=0.95,
                    is_reference=True
                )
                db.add(t_img)
                db.flush()

                t_emb = TigerEmbedding(
                    tiger_id=t.id,
                    tiger_image_id=t_img.id,
                    embedding_json=json.dumps(stripe_vec),
                    model_version="stripe-embed-v2.1"
                )
                db.add(t_emb)

                # Add baseline sightings
                for s_offset in range(4):
                    st_choice = stations[(hash(t.tiger_code) + s_offset) % len(stations)]
                    s_time = now - timedelta(days=20 * s_offset + 2)
                    sighting = TigerSighting(
                        tiger_id=t.id,
                        image_id=db_img.id,
                        station_id=st_choice.id,
                        captured_at=s_time,
                        latitude=st_choice.latitude + ((s_offset % 2) * 0.003 - 0.0015),
                        longitude=st_choice.longitude + ((s_offset % 3) * 0.003 - 0.0015),
                        confidence=0.95,
                        is_verified=True,
                        notes="Standard seasonal monitoring record"
                    )
                    db.add(sighting)

        db.commit()

        # Calculate initial occupancy results
        for t in tigers:
            occupancy_engine.calculate_tiger_occupancy(db, t.id)

    # 4. Generate Pre-configured Realistic Alerts
    if db.query(Alert).count() == 0:
        t_014 = db.query(Tiger).filter(Tiger.tiger_code == "PTR-T-014").first()
        t_021 = db.query(Tiger).filter(Tiger.tiger_code == "PTR-T-021").first()
        st_08 = db.query(CameraStation).filter(CameraStation.code == "ST-08").first()
        st_09 = db.query(CameraStation).filter(CameraStation.code == "ST-09").first()

        if t_014 and st_08:
            alert1 = Alert(
                tiger_id=t_014.id,
                station_id=st_08.id,
                alert_type="buffer_movement",
                severity="HIGH",
                confidence=0.94,
                explanation_json=json.dumps({
                    "what_changed": "Tiger Baghin Nala Female (PTR-T-014) detected at Buffer Station ST-08 (Gumtara Buffer North).",
                    "why_it_matters": "Dominant Core female has shifted 5.2 km westward into the Gumtara buffer multi-use zone.",
                    "supporting_evidence": "Historical territory was 100% inside Turia Core. Sighting confirmed via left flank stripe match (94% confidence).",
                    "survey_effort": "Recently Deployed (<14 days)",
                    "is_effort_artifact": True,
                    "confidence": 0.94,
                    "location": "Gumtara Buffer (ST-08)"
                }),
                status="active"
            )
            db.add(alert1)

        if t_021 and st_09:
            alert2 = Alert(
                tiger_id=t_021.id,
                station_id=st_09.id,
                alert_type="village_incursion",
                severity="CRITICAL",
                confidence=0.97,
                explanation_json=json.dumps({
                    "what_changed": "Young male Telia Dispersing Male (PTR-T-021) captured at Telia Lake Fringe (ST-09).",
                    "why_it_matters": "Station is 1.1 km from Telia village boundary. Immediate patrol deployment recommended to prevent livestock conflict.",
                    "supporting_evidence": "Consecutive captures over 48 hours moving south-east along irrigation canal.",
                    "survey_effort": "Established Camera Station (90 trap-nights)",
                    "is_effort_artifact": False,
                    "confidence": 0.97,
                    "location": "Telia Village Fringe (ST-09)"
                }),
                status="active"
            )
            db.add(alert2)

        db.commit()

    # 5. Generate Review Tasks (Pending Human Reviews)
    if db.query(ReviewTask).count() == 0:
        ref_img = db.query(Image).first()
        t_048 = db.query(Tiger).filter(Tiger.tiger_code == "PTR-T-048").first()
        t_032 = db.query(Tiger).filter(Tiger.tiger_code == "PTR-T-032").first()

        if ref_img and t_048 and t_032:
            task1 = ReviewTask(
                task_type="tiger_id_ambiguity",
                image_id=ref_img.id,
                candidate_tiger_ids_json=json.dumps([t_048.id, t_032.id]),
                similarity_scores_json=json.dumps([0.76, 0.68]),
                status="pending",
                priority="high"
            )
            db.add(task1)

            task2 = ReviewTask(
                task_type="blank_quarantine",
                image_id=ref_img.id,
                status="pending",
                priority="medium"
            )
            db.add(task2)
            db.commit()

    # 6. Pre-generate Sample SD Card folders for Instant Ingestion Testing
    sd_root = settings.BASE_DIR.parent / "demo_sd_cards"
    b1 = sd_root / "batch_01_core_turia"
    b2 = sd_root / "batch_02_buffer_gumtara"
    b3 = sd_root / "batch_03_mixed_messy" / "DCIM" / "100EKTA"

    for b in [b1, b2, b3]:
        b.mkdir(parents=True, exist_ok=True)

    # Populate batch 1
    now = datetime.now(timezone.utc)
    generate_sample_image(b1 / "ST01_001_tiger.jpg", "Baghin Nala Crossing Tiger", "tiger", "ST-01", now - timedelta(hours=3))
    generate_sample_image(b1 / "ST01_002_blank.jpg", "Wind Blown Grass / Foliage", "blank", "ST-01", now - timedelta(hours=2))
    generate_sample_image(b1 / "ST01_003_tiger.jpg", "Tiger Right Flank Turn", "tiger", "ST-01", now - timedelta(hours=1))

    # Populate batch 2
    generate_sample_image(b2 / "ST08_001_buffer_tiger.jpg", "Buffer Zone Tiger", "tiger", "ST-08", now - timedelta(hours=5))
    generate_sample_image(b2 / "ST08_002_blank_branch.jpg", "Fallen Branch / Blank", "blank", "ST-08", now - timedelta(hours=4))
    generate_sample_image(b2 / "ST08_003_human_staff.jpg", "Patrol Staff Check", "human", "ST-08", now - timedelta(hours=3))

    # Populate batch 3 (Messy folder names, mixed timestamps)
    generate_sample_image(b3 / "IMG_4920.JPG", "Messy Card Tiger Sighting", "tiger", "ST-02", now - timedelta(days=1))
    generate_sample_image(b3 / "IMG_4921.JPG", "Messy Card Night Foliage", "blank", "ST-02", now - timedelta(days=1, hours=2))
    generate_sample_image(b3 / "IMG_4922.JPG", "Messy Card Animal Movement", "animal", "ST-02", now - timedelta(days=1, hours=4))

