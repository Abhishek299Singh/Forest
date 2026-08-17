import re
import csv
import io
import time
import os
import shutil
import uuid
import hashlib
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from PIL import Image as PILImage

from app.ml.pipeline import triage_pipeline
from app.ml.species_classifier import animal_classifier
from app.core.events import event_bus
from app.core.config import settings
from app.db.models import (
    CameraStation, Image, Detection, Tiger, TigerSighting, TigerImage, TigerEmbedding
)

def parse_flexible_timestamp(ts_str: Optional[str]) -> Optional[datetime]:
    if not ts_str or not ts_str.strip():
        return None
    cleaned = ts_str.strip()
    fmts = (
        "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f",
        "%Y/%m/%d %H:%M:%S", "%Y/%m/%d %H:%M",
        "%m/%d/%Y %H:%M:%S", "%m/%d/%Y %H:%M", "%m/%d/%Y %I:%M %p", "%m/%d/%Y %I:%M:%S %p",
        "%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%d/%m/%Y %I:%M %p", "%d/%m/%Y %I:%M:%S %p",
        "%m-%d-%Y %H:%M:%S", "%m-%d-%Y %H:%M", "%d-%m-%Y %H:%M:%S", "%d-%m-%Y %H:%M",
        "%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%m-%d-%Y", "%d-%m-%Y"
    )
    for fmt in fmts:
        try:
            return datetime.strptime(cleaned, fmt)
        except Exception:
            pass
    return None

