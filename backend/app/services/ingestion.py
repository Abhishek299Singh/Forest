import re
import time
import os
import shutil
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.ml.pipeline import triage_pipeline
from app.core.events import event_bus
from app.core.config import settings

class IngestionManager:
    """
    Manages SD card folder scanning, safe workspace batch ingestion, progress tracking,
    and field data quality telemetry.
    Guarantees the original SD card is treated as strictly read-only source data.
    """
    def __init__(self):
        self.supported_extensions = {".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG"}
        self.active_batches: Dict[str, Dict[str, Any]] = {}

    def extract_station_code(self, file_path: Path) -> Optional[str]:
        """Extracts station code like ST-01, 100CAM, or beat names from folder structure or filename."""
        # Inspect local path parts (filename, direct parent folder, parent's parent)
        relevant_parts = [file_path.name, file_path.parent.name, file_path.parent.parent.name]
        combined = " ".join([p.upper() for p in relevant_parts if p])

        # 1. Match explicit ST-01 to ST-999 or STATION-01
        match = re.search(r'\b(?:ST|STATION)[-_]?([0-9]{1,3})\b', combined)
        if match:
            return f"ST-{int(match.group(1)):02d}"

        # 2. Match Camera folder pattern (e.g., 100CAM, 100CUDD, 101RECON, CAM_01)
        cam_match = re.search(r'\b([0-9]{2,3}[A-Z]{3,4}|CAM[-_]?[0-9]{1,3})\b', combined)
        if cam_match:
            return f"ST-{cam_match.group(1)}"

        # 3. Match Pench beat names
        if "TURIA" in combined:
            return "ST-01"
        elif "BAGHIN" in combined:
            return "ST-02"
        elif "ALIKATTA" in combined:
            return "ST-04"
        elif "GUMTARA" in combined:
            return "ST-08"
        elif "TELIA" in combined:
            return "ST-12"
        elif "KARMAJHIRI" in combined:
            return "ST-05"

        # 4. Fallback to immediate parent folder name if non-root
        parent_name = file_path.parent.name
        if parent_name and parent_name.upper() not in {"DCIM", "IMAGES", "PICTURES", "ROOT", ".", ""}:
            clean_name = re.sub(r'[^A-Za-z0-9_-]', '', parent_name)[:12]
            if clean_name:
                return f"ST-{clean_name.upper()}"

        return "ST-01"

    def scan_folder(self, folder_path: Path | str) -> List[Path]:
        folder = Path(folder_path)
        if not folder.exists() or not folder.is_dir():
            return []
        
        image_files = []
        for root, _, files in os.walk(folder):
            for file in files:
                p = Path(root) / file
                if p.suffix in self.supported_extensions and not p.name.startswith("."):
                    image_files.append(p)
        return sorted(image_files)

    def scan_folder_info(self, folder_path: Path | str) -> Dict[str, Any]:
        folder = Path(folder_path)
        if not folder.exists() or not folder.is_dir():
            return {
                "valid": False,
                "error": f"Folder not found: {folder_path}"
            }
        
        images = self.scan_folder(folder_path)
        detected_stations = set()
        for img in images:
            st = self.extract_station_code(img)
            if st:
                detected_stations.add(st)

        size_mb = 0.0
        try:
            size_mb = round(sum(os.path.getsize(p) for p in images if p.exists()) / (1024 * 1024), 1)
        except Exception:
            pass

        return {
            "valid": True,
            "folder_path": str(folder),
            "total_images_found": len(images),
            "detected_stations": sorted(list(detected_stations)),
            "estimated_size_mb": size_mb,
            "status": "ready"
        }

    async def process_batch(
        self,
        db: Session,
        batch_id: str,
        folder_path: Path | str,
        station_id_override: Optional[str] = None
    ) -> Dict[str, Any]:
        images = self.scan_folder(folder_path)
        total_images = len(images)

        # 1. Create Safe Local Workspace for this batch
        workspace_dir = settings.BASE_DIR / "workspace" / "batches" / batch_id
        workspace_dir.mkdir(parents=True, exist_ok=True)
        (workspace_dir / "original").mkdir(parents=True, exist_ok=True)
        (workspace_dir / "processed").mkdir(parents=True, exist_ok=True)
        (workspace_dir / "quarantine").mkdir(parents=True, exist_ok=True)

        batch_state = {
            "batch_id": batch_id,
            "folder_path": str(folder_path),
            "workspace_path": str(workspace_dir),
            "total_images": total_images,
            "processed": 0,
            "duplicates": 0,
            "invalid": 0,
            "blank": 0,
            "non_blank": 0,
            "tiger_images": 0,
            "other_animals": 0,
            "human_images": 0,
            "quarantined": 0,
            "errors": 0,
            "missing_timestamps": 0,
            "clock_drift_warnings": 0,
            "missing_station_coords": 0,
            "warnings": [],
            "status": "processing",
            "start_time": time.time(),
            "end_time": None,
            "items": []
        }
        self.active_batches[batch_id] = batch_state

        for idx, img_path in enumerate(images):
            station_code_hint = self.extract_station_code(img_path)
            
            try:
                # Read from SD card in read-only mode, never modifying original
                result = triage_pipeline.process_image(
                    db=db,
                    image_path=img_path,
                    station_id=station_id_override,
                    station_code_hint=station_code_hint
                )
                
                batch_state["processed"] += 1
                
                if result.get("status") == "duplicate":
                    batch_state["duplicates"] += 1
                elif result.get("status") == "error":
                    batch_state["errors"] += 1
                else:
                    cname = result.get("class_name")
                    if cname == "blank":
                        batch_state["blank"] += 1
                    else:
                        batch_state["non_blank"] += 1

                    if cname == "tiger":
                        batch_state["tiger_images"] += 1
                    elif cname == "animal":
                        batch_state["other_animals"] += 1
                    elif cname == "human":
                        batch_state["human_images"] += 1

                    if result.get("is_quarantined"):
                        batch_state["quarantined"] += 1

                    # Check metadata quality
                    if not result.get("has_exif_timestamp"):
                        batch_state["missing_timestamps"] += 1
                    if result.get("has_clock_drift"):
                        batch_state["clock_drift_warnings"] += 1
                    if not station_code_hint and not station_id_override:
                        batch_state["missing_station_coords"] += 1

                batch_state["items"].append(result)

            except Exception as e:
                batch_state["errors"] += 1
                batch_state["processed"] += 1
                batch_state["items"].append({"status": "error", "path": str(img_path), "error": str(e)})

            # Broadcast live progress
            if (idx + 1) % 2 == 0 or (idx + 1) == total_images:
                await event_bus.broadcast("ingestion_progress", {
                    "batch_id": batch_id,
                    "processed": batch_state["processed"],
                    "total": total_images,
                    "progress_pct": round((batch_state["processed"] / max(1, total_images)) * 100, 1),
                    "tiger_images": batch_state["tiger_images"],
                    "quarantined": batch_state["quarantined"],
                    "blank": batch_state["blank"],
                    "non_blank": batch_state["non_blank"],
                    "errors": batch_state["errors"]
                })

        batch_state["end_time"] = time.time()
        batch_state["status"] = "completed"
        processing_time_s = round(batch_state["end_time"] - batch_state["start_time"], 2)
        images_per_min = round((batch_state["processed"] / max(0.01, processing_time_s)) * 60, 1)
        avg_ms_per_img = round((processing_time_s / max(1, batch_state["processed"])) * 1000, 1)
        
        # Estimate storage saved: assuming 4.5 MB per quarantined blank image
        storage_saved_mb = round(batch_state["quarantined"] * 4.5, 1)

        # Generate field data quality warnings
        warnings = []
        if batch_state["duplicates"] > 0:
            warnings.append(f"⚠ {batch_state['duplicates']} duplicate image(s) detected via SHA-256 deduplication")
        if batch_state["missing_timestamps"] > 0:
            warnings.append(f"⚠ {batch_state['missing_timestamps']} image(s) missing EXIF capture timestamp (fallback to file system date)")
        if batch_state["clock_drift_warnings"] > 0:
            warnings.append(f"⚠ {batch_state['clock_drift_warnings']} image(s) exhibit potential camera clock drift (>365 days offset)")
        if batch_state["missing_station_coords"] > 0:
            warnings.append(f"⚠ {batch_state['missing_station_coords']} image(s) lacked station folder tag")

        batch_report = {
            "batch_id": batch_id,
            "total_images": total_images,
            "processed": batch_state["processed"],
            "duplicates": batch_state["duplicates"],
            "invalid": batch_state["invalid"],
            "blank": batch_state["blank"],
            "non_blank": batch_state["non_blank"],
            "tiger_images": batch_state["tiger_images"],
            "other_animals": batch_state["other_animals"],
            "human_images": batch_state["human_images"],
            "quarantined": batch_state["quarantined"],
            "errors": batch_state["errors"],
            "processing_time_seconds": processing_time_s,
            "images_per_minute": images_per_min,
            "avg_latency_ms": avg_ms_per_img,
            "estimated_storage_saved_mb": storage_saved_mb,
            "data_quality": {
                "missing_timestamps": batch_state["missing_timestamps"],
                "clock_drift_warnings": batch_state["clock_drift_warnings"],
                "duplicate_images": batch_state["duplicates"],
                "missing_station_coords": batch_state["missing_station_coords"],
                "warnings": warnings
            },
            "status": "completed"
        }

        await event_bus.broadcast("ingestion_completed", batch_report)
        return batch_report

    def get_batch_status(self, batch_id: str) -> Optional[Dict[str, Any]]:
        return self.active_batches.get(batch_id)

ingestion_manager = IngestionManager()
