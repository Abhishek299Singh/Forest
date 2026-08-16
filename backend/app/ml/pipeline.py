import os
import time
import json
import shutil
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional
from PIL import Image as PILImage, ImageFilter
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import (
    Image, Detection, Tiger, TigerImage, TigerEmbedding, TigerSighting,
    ReviewTask, CameraStation, AuditLog
)
from app.ml.blank_detector import blank_classifier
from app.ml.tiger_detector import tiger_detector
from app.ml.stripe_embedder import stripe_embedder
from app.ml.matcher import tiger_matcher

class TriagePipeline:
    """
    End-to-end Automated Triage and Tiger Identification Pipeline.
    """
    def __init__(self):
        self.blank_classifier = blank_classifier
        self.tiger_detector = tiger_detector
        self.stripe_embedder = stripe_embedder
        self.matcher = tiger_matcher

    def generate_thumbnail(self, src_path: Path | str, dest_path: Path | str, size=(400, 300)):
        try:
            with PILImage.open(src_path) as img:
                img.thumbnail(size)
                img.save(dest_path, "JPEG", quality=80)
        except Exception:
            pass

    def apply_privacy_blur(self, src_path: Path | str, dest_path: Path | str):
        """Applies privacy blur for human detections."""
        try:
            with PILImage.open(src_path) as img:
                blurred = img.filter(ImageFilter.GaussianBlur(radius=15))
                blurred.save(dest_path, "JPEG", quality=85)
        except Exception:
            shutil.copy2(src_path, dest_path)

    def process_image(
        self,
        db: Session,
        image_path: Path | str,
        station_id: Optional[str] = None,
        station_code_hint: Optional[str] = None,
        captured_at_hint: Optional[datetime] = None
    ) -> Dict[str, Any]:
        start_time = time.time()
        path = Path(image_path)
        if not path.exists():
            return {"status": "error", "error": f"File not found: {image_path}"}

        # 1. Compute file hash
        sha256 = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                sha256.update(chunk)
        file_hash = sha256.hexdigest()

        # Check for duplicates
        existing_img = db.query(Image).filter(Image.file_hash == file_hash).first()
        if existing_img:
            return {
                "status": "duplicate",
                "image_id": existing_img.id,
                "filename": existing_img.filename,
                "file_hash": file_hash,
                "message": "Image already exists in database."
            }

        # 2. Extract dimensions and EXIF timestamp
        captured_at = captured_at_hint or datetime.now(timezone.utc)
        width, height = 1920, 1080
        exif_dict = {}
        has_exif_timestamp = False
        has_clock_drift = False

        try:
            with PILImage.open(path) as img:
                width, height = img.size
                exif = getattr(img, "_getexif", lambda: None)()
                if exif:
                    # Tag 36867 = DateTimeOriginal, 306 = DateTime
                    exif_time = exif.get(36867) or exif.get(306)
                    if exif_time:
                        try:
                            parsed_time = datetime.strptime(str(exif_time), "%Y:%m:%d %H:%M:%S")
                            captured_at = parsed_time
                            has_exif_timestamp = True
                            
                            # Check clock drift (> 1 year past or future from 2026 baseline)
                            if abs((parsed_time.year - datetime.now().year)) > 2:
                                has_clock_drift = True
                        except Exception:
                            has_exif_timestamp = False
                    for k, v in exif.items():
                        if isinstance(v, (str, int, float)):
                            exif_dict[str(k)] = v
        except Exception:
            # Corrupted image -> quarantine
            pass

        # 3. Resolve Camera Station (Dynamic Registration from Folder/EXIF)
        station = None
        if station_id:
            station = db.query(CameraStation).filter(CameraStation.id == station_id).first()
        elif station_code_hint:
            station = db.query(CameraStation).filter(CameraStation.code == station_code_hint).first()
        
        if not station:
            st_code = station_code_hint or "ST-01"
            station = db.query(CameraStation).filter(CameraStation.code == st_code).first()
            if not station:
                zone = "core"
                path_lower = str(path).lower()
                if "buffer" in path_lower:
                    zone = "buffer"
                elif "corridor" in path_lower:
                    zone = "corridor"
                
                station = CameraStation(
                    code=st_code,
                    name=f"Camera Station {st_code}",
                    zone=zone,
                    latitude=None, # Only set if extracted from EXIF; never invent fake GPS
                    longitude=None,
                    status="active"
                )
                db.add(station)
                db.flush()

        # 4. Copy image to managed storage
        safe_filename = f"{int(time.time())}_{file_hash[:8]}_{path.name}"
        managed_storage_path = settings.IMAGES_DIR / safe_filename
        thumbnail_path = settings.IMAGES_DIR / f"thumb_{safe_filename}"
        
        shutil.copy2(path, managed_storage_path)
        self.generate_thumbnail(managed_storage_path, thumbnail_path)

        # 5. Run Stage 1: Blank Image Detection
        blank_res = self.blank_classifier.classify(managed_storage_path)
        class_name = blank_res["class_name"]
        confidence = blank_res["confidence"]
        is_blank = blank_res["is_blank"]

        is_quarantined = False
        quarantine_reason = None
        quarantine_path = None

        if is_blank:
            if blank_res["quarantine_action"] == "quarantine":
                is_quarantined = True
                quarantine_reason = f"Automated high-confidence blank image triage (Confidence: {int(confidence*100)}%)"
                q_dest = settings.QUARANTINE_DIR / safe_filename
                shutil.copy2(managed_storage_path, q_dest)
                quarantine_path = str(q_dest)
            elif blank_res["quarantine_action"] == "review":
                quarantine_reason = f"Ambiguous blank/vegetation - pending human review (Confidence: {int(confidence*100)}%)"

        # 6. Create Database Image Record
        db_image = Image(
            file_hash=file_hash,
            filename=path.name,
            original_path=str(path),
            storage_path=str(managed_storage_path),
            thumbnail_path=str(thumbnail_path),
            station_id=station.id if station else None,
            station_code_detected=station.code if station else station_code_hint,
            captured_at=captured_at,
            width=width,
            height=height,
            exif_data_json=json.dumps(exif_dict),
            status="quarantined" if is_quarantined else "triaged",
            is_quarantined=is_quarantined,
            quarantine_reason=quarantine_reason,
            quarantine_path=quarantine_path
        )
        db.add(db_image)
        db.flush()

        inference_time_ms = round((time.time() - start_time) * 1000, 2)

        # Handle Human Privacy
        is_human_blurred = False
        if class_name == "human":
            blurred_path = settings.IMAGES_DIR / f"blurred_{safe_filename}"
            self.apply_privacy_blur(managed_storage_path, blurred_path)
            db_image.storage_path = str(blurred_path)
            is_human_blurred = True

        # 7. Detection record
        bbox_x, bbox_y, bbox_w, bbox_h = 0.0, 0.0, 0.0, 0.0
        tiger_info = None

        if class_name == "tiger" or (class_name == "animal" and confidence > 0.8):
            # Run Stage 2: Tiger / Flank Detector
            tiger_res = self.tiger_detector.detect(managed_storage_path)
            bbox_x, bbox_y, bbox_w, bbox_h = tiger_res["bbox"]
            flank_bbox = tiger_res["flank_bbox"]
            flank_side = tiger_res["flank_side"]

            # Save flank crop & body crop from the actual camera photo
            crop_filename = f"flank_{db_image.id}_{flank_side}.jpg"
            crop_path = settings.CROPS_DIR / crop_filename
            self.tiger_detector.crop_flank(managed_storage_path, flank_bbox, crop_path)

            body_crop_filename = f"body_{db_image.id}.jpg"
            body_crop_path = settings.CROPS_DIR / body_crop_filename
            self.tiger_detector.crop_tiger_body(managed_storage_path, [bbox_x, bbox_y, bbox_w, bbox_h], body_crop_path)

            # Run Stage 3: Stripe Embedding Vectorizer
            stripe_vector = self.stripe_embedder.extract_embedding(crop_path)

            # Run Stage 4: Catalogue Matcher
            match_res = self.matcher.match_against_catalogue(db, stripe_vector, flank_side)
            decision = match_res["decision"]
            best_match = match_res.get("best_match")

            assigned_tiger = None
            if decision == "auto_accepted" and best_match:
                assigned_tiger = db.query(Tiger).filter(Tiger.id == best_match["tiger_id"]).first()
            elif decision == "ambiguous_review_required" or decision == "new_individual":
                # Create dynamic tiger identity if completely new
                if decision == "new_individual":
                    total_tigers = db.query(Tiger).count()
                    tiger_code = f"PTR-T-{total_tigers + 1:03d}"
                    callsign = f"Individual {tiger_code}"
                    assigned_tiger = Tiger(
                        tiger_code=tiger_code,
                        callsign=callsign,
                        sex="Unknown",
                        age_class="Adult",
                        status="resident" if confidence >= 0.85 else "provisional",
                        first_seen=captured_at,
                        last_seen=captured_at,
                        primary_zone=station.zone if station else "Core",
                        confidence=round(confidence, 3),
                        notes=f"Auto-enrolled from SD card intake at station {station.code if station else 'N/A'}."
                    )
                    db.add(assigned_tiger)
                    db.flush()

                # Add to Human Review Task Queue if ambiguous
                if decision == "ambiguous_review_required":
                    candidates_list = [c["tiger_id"] for c in match_res.get("top_candidates", [])]
                    scores_list = [c["similarity"] for c in match_res.get("top_candidates", [])]
                    review_task = ReviewTask(
                        task_type="tiger_id_ambiguity",
                        image_id=db_image.id,
                        candidate_tiger_ids_json=json.dumps(candidates_list),
                        similarity_scores_json=json.dumps(scores_list),
                        priority="high"
                    )
                    db.add(review_task)

            # Store Tiger Image Crop & Embedding
            if assigned_tiger:
                existing_ref_count = db.query(TigerImage).filter(TigerImage.tiger_id == assigned_tiger.id).count()
                is_ref = (existing_ref_count == 0) or (confidence >= 0.85)

                t_img = TigerImage(
                    tiger_id=assigned_tiger.id,
                    image_id=db_image.id,
                    flank_side=flank_side,
                    crop_path=str(crop_path),
                    quality_score=round(confidence, 3),
                    is_reference=is_ref
                )
                db.add(t_img)
                db.flush()

                t_emb = TigerEmbedding(
                    tiger_id=assigned_tiger.id,
                    tiger_image_id=t_img.id,
                    embedding_json=json.dumps(stripe_vector),
                    model_version=self.stripe_embedder.model_version
                )
                db.add(t_emb)

                # Add Tiger Sighting
                if station:
                    sighting = TigerSighting(
                        tiger_id=assigned_tiger.id,
                        image_id=db_image.id,
                        station_id=station.id,
                        captured_at=captured_at,
                        latitude=station.latitude,
                        longitude=station.longitude,
                        confidence=round(confidence, 3),
                        is_verified=(decision == "auto_accepted"),
                        notes=f"Sighting via automated camera trap triage. Match decision: {decision}"
                    )
                    db.add(sighting)

                    # Update tiger last seen
                    cap_naive = captured_at.replace(tzinfo=None) if captured_at.tzinfo else captured_at
                    fs_naive = assigned_tiger.first_seen.replace(tzinfo=None) if (assigned_tiger.first_seen and getattr(assigned_tiger.first_seen, 'tzinfo', None)) else assigned_tiger.first_seen
                    ls_naive = assigned_tiger.last_seen.replace(tzinfo=None) if (assigned_tiger.last_seen and getattr(assigned_tiger.last_seen, 'tzinfo', None)) else assigned_tiger.last_seen

                    if not fs_naive or cap_naive < fs_naive:
                        assigned_tiger.first_seen = cap_naive
                    if not ls_naive or cap_naive > ls_naive:
                        assigned_tiger.last_seen = cap_naive

            tiger_info = {
                "decision": decision,
                "assigned_tiger_id": assigned_tiger.id if assigned_tiger else None,
                "tiger_code": assigned_tiger.tiger_code if assigned_tiger else None,
                "callsign": assigned_tiger.callsign if assigned_tiger else None,
                "flank_side": flank_side,
                "top_candidates": match_res.get("top_candidates", [])[:3]
            }

        detection = Detection(
            image_id=db_image.id,
            class_name=class_name,
            confidence=round(confidence, 3),
            bbox_x=bbox_x,
            bbox_y=bbox_y,
            bbox_w=bbox_w,
            bbox_h=bbox_h,
            is_human_blurred=is_human_blurred,
            model_version=self.blank_classifier.model_version,
            inference_time_ms=inference_time_ms
        )
        db.add(detection)

        # Audit log entry
        audit = AuditLog(
            actor_id="TriagePipeline-AI",
            actor_role="system",
            action="image_triaged",
            entity_type="image",
            entity_id=db_image.id,
            details_json=json.dumps({
                "class_name": class_name,
                "confidence": confidence,
                "is_quarantined": is_quarantined,
                "tiger_info": tiger_info
            })
        )
        db.add(audit)
        db.commit()

        return {
            "status": "success",
            "image_id": db_image.id,
            "filename": db_image.filename,
            "class_name": class_name,
            "confidence": confidence,
            "is_blank": is_blank,
            "is_quarantined": is_quarantined,
            "has_exif_timestamp": has_exif_timestamp,
            "has_clock_drift": has_clock_drift,
            "privacy_protection_applied": is_human_blurred,
            "tiger_info": tiger_info,
            "inference_time_ms": inference_time_ms
        }

triage_pipeline = TriagePipeline()