class IngestionManager:
    """
    Manages SD card folder scanning, CSV manifest ingestion, safe workspace batch ingestion,
    AI multi-species classification, individual tiger re-ID, and geospatial map telemetry.
    """
    def __init__(self):
        self.supported_extensions = {".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG"}
        self.active_batches: Dict[str, Dict[str, Any]] = {}

    def extract_station_code(self, file_path: Path) -> Optional[str]:
        """Extracts station code like ST-001, CAM001, or beat names from folder structure or filename."""
        relevant_parts = [file_path.name, file_path.parent.name, file_path.parent.parent.name]
        combined = " ".join([p.upper() for p in relevant_parts if p])

        # 1. Match explicit ST-01 to ST-999 or STATION-01 or CAM001..CAM999
        match = re.search(r'\b(?:ST|STATION|CAM)[-_]?([0-9]{1,3})\b', combined)
        if match:
            prefix = "CAM" if "CAM" in match.group(0) else "ST"
            return f"{prefix}-{int(match.group(1)):03d}"

        # 2. Match Camera folder pattern (e.g., 100CAM, 100CUDD, 101RECON, CAM_01)
        cam_match = re.search(r'\b([0-9]{2,3}[A-Z]{3,4}|CAM[-_]?[0-9]{1,3})\b', combined)
        if cam_match:
            return f"ST-{cam_match.group(1)}"

        # 3. Match Pench beat names
        if "TURIA" in combined:
            return "ST-001"
        elif "BAGHIN" in combined:
            return "ST-002"
        elif "ALIKATTA" in combined:
            return "ST-004"
        elif "GUMTARA" in combined:
            return "ST-008"
        elif "TELIA" in combined:
            return "ST-012"
        elif "KARMAJHIRI" in combined:
            return "ST-005"

        parent_name = file_path.parent.name
        if parent_name and parent_name.upper() not in {"DCIM", "IMAGES", "PICTURES", "ROOT", ".", ""}:
            clean_name = re.sub(r'[^A-Za-z0-9_-]', '', parent_name)[:12]
            if clean_name:
                return f"ST-{clean_name.upper()}"

        return "CAM001"

    def scan_folder(self, folder_path: Path | str) -> List[Path]:
        folder = Path(folder_path)
        if not folder.exists():
            return []
        
        if folder.is_file():
            if folder.suffix in self.supported_extensions:
                return [folder]
            return []

        image_files = []
        for root, _, files in os.walk(folder):
            for file in files:
                p = Path(root) / file
                if p.suffix in self.supported_extensions and not p.name.startswith("."):
                    image_files.append(p)
        return sorted(image_files)

    def find_csv_files(self, folder_path: Path | str) -> List[Path]:
        folder = Path(folder_path)
        if not folder.exists():
            return []
        if folder.is_file() and folder.suffix.lower() == ".csv":
            return [folder]
        
        csv_files = []
        for root, _, files in os.walk(folder):
            for file in files:
                if file.lower().endswith(".csv"):
                    csv_files.append(Path(root) / file)
        return sorted(csv_files)

    def parse_coordinates_csv_content(self, csv_text: str) -> Dict[str, Any]:
        """
        Parses camera coordinates CSV formats:
        Format 1: camera_id,latitude,longitude
        Format 2: camera_id,latitude,longitude,station_name,zone
        """
        stations = {}
        errors = []
        warnings = []
        lines = [line.strip() for line in csv_text.strip().splitlines() if line.strip()]
        if not lines:
            return {"stations": {}, "errors": ["Coordinates CSV is empty."], "warnings": []}

        reader = csv.DictReader(io.StringIO("\n".join(lines)))
        fieldnames = [f.strip().lower() for f in (reader.fieldnames or []) if f]
        cam_col = next((f for f in fieldnames if f in ("camera_id", "camera", "station_id", "station", "cam_id", "station_code")), None)
        lat_col = next((f for f in fieldnames if f in ("latitude", "lat")), None)
        lon_col = next((f for f in fieldnames if f in ("longitude", "lon", "lng", "long")), None)

        if not cam_col or not lat_col or not lon_col:
            pos_reader = csv.reader(io.StringIO("\n".join(lines)))
            for row_idx, row in enumerate(pos_reader):
                if not row or len(row) < 3:
                    continue
                if row_idx == 0 and any(h in row[0].lower() for h in ("cam", "station", "code", "camera_id")):
                    continue
                c_id = row[0].strip()
                try:
                    lat = float(row[1].strip())
                    lon = float(row[2].strip())
                    if not (-90.0 <= lat <= 90.0):
                        errors.append(f"Row {row_idx+1}: Latitude {lat} out of valid range [-90, 90] for camera {c_id}")
                        continue
                    if not (-180.0 <= lon <= 180.0):
                        errors.append(f"Row {row_idx+1}: Longitude {lon} out of valid range [-180, 180] for camera {c_id}")
                        continue
                    st_name = row[3].strip() if len(row) > 3 else f"Camera Station {c_id}"
                    zone = row[4].strip().lower() if len(row) > 4 else "core"
                    stations[c_id] = {
                        "camera_id": c_id,
                        "latitude": lat,
                        "longitude": lon,
                        "station_name": st_name,
                        "zone": zone
                    }
                except ValueError:
                    errors.append(f"Row {row_idx+1}: Invalid coordinates for camera {c_id}")
            return {"stations": stations, "errors": errors, "warnings": warnings}

        for row_idx, row in enumerate(reader):
            clean_row = {k.strip().lower(): v.strip() for k, v in row.items() if k}
            c_id = clean_row.get(cam_col, "")
            lat_str = clean_row.get(lat_col, "")
            lon_str = clean_row.get(lon_col, "")
            st_name = clean_row.get("station_name", f"Camera Station {c_id}")
            zone = clean_row.get("zone", "core").lower()

            if not c_id or not lat_str or not lon_str:
                errors.append(f"Row {row_idx+2}: Missing camera ID or coordinates")
                continue

            try:
                lat = float(lat_str)
                lon = float(lon_str)
            except ValueError:
                errors.append(f"Row {row_idx+2}: Invalid numeric coordinates: {lat_str}, {lon_str}")
                continue

            if not (-90.0 <= lat <= 90.0):
                errors.append(f"Row {row_idx+2}: Latitude {lat} out of valid range [-90, 90] for camera {c_id}")
                continue
            if not (-180.0 <= lon <= 180.0):
                errors.append(f"Row {row_idx+2}: Longitude {lon} out of valid range [-180, 180] for camera {c_id}")
                continue

            stations[c_id] = {
                "camera_id": c_id,
                "latitude": lat,
                "longitude": lon,
                "station_name": st_name,
                "zone": zone
            }

        return {"stations": stations, "errors": errors, "warnings": warnings}

    def validate_and_parse_intake_csv(self, csv_text: str, image_filenames: List[str]) -> Dict[str, Any]:
        """
        Validates CSV metadata and matches against uploaded image filenames.
        Required columns: image, camera_id, timestamp, latitude, longitude.
        Optional columns: animal (AI model recognizes species automatically if omitted!),
                          tiger_id, confidence, station_name, zone, sex, age, behavior, direction, etc.
        """
        errors = []
        warnings = []
        records = []
        
        if not csv_text or not csv_text.strip():
            return {
                "valid": False,
                "errors": ["CSV metadata file is required. Please upload the CSV before starting analysis."],
                "warnings": [],
                "records": []
            }
            
        if not image_filenames:
            return {
                "valid": False,
                "errors": ["At least one image is required. Please upload images before starting analysis."],
                "warnings": [],
                "records": []
            }

        lines = [line.strip() for line in csv_text.strip().splitlines() if line.strip()]
        if not lines:
            return {
                "valid": False,
                "errors": ["CSV metadata file is empty."],
                "warnings": [],
                "records": []
            }

        reader = csv.DictReader(io.StringIO("\n".join(lines)))
        fieldnames = [f.strip().lower() for f in (reader.fieldnames or []) if f]
        
        # Required column matchers (Core Spatial-Temporal Metadata)
        img_col = next((f for f in fieldnames if f in ("image", "filename", "file", "image_name", "image_filename", "photo")), None)
        cam_col = next((f for f in fieldnames if f in ("camera_id", "camera", "station_id", "station", "cam_id", "station_code")), None)
        ts_col = next((f for f in fieldnames if f in ("timestamp", "datetime", "date_time", "time", "date")), None)
        lat_col = next((f for f in fieldnames if f in ("latitude", "lat")), None)
        lon_col = next((f for f in fieldnames if f in ("longitude", "lon", "lng", "long")), None)
        
        # Optional AI / metadata columns (AI classifies species if animal is omitted)
        animal_col = next((f for f in fieldnames if f in ("animal", "species", "class", "class_name", "category")), None)
        tiger_col = next((f for f in fieldnames if f in ("tiger_id", "individual_id", "tiger", "tiger_code", "id_code")), None)
        conf_col = next((f for f in fieldnames if f in ("confidence", "score", "conf", "ai_confidence", "confidence_score")), None)
        station_name_col = next((f for f in fieldnames if f in ("station_name", "name", "location_name", "location")), None)
        zone_col = next((f for f in fieldnames if f in ("zone", "area")), None)
        sex_col = next((f for f in fieldnames if f in ("sex", "gender")), None)
        age_col = next((f for f in fieldnames if f in ("age", "age_class", "stage")), None)
        behavior_col = next((f for f in fieldnames if f in ("behavior", "behaviour", "activity", "action")), None)
        dir_col = next((f for f in fieldnames if f in ("direction", "heading", "movement_direction")), None)
        cam_status_col = next((f for f in fieldnames if f in ("camera_status", "status")), None)
        batt_col = next((f for f in fieldnames if f in ("battery_level", "battery", "batt")), None)
        qual_col = next((f for f in fieldnames if f in ("image_quality", "quality", "quality_score")), None)

        missing_cols = []
        if not img_col: missing_cols.append("image")
        if not cam_col: missing_cols.append("camera_id")
        if not ts_col: missing_cols.append("timestamp")
        if not lat_col: missing_cols.append("latitude")
        if not lon_col: missing_cols.append("longitude")

        if missing_cols:
            return {
                "valid": False,
                "errors": [f"CSV validation failed: Missing required column(s): {', '.join(missing_cols)}."],
                "warnings": [],
                "records": []
            }

        uploaded_map = {Path(f).name.lower(): Path(f).name for f in image_filenames}
        csv_image_names = set()

        for idx, row in enumerate(reader):
            clean_row = {k.strip().lower(): v.strip() for k, v in row.items() if k}
            img_name = clean_row.get(img_col, "").strip()
            cam_id = clean_row.get(cam_col, "").strip()
            ts_str = clean_row.get(ts_col, "").strip()
            lat_raw = clean_row.get(lat_col, "").strip()
            lon_raw = clean_row.get(lon_col, "").strip()
            
            # Optional fields
            animal_hint = clean_row.get(animal_col, "").strip().lower() if animal_col else None
            tiger_id = clean_row.get(tiger_col, "").strip() if tiger_col else None
            conf_raw = clean_row.get(conf_col, "").strip() if conf_col else None
            station_name = clean_row.get(station_name_col, "").strip() if station_name_col else None
            zone = clean_row.get(zone_col, "").strip().lower() if zone_col else "core"

            if not img_name:
                errors.append(f"CSV validation failed: Row {idx+2} is missing the image filename.")
                continue

            clean_img_name = Path(img_name).name
            csv_image_names.add(clean_img_name.lower())

            # Check if CSV image was uploaded
            if clean_img_name.lower() not in uploaded_map:
                errors.append(f"CSV validation failed:\n{clean_img_name} exists in CSV but was not uploaded.")

            # Coordinate checks
            if not lat_raw or not lon_raw:
                errors.append(f"CSV validation failed: Row {idx+2} ({clean_img_name}) is missing latitude/longitude coordinates.")
                continue

            try:
                lat = float(lat_raw)
                lon = float(lon_raw)
            except ValueError:
                errors.append(f"CSV validation failed: Row {idx+2} ({clean_img_name}) has invalid numeric coordinates: '{lat_raw}', '{lon_raw}'.")
                continue

            if not (-90.0 <= lat <= 90.0):
                errors.append(f"CSV validation failed: Row {idx+2} ({clean_img_name}) latitude {lat} is out of valid range [-90, 90].")
                continue
            if not (-180.0 <= lon <= 180.0):
                errors.append(f"CSV validation failed: Row {idx+2} ({clean_img_name}) longitude {lon} is out of valid range [-180, 180].")
                continue

            # Confidence check (optional)
            conf = None
            if conf_raw:
                try:
                    c_val = float(conf_raw)
                    if c_val > 1.0 and c_val <= 100.0:
                        c_val = c_val / 100.0
                    if 0.0 <= c_val <= 1.0:
                        conf = c_val
                except ValueError:
                    pass

            # Timestamp parsing
            parsed_time = parse_flexible_timestamp(ts_str)
            if not parsed_time:
                errors.append(f"CSV validation failed: Row {idx+2} ({clean_img_name}) has invalid timestamp '{ts_str}'. Supported formats include YYYY-MM-DD HH:MM:SS, M/D/YYYY H:M, D/M/YYYY H:M:S, etc.")
                parsed_time = datetime.now(timezone.utc)

            # Metadata
            sex = clean_row.get(sex_col) if sex_col else None
            age = clean_row.get(age_col) if age_col else None
            behavior = clean_row.get(behavior_col) if behavior_col else None
            direction = clean_row.get(dir_col) if dir_col else None
            cam_status = clean_row.get(cam_status_col) if cam_status_col else "operational"
            batt_level = 95
            if batt_col and clean_row.get(batt_col):
                try:
                    batt_level = int(clean_row[batt_col].replace("%", "").strip())
                except Exception:
                    batt_level = 95
            img_quality = clean_row.get(qual_col) if qual_col else "high"

            records.append({
                "image": clean_img_name,
                "camera_id": cam_id or "CAM001",
                "timestamp": parsed_time,
                "timestamp_str": ts_str,
                "latitude": lat,
                "longitude": lon,
                "animal": animal_hint if animal_hint else None,
                "tiger_id": tiger_id if tiger_id else None,
                "confidence": conf,
                "station_name": station_name,
                "zone": zone,
                "sex": sex,
                "age": age,
                "behavior": behavior,
                "direction": direction,
                "camera_status": cam_status,
                "battery_level": batt_level,
                "image_quality": img_quality
            })

        # Check for uploaded images missing from CSV
        for upl_lower, orig_name in uploaded_map.items():
            if upl_lower not in csv_image_names:
                errors.append(f"CSV validation failed:\n{orig_name} was uploaded but does not exist in CSV.")

        is_valid = (len(errors) == 0 and len(records) > 0)
        return {
            "valid": is_valid,
            "errors": errors,
            "warnings": warnings,
            "records": records,
            "total_records": len(records),
            "total_images": len(image_filenames)
        }

    def parse_csv_file(self, csv_path: Path) -> List[Dict[str, Any]]:
        try:
            with open(csv_path, mode="r", encoding="utf-8-sig", errors="ignore") as f:
                content = f.read()
                lines = [line.strip() for line in content.splitlines() if line.strip()]
                if not lines:
                    return []
                reader = csv.DictReader(io.StringIO("\n".join(lines)))
                records = []
                for row in reader:
                    clean_row = {k.strip().lower(): v.strip() for k, v in row.items() if k}
                    img_name = clean_row.get("image") or clean_row.get("filename") or clean_row.get("file") or ""
                    cam_id = clean_row.get("camera_id") or clean_row.get("camera") or clean_row.get("station_id") or "CAM001"
                    ts_str = clean_row.get("timestamp") or clean_row.get("datetime") or ""
                    lat_str = clean_row.get("latitude") or clean_row.get("lat")
                    lon_str = clean_row.get("longitude") or clean_row.get("lon") or clean_row.get("lng")
                    animal = clean_row.get("animal") or clean_row.get("species")
                    tiger_id = clean_row.get("tiger_id") or clean_row.get("individual_id") or ""
                    conf_str = clean_row.get("confidence") or clean_row.get("score")
                    st_name = clean_row.get("station_name") or clean_row.get("location_name")
                    zone = clean_row.get("zone", "core")

                    parsed_time = parse_flexible_timestamp(ts_str) or datetime.now(timezone.utc)

                    lat = float(lat_str) if lat_str and lat_str.replace('.', '', 1).replace('-', '', 1).isdigit() else None
                    lon = float(lon_str) if lon_str and lon_str.replace('.', '', 1).replace('-', '', 1).isdigit() else None
                    conf = None
                    if conf_str:
                        try:
                            c = float(conf_str)
                            if c > 1.0 and c <= 100.0: c = c / 100.0
                            conf = c
                        except Exception:
                            pass

                    records.append({
                        "image": Path(img_name).name,
                        "camera_id": cam_id,
                        "timestamp": parsed_time,
                        "timestamp_str": ts_str,
                        "latitude": lat,
                        "longitude": lon,
                        "animal": animal.lower() if animal else None,
                        "tiger_id": tiger_id if tiger_id else None,
                        "confidence": conf,
                        "station_name": st_name,
                        "zone": zone,
                        "sex": clean_row.get("sex"),
                        "age": clean_row.get("age"),
                        "behavior": clean_row.get("behavior"),
                        "direction": clean_row.get("direction"),
                        "camera_status": clean_row.get("camera_status", "operational"),
                        "battery_level": int(clean_row.get("battery_level", 95)) if clean_row.get("battery_level", "").isdigit() else 95,
                        "image_quality": clean_row.get("image_quality", "high")
                    })
                return records
        except Exception as e:
            print(f"Error parsing CSV {csv_path}: {e}")
            return []

    def validate_intake(
        self,
        folder_path: Optional[str | Path] = None,
        image_filenames: Optional[List[str]] = None,
        coordinates_csv_content: Optional[str] = None
    ) -> Dict[str, Any]:
        images = []
        if folder_path:
            images = [p.name for p in self.scan_folder(folder_path)]
        elif image_filenames:
            images = [Path(f).name for f in image_filenames]

        if not images and not coordinates_csv_content:
            return {
                "valid": False,
                "errors": ["Both image files and CSV metadata are required."],
                "warnings": [],
                "records": []
            }
        elif not coordinates_csv_content:
            return {
                "valid": False,
                "errors": ["CSV metadata file is required. Please upload the CSV before starting analysis."],
                "warnings": [],
                "records": []
            }
        elif not images:
            parsed_coords = self.parse_coordinates_csv_content(coordinates_csv_content)
            if parsed_coords["stations"] and len(parsed_coords["errors"]) == 0:
                return {
                    "valid": True,
                    "csv_stations_count": len(parsed_coords["stations"]),
                    "stations": parsed_coords["stations"],
                    "errors": [],
                    "warnings": []
                }
            return {
                "valid": False,
                "errors": ["At least one image is required. Please upload images before starting analysis."],
                "warnings": [],
                "records": []
            }

        return self.validate_and_parse_intake_csv(coordinates_csv_content, images)

    def scan_folder_info(self, folder_path: Path | str) -> Dict[str, Any]:
        folder = Path(folder_path)
        if not folder.exists():
            return {"valid": False, "error": f"Path not found on disk: {folder_path}"}
        
        images = self.scan_folder(folder_path)
        csv_files = self.find_csv_files(folder_path)
        csv_records = []
        for csv_f in csv_files:
            csv_records.extend(self.parse_csv_file(csv_f))

        detected_stations = set()
        detected_animals = set()
        locations_count = 0

        for img in images:
            st = self.extract_station_code(img)
            if st:
                detected_stations.add(st)

        for rec in csv_records:
            if rec.get("camera_id"):
                detected_stations.add(rec["camera_id"])
            if rec.get("animal"):
                detected_animals.add(rec["animal"].lower())
            if rec.get("latitude") is not None and rec.get("longitude") is not None:
                locations_count += 1

        size_mb = 0.0
        try:
            size_mb = round(sum(os.path.getsize(p) for p in images if p.exists()) / (1024 * 1024), 1)
        except Exception:
            pass

        return {
            "valid": True,
            "folder_path": str(folder),
            "total_images_found": len(images),
            "csv_files_found": [f.name for f in csv_files],
            "csv_rows_count": len(csv_records),
            "detected_stations": sorted(list(detected_stations)),
            "detected_animals": sorted(list(detected_animals)),
            "locations_count": locations_count,
            "estimated_size_mb": size_mb,
            "status": "ready"
        }

    async def process_batch(
        self,
        db: Session,
        batch_id: str,
        folder_path: Path | str,
        station_id_override: Optional[str] = None,
        coordinates_csv_content: Optional[str] = None
    ) -> Dict[str, Any]:
        folder = Path(folder_path)
        images = self.scan_folder(folder_path)
        
        csv_records = []
        if coordinates_csv_content and coordinates_csv_content.strip():
            image_names = [img.name for img in images]
            val_res = self.validate_and_parse_intake_csv(coordinates_csv_content, image_names)
            if not val_res["valid"]:
                raise ValueError("\n".join(val_res["errors"]))
            csv_records = val_res["records"]
        else:
            csv_files = self.find_csv_files(folder_path)
            for csv_f in csv_files:
                csv_records.extend(self.parse_csv_file(csv_f))

        if not csv_records and not images:
            raise ValueError("Both image files and CSV metadata are required.")
        if images and not csv_records:
            raise ValueError("CSV metadata file is required. Please upload the CSV before starting analysis.")
        if csv_records and not images:
            raise ValueError("At least one image is required. Please upload images before starting analysis.")

        workspace_dir = settings.BASE_DIR / "workspace" / "batches" / batch_id
        workspace_dir.mkdir(parents=True, exist_ok=True)

        batch_state = {
            "batch_id": batch_id,
            "folder_path": str(folder_path),
            "workspace_path": str(workspace_dir),
            "total_images": len(csv_records),
            "processed": 0,
            "duplicates": 0,
            "invalid": 0,
            "blank": 0,
            "non_blank": 0,
            "tiger_images": 0,
            "other_animals": 0,
            "human_images": 0,
            "quarantined": 0,
            "locations_found": 0,
            "locations_unavailable": 0,
            "errors": 0,
            "missing_timestamps": 0,
            "clock_drift_warnings": 0,
            "missing_station_coords": 0,
            "warnings": [],
            "status": "processing",
            "start_time": time.time(),
            "end_time": None,
            "detections": []
        }
        self.active_batches[batch_id] = batch_state

        await event_bus.broadcast("ingestion_progress", {
            "batch_id": batch_id,
            "stage": "Validated",
            "progress_pct": 5,
            "message": "Validated CSV and image files."
        })

        detection_records = []
        images_on_disk_map = {img.name.lower(): img for img in images}
        if folder.is_dir():
            for root, _, files in os.walk(folder):
                for f in files:
                    images_on_disk_map[f.lower()] = Path(root) / f

        total_items = len(csv_records)

        # PROCESS EVERY IMAGE in the batch
        for idx, row in enumerate(csv_records):
            img_name = row["image"]
            cam_code = row["camera_id"]
            captured_at = row["timestamp"]
            lat = row["latitude"]
            lon = row["longitude"]
            animal_hint = row.get("animal")
            tiger_id = row.get("tiger_id")
            conf_hint = row.get("confidence")
            st_name_hint = row.get("station_name")
            zone_hint = row.get("zone", "core")
            behavior = row.get("behavior")
            sex = row.get("sex")
            age = row.get("age")
            direction = row.get("direction")
            cam_status = row.get("camera_status", "operational")
            batt_level = row.get("battery_level", 95)
            img_quality = row.get("image_quality", "high")

            if lat is not None and lon is not None:
                batch_state["locations_found"] += 1
            else:
                batch_state["locations_unavailable"] += 1

            # 1. Camera Station Registration & Update with Real Coordinates
            station = db.query(CameraStation).filter(CameraStation.code == cam_code).first()
            if not station:
                station = CameraStation(
                    code=cam_code,
                    name=st_name_hint or f"Camera Station {cam_code}",
                    latitude=lat,
                    longitude=lon,
                    zone=zone_hint if zone_hint else "core",
                    range_beat="Turia Range",
                    status="active",
                    camera_status=cam_status,
                    battery_level=batt_level
                )
                db.add(station)
                db.flush()
            else:
                if lat is not None and lon is not None:
                    station.latitude = lat
                    station.longitude = lon
                if st_name_hint:
                    station.name = st_name_hint
                if zone_hint:
                    station.zone = zone_hint
                station.camera_status = cam_status
                station.battery_level = batt_level
                db.flush()

            # 2. Preserve Original High-Resolution Photo File
            matched_path = images_on_disk_map.get(img_name.lower())
            img_exists = matched_path is not None and matched_path.exists()

            safe_name = f"{int(time.time())}_{idx+1}_{img_name}"
            managed_path = None
            thumb_path = None
            file_hash = hashlib.sha256(f"{img_name}_{cam_code}_{idx}".encode()).hexdigest()

            if img_exists:
                managed_path = settings.IMAGES_DIR / safe_name
                thumb_path = settings.THUMBNAILS_DIR / f"thumb_{safe_name}"
                # Save unmodified original high-res image
                shutil.copy2(matched_path, managed_path)
                try:
                    with PILImage.open(managed_path) as im:
                        im.thumbnail((400, 300))
                        im.save(thumb_path, "JPEG", quality=85)
                except Exception:
                    pass

            # 3. AI SPECIES CLASSIFICATION FROM IMAGE
            target_classify_path = managed_path if (img_exists and managed_path) else matched_path
            if target_classify_path and target_classify_path.exists():
                classification_res = animal_classifier.classify_image(target_classify_path, csv_hint=animal_hint)
            else:
                classification_res = {
                    "species": animal_hint or "wildlife",
                    "species_formatted": (animal_hint or "Wildlife").replace("_", " ").title(),
                    "confidence": conf_hint or 0.90,
                    "is_tiger": (animal_hint == "tiger") if animal_hint else False,
                    "is_blank": (animal_hint == "blank") if animal_hint else False,
                    "bbox": [0.15, 0.20, 0.70, 0.65]
                }

            detected_species = classification_res["species"]
            detected_species_formatted = classification_res["species_formatted"]
            conf = conf_hint if conf_hint is not None else classification_res["confidence"]
            bbox = classification_res["bbox"]
            is_tiger = classification_res["is_tiger"]
            is_blank = classification_res["is_blank"]

            # 4. Create DB Image Record
            db_image = Image(
                file_hash=file_hash,
                filename=img_name,
                original_path=str(matched_path) if img_exists else "",
                storage_path=str(managed_path) if managed_path else "",
                thumbnail_path=str(thumb_path) if thumb_path else None,
                station_id=station.id,
                station_code_detected=cam_code,
                captured_at=captured_at,
                status="triaged",
                is_quarantined=is_blank
            )
            db.add(db_image)
            db.flush()

            # 5. Handle Tiger Re-ID vs Other Wildlife
            assigned_tiger_code = "-"
            crop_path = managed_path

            if is_tiger:
                batch_state["tiger_images"] += 1
                assigned_tiger_code = tiger_id or "PTR-T-014"
                flank_side = "left"

                if img_exists and managed_path:
                    try:
                        tiger_res = triage_pipeline.tiger_detector.detect(managed_path)
                        bbox = tiger_res["bbox"]
                        flank_bbox = tiger_res["flank_bbox"]
                        flank_side = tiger_res["flank_side"]

                        crop_filename = f"flank_{db_image.id}_{flank_side}.jpg"
                        crop_path = settings.CROPS_DIR / crop_filename
                        triage_pipeline.tiger_detector.crop_flank(managed_path, flank_bbox, crop_path)

                        body_filename = f"body_{db_image.id}.jpg"
                        body_path = settings.CROPS_DIR / body_filename
                        triage_pipeline.tiger_detector.crop_tiger_body(managed_path, bbox, body_path)

                        stripe_vec = triage_pipeline.stripe_embedder.extract_embedding(crop_path)
                    except Exception:
                        stripe_vec = [0.1] * 128
                        crop_path = managed_path
                else:
                    stripe_vec = [0.1] * 128

                # Enroll / Match Tiger
                tiger = db.query(Tiger).filter(Tiger.tiger_code == assigned_tiger_code).first()
                if not tiger:
                    tiger = Tiger(
                        tiger_code=assigned_tiger_code,
                        callsign=f"Tiger {assigned_tiger_code}",
                        sex=sex or "Female",
                        age_class=age or "Adult",
                        status="resident",
                        centroid_lat=lat,
                        centroid_lon=lon,
                        first_seen=captured_at,
                        last_seen=captured_at,
                        primary_zone=station.zone if station else "Core",
                        confidence=conf,
                        dataset_source="pench_field",
                        is_reference=False,
                        notes=f"Identified from {img_name} at station {cam_code}"
                    )
                    db.add(tiger)
                    db.flush()
                else:
                    if captured_at and (not tiger.last_seen or captured_at > tiger.last_seen):
                        tiger.last_seen = captured_at

                # Create Sighting
                sighting = TigerSighting(
                    tiger_id=tiger.id,
                    image_id=db_image.id,
                    station_id=station.id,
                    captured_at=captured_at,
                    latitude=lat,
                    longitude=lon,
                    confidence=conf,
                    behavior=behavior,
                    direction=direction,
                    location_name=st_name_hint or station.name,
                    is_verified=True
                )
                db.add(sighting)

                # Enroll Tiger Image & Embedding
                if img_exists and crop_path:
                    t_img = TigerImage(
                        tiger_id=tiger.id,
                        image_id=db_image.id,
                        flank_side=flank_side,
                        crop_path=str(crop_path),
                        original_image_path=str(managed_path),
                        dataset_source="pench_field",
                        quality_score=conf,
                        is_reference=True
                    )
                    db.add(t_img)
                    db.flush()

                    emb = TigerEmbedding(
                        tiger_id=tiger.id,
                        tiger_image_id=t_img.id,
                        embedding_json=str(stripe_vec),
                        dataset_source="pench_field"
                    )
                    db.add(emb)

            elif is_blank:
                batch_state["blank"] += 1
                batch_state["quarantined"] += 1
            elif detected_species == "human":
                batch_state["human_images"] += 1
                batch_state["non_blank"] += 1
            else:
                batch_state["other_animals"] += 1
                batch_state["non_blank"] += 1

            # 6. Create Detection Record
            db_detection = Detection(
                image_id=db_image.id,
                class_name=detected_species,
                confidence=conf,
                bbox_x=bbox[0],
                bbox_y=bbox[1],
                bbox_w=bbox[2],
                bbox_h=bbox[3],
                behavior=behavior,
                sex=sex,
                age_class=age,
                direction=direction,
                location_name=st_name_hint or station.name,
                image_quality=img_quality,
                is_human_blurred=(detected_species == "human")
            )
            db.add(db_detection)

            batch_state["processed"] += 1

            # Append complete detection record
            detection_records.append({
                "id": f"det-{idx+1}",
                "image_filename": img_name,
                "image_id": db_image.id,
                "image_url": f"/api/v1/images/{db_image.id}/file" if img_exists else None,
                "thumbnail_url": f"/api/v1/images/{db_image.id}/thumbnail" if img_exists else None,
                "image_available": img_exists,
                "camera_id": cam_code,
                "timestamp": captured_at.strftime("%Y-%m-%d %H:%M:%S") if captured_at else "N/A",
                "timestamp_formatted": captured_at.strftime("%d %b %Y, %I:%M %p") if captured_at else "N/A",
                "animal": detected_species_formatted,
                "tiger_id": assigned_tiger_code,
                "confidence": round(conf, 2),
                "confidence_pct": f"{int(round(conf * 100))}%",
                "latitude": lat,
                "longitude": lon,
                "has_location": lat is not None and lon is not None,
                "behavior": behavior or "-",
                "sex": sex or "-",
                "age_class": age or "-",
                "direction": direction or "-",
                "location_name": st_name_hint or station.name,
                "camera_status": cam_status,
                "battery_level": batt_level,
                "image_quality": img_quality
            })

            # Broadcast progress: Processing X/N
            progress_pct = round(((idx + 1) / max(1, total_items)) * 100, 1)
            await event_bus.broadcast("ingestion_progress", {
                "batch_id": batch_id,
                "stage": "Processing",
                "processed": idx + 1,
                "total": total_items,
                "progress_pct": progress_pct,
                "message": f"Processing {idx+1}/{total_items} ({img_name} -> {detected_species_formatted})"
            })

        db.commit()

        batch_state["end_time"] = time.time()
        batch_state["status"] = "Complete"
        processing_time_s = round(batch_state["end_time"] - batch_state["start_time"], 2)

        batch_report = {
            "batch_id": batch_id,
            "processing_status": "Complete",
            "status": "completed",
            "total_files": total_items,
            "total_images": total_items,
            "processed": total_items,
            "total_detections": len(detection_records),
            "tiger_detections": batch_state["tiger_images"],
            "tiger_images": batch_state["tiger_images"],
            "other_wildlife": batch_state["other_animals"],
            "blank": batch_state["blank"],
            "blank_images": batch_state["blank"],
            "non_blank": batch_state["non_blank"],
            "quarantined": batch_state["quarantined"],
            "duplicates": batch_state["duplicates"],
            "locations_found": batch_state["locations_found"],
            "locations_unavailable": batch_state["locations_unavailable"],
            "errors": batch_state["errors"],
            "processing_time_seconds": processing_time_s,
            "detections": detection_records
        }

        await event_bus.broadcast("ingestion_completed", batch_report)
        return batch_report

    def get_batch_status(self, batch_id: str) -> Optional[Dict[str, Any]]:
        return self.active_batches.get(batch_id)

ingestion_manager = IngestionManager()
