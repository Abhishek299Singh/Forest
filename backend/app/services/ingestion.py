import re
import time
import os
from pathlib import Path
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.ml.pipeline import triage_pipeline
from app.core.events import event_bus
from app.core.config import settings

class IngestionManager:
    """
    Manages SD card folder scanning, batch ingestion, progress tracking, and metrics calculation.
    """
    def __init__(self):
        self.supported_extensions = {".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG"}
        self.active_batches: Dict[str, Dict[str, Any]] = {}

    def extract_station_code(self, file_path: Path) -> Optional[str]:
        """Extracts station code like ST-014 or ST_014 from folder structure or filename."""
        path_str = str(file_path).upper()
        # Match ST-01 to ST-99 or STATION-01
        match = re.search(r'ST[-_]?([0-9]{2,3})', path_str)
        if match:
            return f"ST-{int(match.group(1)):02d}"
        
        # Match common Pench beat names
        if "TURIA" in path_str:
            return "ST-01"
        elif "BAGHIN" in path_str:
            return "ST-02"
        elif "ALIKATTA" in path_str:
            return "ST-04"
        elif "GUMTARA" in path_str:
            return "ST-08"
        elif "TELIA" in path_str:
            return "ST-12"
        return None

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

    async def process_batch(
        self,
        db: Session,
        batch_id: str,
        folder_path: Path | str,
        station_id_override: Optional[str] = None
    ) -> Dict[str, Any]:
        images = self.scan_folder(folder_path)
        total_images = len(images)

        batch_state = {
            "batch_id": batch_id,
            "folder_path": str(folder_path),
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
            "status": "processing",
            "start_time": time.time(),
            "end_time": None,
            "items": []
        }
        self.active_batches[batch_id] = batch_state

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

                batch_state["items"].append(result)

            except Exception as e:
                batch_state["errors"] += 1
                batch_state["processed"] += 1
                batch_state["items"].append({"status": "error", "path": str(img_path), "error": str(e)})

            # Broadcast live progress every 2 items or on completion
            if (idx + 1) % 2 == 0 or (idx + 1) == total_images:
                await event_bus.broadcast("ingestion_progress", {
                    "batch_id": batch_id,
                    "processed": batch_state["processed"],
                    "total": total_images,
                    "progress_pct": round((batch_state["processed"] / max(1, total_images)) * 100, 1),
                    "tiger_images": batch_state["tiger_images"],
                    "quarantined": batch_state["quarantined"],
                    "blank": batch_state["blank"]
                })

        batch_state["end_time"] = time.time()
        batch_state["status"] = "completed"
        processing_time_s = round(batch_state["end_time"] - batch_state["start_time"], 2)
        
        # Estimate storage saved: assuming 4.5 MB per quarantined blank image
        storage_saved_mb = round(batch_state["quarantined"] * 4.5, 1)

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
            "estimated_storage_saved_mb": storage_saved_mb,
            "status": "completed"
        }

        await event_bus.broadcast("ingestion_completed", batch_report)
        return batch_report

    def get_batch_status(self, batch_id: str) -> Optional[Dict[str, Any]]:
        return self.active_batches.get(batch_id)

ingestion_manager = IngestionManager()
