import re
import csv
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
from app.core.events import event_bus
from app.core.config import settings
from app.db.models import CameraStation, Image, Detection, Tiger, TigerSighting, TigerImage

class IngestionManager:
    """
    Manages SD card folder scanning, CSV manifest ingestion, safe workspace batch ingestion,
    progress tracking, and field data quality telemetry.
    Guarantees the original SD card is treated as strictly read-only source data.
    """
    def __init__(self):
        self.supported_extensions = {".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG"}
        self.active_batches: Dict[str, Dict[str, Any]] = {}

    def extract_station_code(self, file_path: Path) -> Optional[str]:
        """Extracts station code like ST-001, 100CAM, or beat names from folder structure or filename."""
        relevant_parts = [file_path.name, file_path.parent.name, file_path.parent.parent.name]
        combined = " ".join([p.upper() for p in relevant_parts if p])

        # 1. Match explicit ST-01 to ST-999 or STATION-01
        match = re.search(r'\b(?:ST|STATION)[-_]?([0-9]{1,3})\b', combined)
        if match:
            return f"ST-{int(match.group(1)):03d}"

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

        # 4. Fallback to immediate parent folder name if non-root
        parent_name = file_path.parent.name
        if parent_name and parent_name.upper() not in {"DCIM", "IMAGES", "PICTURES", "ROOT", ".", ""}:
            clean_name = re.sub(r'[^A-Za-z0-9_-]', '', parent_name)[:12]
            if clean_name:
                return f"ST-{clean_name.upper()}"

        return "ST-001"

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

    def parse_csv_file(self, csv_path: Path) -> List[Dict[str, Any]]:
        records = []
        try:
            with open(csv_path, mode="r", encoding="utf-8-sig", errors="ignore") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    # Clean keys
                    clean_row = {k.strip().lower(): v.strip() for k, v in row.items() if k}
                    
                    img_name = clean_row.get("image") or clean_row.get("filename") or clean_row.get("file") or ""
                    cam_id = clean_row.get("camera_id") or clean_row.get("camera") or clean_row.get("station_id") or clean_row.get("station") or "ST-001"
                    ts_str = clean_row.get("timestamp") or clean_row.get("datetime") or clean_row.get("date_time") or ""
                    lat_str = clean_row.get("latitude") or clean_row.get("lat")
                    lon_str = clean_row.get("longitude") or clean_row.get("lon") or clean_row.get("lng")
                    animal = clean_row.get("animal") or clean_row.get("species") or clean_row.get("class") or "wildlife"
                    tiger_id = clean_row.get("tiger_id") or clean_row.get("individual_id") or clean_row.get("tiger") or ""
                    conf_str = clean_row.get("confidence") or clean_row.get("score") or "0.90"

                    # Parse timestamp
                    parsed_time = datetime.now(timezone.utc)
                    if ts_str:
                        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y/%m/%d %H:%M:%S", "%Y-%m-%d"):
                            try:
                                parsed_time = datetime.strptime(ts_str, fmt)
                                break
                            except Exception:
                                pass

                    # Parse coordinates
                    lat = float(lat_str) if lat_str and lat_str.replace('.', '', 1).replace('-', '', 1).isdigit() else None
                    lon = float(lon_str) if lon_str and lon_str.replace('.', '', 1).replace('-', '', 1).isdigit() else None
                    
                    # Parse confidence
                    try:
                        conf = float(conf_str)
                    except Exception:
                        conf = 0.90

                    records.append({
                        "image": img_name,
                        "camera_id": cam_id,
                        "timestamp": parsed_time,
                        "timestamp_str": ts_str,
                        "latitude": lat,
                        "longitude": lon,
                        "animal": animal,
                        "tiger_id": tiger_id if tiger_id else None,
                        "confidence": conf
                    })
        except Exception as e:
            print(f"Error parsing CSV {csv_path}: {e}")
        return records

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

        import csv
        import io
        reader = csv.DictReader(io.StringIO("\n".join(lines)))
        
        # Check required columns
        fieldnames = [f.strip().lower() for f in (reader.fieldnames or []) if f]
        cam_col = next((f for f in fieldnames if f in ("camera_id", "camera", "station_id", "station", "cam_id", "station_code")), None)
        lat_col = next((f for f in fieldnames if f in ("latitude", "lat")), None)
        lon_col = next((f for f in fieldnames if f in ("longitude", "lon", "lng", "long")), None)

        if not cam_col or not lat_col or not lon_col:
            # Check if this is a 3-column headerless or positional CSV
            first_line_parts = [p.strip() for p in lines[0].split(",")]
            if len(first_line_parts) >= 3:
                # Re-parse as positional
                pos_reader = csv.reader(io.StringIO("\n".join(lines)))
                for row_idx, row in enumerate(pos_reader):
                    if not row or len(row) < 3:
                        continue
                    # Skip header if it contains text like 'camera' or 'latitude'
                    if row_idx == 0 and any(h in row[0].lower() for h in ("cam", "station", "code")):
                        continue
                    c_id = row[0].strip()
                    try:
                        lat = float(row[1].strip())
                        lon = float(row[2].strip())
                        if not (-90.0 <= lat <= 90.0) or not (-180.0 <= lon <= 180.0):
                            errors.append(f"Row {row_idx+1}: Coordinates out of range (lat: {lat}, lon: {lon}) for camera {c_id}")
                            continue
                        st_name = row[3].strip() if len(row) > 3 else f"Camera Station {c_id}"
                        zone = row[4].strip().lower() if len(row) > 4 else "core"
                        stations[c_id] = {
                            "camera_id": c_id,
                            "latitude": lat,
                            "longitude": lon,
                            "station_name": st_name,
                            "zone": zone if zone in ("core", "buffer", "corridor") else "core"
                        }
                    except ValueError:
                        if row_idx > 0:
                            errors.append(f"Row {row_idx+1}: Invalid coordinate numbers for camera {c_id}")
                return {"stations": stations, "errors": errors, "warnings": warnings}
            else:
                return {
                    "stations": {},
                    "errors": [f"Missing required columns in CSV. Required: camera_id, latitude, longitude. Found: {', '.join(fieldnames)}"],
                    "warnings": []
                }

        for idx, row in enumerate(reader):
            clean_row = {k.strip().lower(): v.strip() for k, v in row.items() if k}
            c_id = clean_row.get(cam_col, "").strip()
            if not c_id:
                warnings.append(f"Row {idx+2}: Missing camera ID, skipped.")
                continue

            lat_raw = clean_row.get(lat_col, "").strip()
            lon_raw = clean_row.get(lon_col, "").strip()

            if not lat_raw or not lon_raw:
                warnings.append(f"Row {idx+2} ({c_id}): Missing latitude/longitude values.")
                continue

            try:
                lat = float(lat_raw)
                lon = float(lon_raw)
            except ValueError:
                errors.append(f"Row {idx+2} ({c_id}): Non-numeric coordinates '{lat_raw}', '{lon_raw}'.")
                continue

            if not (-90.0 <= lat <= 90.0):
                errors.append(f"Row {idx+2} ({c_id}): Latitude {lat} out of valid range [-90, +90].")
                continue
            if not (-180.0 <= lon <= 180.0):
                errors.append(f"Row {idx+2} ({c_id}): Longitude {lon} out of valid range [-180, +180].")
                continue

            # Duplicate camera ID check
            if c_id in stations:
                prev = stations[c_id]
                if prev["latitude"] != lat or prev["longitude"] != lon:
                    warnings.append(f"Duplicate camera ID '{c_id}' with different coordinates: ({prev['latitude']}, {prev['longitude']}) vs ({lat}, {lon}). Using latest.")

            st_name = clean_row.get("station_name") or clean_row.get("name") or f"Camera Station {c_id}"
            zone = (clean_row.get("zone") or "core").strip().lower()

            stations[c_id] = {
                "camera_id": c_id,
                "latitude": lat,
                "longitude": lon,
                "station_name": st_name,
                "zone": zone if zone in ("core", "buffer", "corridor") else "core"
            }

        return {
            "stations": stations,
            "errors": errors,
            "warnings": warnings
        }

    def validate_intake(
        self,
        folder_path: Optional[str | Path] = None,
        coordinates_csv_content: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Validates the complete 3-step intake:
        1. Discovered images and folder structure
        2. Uploaded coordinates CSV validity
        3. Image -> Camera -> Coordinates matching rates
        """
        images = self.scan_folder(folder_path) if folder_path else []
        folder_stations = set()
        for img in images:
            st = self.extract_station_code(img)
            if st:
                folder_stations.add(st)

        csv_result = self.parse_coordinates_csv_content(coordinates_csv_content) if coordinates_csv_content else {"stations": {}, "errors": [], "warnings": []}
        csv_stations = csv_result["stations"]

        matched_stations = [s for s in folder_stations if s in csv_stations]
        unmatched_folder_stations = [s for s in folder_stations if s not in csv_stations]
        unmatched_csv_stations = [s for s in csv_stations if s not in folder_stations]

        warnings = list(csv_result.get("warnings", []))
        if unmatched_folder_stations and len(csv_stations) > 0:
            warnings.append(f"{len(unmatched_folder_stations)} camera folders ({', '.join(unmatched_folder_stations[:3])}) do not have coordinates in the CSV.")
        if unmatched_csv_stations and len(images) > 0:
            warnings.append(f"{len(unmatched_csv_stations)} camera stations listed in CSV have no matching photos in the selected folder.")

        is_valid = len(csv_result.get("errors", [])) == 0 and (len(images) > 0 or len(csv_stations) > 0)

        return {
            "valid": is_valid,
            "total_images": len(images),
            "total_stations_detected": len(folder_stations),
            "detected_stations": sorted(list(folder_stations)),
            "csv_stations_count": len(csv_stations),
            "matched_stations_count": len(matched_stations),
            "unmatched_folder_stations": sorted(unmatched_folder_stations),
            "unmatched_csv_stations": sorted(unmatched_csv_stations),
            "errors": csv_result.get("errors", []),
            "warnings": warnings
        }

    def scan_folder_info(self, folder_path: Path | str) -> Dict[str, Any]:
        folder = Path(folder_path)
        if not folder.exists():
            return {
                "valid": False,
                "error": f"Path not found on disk: {folder_path}"
            }
        
        images = self.scan_folder(folder_path)
        csv_files = self.find_csv_files(folder_path)
        csv_records = []
        for csv_f in csv_files:
            csv_records.extend(self.parse_csv_file(csv_f))

        detected_stations = set()
        detected_animals = set()
        locations_count = 0

        # From images
        for img in images:
            st = self.extract_station_code(img)
            if st:
                detected_stations.add(st)

        # From CSV
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
        csv_files = self.find_csv_files(folder_path)
        
        csv_records = []
        for csv_f in csv_files:
            csv_records.extend(self.parse_csv_file(csv_f))

        # Pre-seed Camera Stations from uploaded Coordinates CSV
        if coordinates_csv_content:
            coords_res = self.parse_coordinates_csv_content(coordinates_csv_content)
            for c_id, s_data in coords_res["stations"].items():
                station = db.query(CameraStation).filter(CameraStation.code == c_id).first()
                if not station:
                    station = CameraStation(
                        code=c_id,
                        name=s_data.get("station_name", f"Camera Station {c_id}"),
                        latitude=s_data.get("latitude"),
                        longitude=s_data.get("longitude"),
                        zone=s_data.get("zone", "core"),
                        range_beat="Turia Range",
                        status="active"
                    )
                    db.add(station)
                else:
                    station.latitude = s_data.get("latitude")
                    station.longitude = s_data.get("longitude")
                    if s_data.get("station_name"):
                        station.name = s_data["station_name"]
                    if s_data.get("zone"):
                        station.zone = s_data["zone"]
            db.flush()

        # 1. Create Safe Local Workspace
        workspace_dir = settings.BASE_DIR / "workspace" / "batches" / batch_id
        workspace_dir.mkdir(parents=True, exist_ok=True)
        (workspace_dir / "original").mkdir(parents=True, exist_ok=True)
        (workspace_dir / "processed").mkdir(parents=True, exist_ok=True)
        (workspace_dir / "quarantine").mkdir(parents=True, exist_ok=True)

        batch_state = {
            "batch_id": batch_id,
            "folder_path": str(folder_path),
            "workspace_path": str(workspace_dir),
            "total_images": len(images) + (len(csv_records) if not images else 0),
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

        # Status: Scanning -> Validated
        await event_bus.broadcast("ingestion_progress", {
            "batch_id": batch_id,
            "stage": "Validated",
            "progress_pct": 10,
            "message": "Validated folder and files"
        })

        detection_records = []

        # =========================================================================
        # CASE A: CSV Manifest Driven Ingestion
        # =========================================================================
        if csv_records:
            # Map of existing files on disk for fast matching
            images_on_disk_map = {img.name.lower(): img for img in images}
            if folder.is_dir():
                for root, _, files in os.walk(folder):
                    for f in files:
                        images_on_disk_map[f.lower()] = Path(root) / f

            total_items = len(csv_records)

            for idx, row in enumerate(csv_records):
                img_name = row["image"]
                cam_code = row["camera_id"]
                captured_at = row["timestamp"]
                lat = row["latitude"]
                lon = row["longitude"]
                animal = row["animal"].lower()
                tiger_id = row["tiger_id"]
                conf = row["confidence"]

                if lat is not None and lon is not None:
                    batch_state["locations_found"] += 1
                else:
                    batch_state["locations_unavailable"] += 1

                # 1. Resolve or Create Camera Station
                station = db.query(CameraStation).filter(CameraStation.code == cam_code).first()
                if not station:
                    station = CameraStation(
                        code=cam_code,
                        name=f"Camera Station {cam_code}",
                        latitude=lat,
                        longitude=lon,
                        zone="buffer" if "buffer" in str(folder_path).lower() else "core",
                        range_beat="Turia Range",
                        status="active"
                    )
                    db.add(station)
                    db.flush()
                elif lat is not None and lon is not None:
                    # Update station with real GPS from CSV if previously unset
                    if station.latitude is None or station.longitude is None:
                        station.latitude = lat
                        station.longitude = lon
                        db.flush()

                # 2. Check Image File on Disk
                matched_path = images_on_disk_map.get(img_name.lower())
                img_exists = matched_path is not None and matched_path.exists()
                
                safe_name = f"{int(time.time())}_{img_name}"
                managed_path = None
                thumb_path = None
                file_hash = hashlib.sha256(f"{img_name}_{cam_code}_{idx}".encode()).hexdigest()

                if img_exists:
                    managed_path = settings.IMAGES_DIR / safe_name
                    thumb_path = settings.IMAGES_DIR / f"thumb_{safe_name}"
                    shutil.copy2(matched_path, managed_path)
                    try:
                        with PILImage.open(managed_path) as im:
                            im.thumbnail((320, 240))
                            im.save(thumb_path, "JPEG")
                    except Exception:
                        pass

                # 3. Create DB Image Record
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
                    is_quarantined=(animal == "blank")
                )
                db.add(db_image)
                db.flush()

                # 4. Create Detection Record
                db_detection = Detection(
                    image_id=db_image.id,
                    class_name=animal,
                    confidence=conf,
                    is_human_blurred=(animal == "human")
                )
                db.add(db_detection)

                # 5. Handle Tiger Identity & Sightings
                if animal == "tiger":
                    batch_state["tiger_images"] += 1
                    t_code = tiger_id or f"PTR-T-{db.query(Tiger).count() + 1:03d}"
                    tiger = db.query(Tiger).filter(Tiger.tiger_code == t_code).first()
                    if not tiger:
                        tiger = Tiger(
                            tiger_code=t_code,
                            callsign=f"Individual {t_code}",
                            sex="Unknown",
                            age_class="Adult",
                            status="resident",
                            centroid_lat=lat,
                            centroid_lon=lon,
                            first_seen=captured_at,
                            last_seen=captured_at,
                            primary_zone=station.zone if station else "Core",
                            confidence=conf,
                            notes=f"Ingested from CSV at station {cam_code}"
                        )
                        db.add(tiger)
                        db.flush()

                    # Sighting
                    sighting = TigerSighting(
                        tiger_id=tiger.id,
                        image_id=db_image.id,
                        station_id=station.id,
                        latitude=lat,
                        longitude=lon,
                        captured_at=captured_at,
                        confidence=conf,
                        is_verified=True
                    )
                    db.add(sighting)

                    if img_exists and managed_path:
                        t_img = TigerImage(
                            tiger_id=tiger.id,
                            image_id=db_image.id,
                            flank_side="left",
                            crop_path=str(managed_path),
                            quality_score=conf,
                            is_reference=True
                        )
                        db.add(t_img)
                elif animal == "blank":
                    batch_state["blank"] += 1
                    batch_state["quarantined"] += 1
                elif animal == "human":
                    batch_state["human_images"] += 1
                    batch_state["non_blank"] += 1
                else:
                    batch_state["other_animals"] += 1
                    batch_state["non_blank"] += 1

                batch_state["processed"] += 1

                # Record detection row for immediate UI rendering
                detection_records.append({
                    "id": f"det-{idx+1}",
                    "image_filename": img_name,
                    "image_id": db_image.id,
                    "image_url": f"/api/v1/images/{db_image.id}/file" if img_exists else None,
                    "thumbnail_url": f"/api/v1/images/{db_image.id}/thumbnail" if img_exists else None,
                    "image_available": img_exists,
                    "camera_id": cam_code,
                    "timestamp": captured_at.strftime("%Y-%m-%d %H:%M:%S") if captured_at else "N/A",
                    "animal": animal.capitalize(),
                    "tiger_id": tiger_id if tiger_id else "-",
                    "confidence": round(conf, 2),
                    "latitude": lat,
                    "longitude": lon,
                    "has_location": lat is not None and lon is not None
                })

                # Broadcast progress
                if (idx + 1) % 2 == 0 or (idx + 1) == total_items:
                    await event_bus.broadcast("ingestion_progress", {
                        "batch_id": batch_id,
                        "stage": "Processing",
                        "processed": batch_state["processed"],
                        "total": total_items,
                        "progress_pct": round((batch_state["processed"] / max(1, total_items)) * 100, 1),
                        "tiger_images": batch_state["tiger_images"],
                        "other_animals": batch_state["other_animals"],
                        "quarantined": batch_state["quarantined"]
                    })

            # Broadcast Database saved -> Map synchronized
            db.commit()
            await event_bus.broadcast("ingestion_progress", {
                "batch_id": batch_id,
                "stage": "Database saved",
                "progress_pct": 95,
                "message": "Records stored and map synchronized"
            })

        # =========================================================================
        # CASE B: Raw Image Files Ingestion (via automated ML triage)
        # =========================================================================
        else:
            total_items = len(images)
            for idx, img_path in enumerate(images):
                station_code_hint = self.extract_station_code(img_path)
                try:
                    result = triage_pipeline.process_image(
                        db=db,
                        image_path=img_path,
                        station_id=station_id_override,
                        station_code_hint=station_code_hint
                    )
                    batch_state["processed"] += 1
                    cname = result.get("class_name", "wildlife")

                    if result.get("status") == "duplicate":
                        batch_state["duplicates"] += 1

                    if cname == "blank":
                        batch_state["blank"] += 1
                        batch_state["quarantined"] += 1
                    else:
                        batch_state["non_blank"] += 1

                    if cname == "tiger":
                        batch_state["tiger_images"] += 1
                    elif cname == "animal":
                        batch_state["other_animals"] += 1
                    elif cname == "human":
                        batch_state["human_images"] += 1

                    # Lookup image and station coords
                    img_rec = db.query(Image).filter(Image.id == result.get("image_id")).first()
                    st_rec = db.query(CameraStation).filter(CameraStation.id == img_rec.station_id).first() if img_rec else None

                    lat = st_rec.latitude if st_rec else None
                    lon = st_rec.longitude if st_rec else None
                    if lat is not None and lon is not None:
                        batch_state["locations_found"] += 1
                    else:
                        batch_state["locations_unavailable"] += 1

                    tiger_code = "-"
                    if result.get("tiger_info"):
                        tiger_code = result["tiger_info"].get("tiger_code", "-")

                    detection_records.append({
                        "id": f"det-{idx+1}",
                        "image_filename": img_path.name,
                        "image_id": result.get("image_id"),
                        "image_url": f"/api/v1/images/{result.get('image_id')}/file",
                        "thumbnail_url": f"/api/v1/images/{result.get('image_id')}/thumbnail",
                        "image_available": True,
                        "camera_id": station_code_hint or (st_rec.code if st_rec else "ST-001"),
                        "timestamp": img_rec.captured_at.strftime("%Y-%m-%d %H:%M:%S") if img_rec and img_rec.captured_at else "N/A",
                        "animal": cname.capitalize(),
                        "tiger_id": tiger_code,
                        "confidence": round(result.get("confidence", 0.9), 2),
                        "latitude": lat,
                        "longitude": lon,
                        "has_location": lat is not None and lon is not None
                    })

                except Exception as e:
                    batch_state["errors"] += 1
                    batch_state["processed"] += 1

                if (idx + 1) % 2 == 0 or (idx + 1) == total_items:
                    await event_bus.broadcast("ingestion_progress", {
                        "batch_id": batch_id,
                        "stage": "Processing",
                        "processed": batch_state["processed"],
                        "total": total_items,
                        "progress_pct": round((batch_state["processed"] / max(1, total_items)) * 100, 1),
                        "tiger_images": batch_state["tiger_images"],
                        "quarantined": batch_state["quarantined"]
                    })

            db.commit()

        batch_state["end_time"] = time.time()
        batch_state["status"] = "Complete"
        processing_time_s = round(batch_state["end_time"] - batch_state["start_time"], 2)
        images_per_min = round((batch_state["processed"] / max(0.01, processing_time_s)) * 60, 1)
        avg_ms_per_img = round((processing_time_s / max(1, batch_state["processed"])) * 1000, 1)
        storage_saved_mb = round(batch_state["quarantined"] * 4.5, 1)

        batch_report = {
            "batch_id": batch_id,
            "processing_status": "Complete",
            "status": "completed",
            "total_files": batch_state["total_images"],
            "total_images": batch_state["total_images"],
            "processed": batch_state["processed"],
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
            "images_per_minute": images_per_min,
            "avg_latency_ms": avg_ms_per_img,
            "estimated_storage_saved_mb": storage_saved_mb,
            "detections": detection_records,
            "data_quality": {
                "missing_timestamps": batch_state["missing_timestamps"],
                "clock_drift_warnings": batch_state["clock_drift_warnings"],
                "duplicate_images": batch_state["duplicates"],
                "missing_station_coords": batch_state["locations_unavailable"],
                "warnings": batch_state["warnings"]
            }
        }

        await event_bus.broadcast("ingestion_completed", batch_report)
        return batch_report

    def get_batch_status(self, batch_id: str) -> Optional[Dict[str, Any]]:
        return self.active_batches.get(batch_id)

ingestion_manager = IngestionManager()
