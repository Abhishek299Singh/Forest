"""
Amur Tiger Re-Identification in the Wild (ATRW) Dataset Loader & Benchmark
==========================================================================
Provides dataset ingestion, bounding box extraction, flank viewpoint parsing,
and train/validation triplet batch generation for training/fine-tuning tiger
re-identification embedding models.
"""

import os
import json
import random
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any
from PIL import Image as PILImage

class AmurTigerDataset:
    """
    Manages the Amur Tiger Re-ID dataset (ATRW standard).
    Structures data into individuals with multiple flank captures for metric learning.
    """
    def __init__(self, root_dir: Optional[str | Path] = None):
        self.root_dir = Path(root_dir) if root_dir else None
        self.identities: Dict[str, List[Dict[str, Any]]] = {}
        self.all_samples: List[Dict[str, Any]] = []
        
        if self.root_dir and self.root_dir.exists():
            self.load_dataset()

    def load_dataset(self):
        """Scans and indexes ATRW annotations and image directories."""
        self.identities.clear()
        self.all_samples.clear()
        if not self.root_dir or not self.root_dir.exists():
            return

        # 1. Check for Kaggle ATRW reid_list_train.csv / reid_list_train.txt
        list_files = list(self.root_dir.glob("*reid_list*.csv")) + list(self.root_dir.glob("*reid_list*.txt")) + list(self.root_dir.glob("*.csv")) + list(self.root_dir.glob("*.txt"))
        parsed_from_list = False
        for lf in list_files:
            try:
                with open(lf, "r", encoding="utf-8") as f:
                    lines = [line.strip() for line in f if line.strip()]
                for line in lines:
                    delimiter = "," if "," in line else None
                    parts = [p.strip() for p in line.split(delimiter) if p.strip()]
                    if len(parts) >= 2:
                        # Determine which part is the image filename
                        p0, p1 = parts[0], parts[1]
                        if any(p0.lower().endswith(ext) for ext in (".jpg", ".jpeg", ".png")):
                            img_rel_name = p0
                            tiger_id = p1
                        elif any(p1.lower().endswith(ext) for ext in (".jpg", ".jpeg", ".png")):
                            img_rel_name = p1
                            tiger_id = p0
                        else:
                            continue

                        # Locate image file recursively
                        found_path = None
                        direct = self.root_dir / img_rel_name
                        if direct.exists():
                            found_path = direct
                        else:
                            for candidate in self.root_dir.rglob(Path(img_rel_name).name):
                                found_path = candidate
                                break

                        if found_path and found_path.exists():
                            sample = {
                                "image_path": str(found_path),
                                "tiger_id": str(tiger_id),
                                "flank_side": "left" if "left" in found_path.name.lower() else "right",
                                "bbox": [0, 0, 1, 1]
                            }
                            self.all_samples.append(sample)
                            self.identities.setdefault(str(tiger_id), []).append(sample)
                            parsed_from_list = True
            except Exception:
                pass

        if parsed_from_list and len(self.all_samples) > 0:
            return

        # 2. Check for standard ATRW json annotation (annotations.json / reid_keypoints_train.json)
        json_files = list(self.root_dir.glob("*annotations*.json")) + list(self.root_dir.glob("*reid*.json"))
        for jf in json_files:
            try:
                with open(jf, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    images_list = data.get("images", data if isinstance(data, list) else [])
                    for item in images_list:
                        if isinstance(item, dict):
                            tiger_id = str(item.get("tiger_id", item.get("individual_id", "unknown")))
                            filename = item.get("filename", item.get("image_name", ""))
                            found_path = None
                            if filename:
                                direct = self.root_dir / filename
                                if direct.exists():
                                    found_path = direct
                                else:
                                    for candidate in self.root_dir.rglob(Path(filename).name):
                                        found_path = candidate
                                        break
                            if found_path and found_path.exists():
                                sample = {
                                    "image_path": str(found_path),
                                    "tiger_id": tiger_id,
                                    "flank_side": item.get("flank_side", "left"),
                                    "bbox": item.get("bbox", [0, 0, 1, 1])
                                }
                                self.all_samples.append(sample)
                                self.identities.setdefault(tiger_id, []).append(sample)
            except Exception:
                pass

        if len(self.all_samples) > 0:
            return

        # 3. Subfolder per tiger ID structure (e.g. atrw/tiger_001/img1.jpg or atrw/1/img1.jpg)
        subdirs = [d for d in self.root_dir.iterdir() if d.is_dir() and not d.name.startswith(".")]
        for sub in subdirs:
            tiger_id = sub.name
            img_list = list(sub.rglob("*.jpg")) + list(sub.rglob("*.png")) + list(sub.rglob("*.jpeg"))
            if img_list:
                for img_path in img_list:
                    sample = {
                        "image_path": str(img_path),
                        "tiger_id": tiger_id,
                        "flank_side": "left" if "left" in img_path.name.lower() else "right",
                        "bbox": [0, 0, 1, 1]
                    }
                    self.all_samples.append(sample)
                    self.identities.setdefault(tiger_id, []).append(sample)

        # 4. Flat directory with prefix identifiers (e.g. tiger_01_01.jpg)
        if len(self.all_samples) == 0:
            for img_path in list(self.root_dir.rglob("*.jpg")) + list(self.root_dir.rglob("*.png")):
                if not img_path.name.startswith(".") and not img_path.name.startswith("thumb_"):
                    prefix = img_path.stem.split("_")[0]
                    tiger_id = prefix if prefix else "tiger_001"
                    sample = {
                        "image_path": str(img_path),
                        "tiger_id": tiger_id,
                        "flank_side": "left" if "left" in img_path.name.lower() else "right",
                        "bbox": [0, 0, 1, 1]
                    }
                    self.all_samples.append(sample)
                    self.identities.setdefault(tiger_id, []).append(sample)

    def get_summary(self) -> Dict[str, Any]:
        return {
            "total_images": len(self.all_samples),
            "total_individuals": len(self.identities),
            "individuals": list(self.identities.keys())[:10],
            "is_loaded": len(self.all_samples) > 0
        }

    def generate_triplets(self, batch_size: int = 16) -> List[Tuple[str, str, str]]:
        """
        Generates (Anchor, Positive, Negative) image path triplets for metric learning.
        Anchor and Positive share the same tiger identity.
        Negative is a different tiger individual.
        """
        multi_capture_ids = [tid for tid, imgs in self.identities.items() if len(imgs) >= 2]
        if len(multi_capture_ids) < 2:
            return []

        triplets = []
        for _ in range(batch_size):
            pos_id = random.choice(multi_capture_ids)
            anchor_img, pos_img = random.sample(self.identities[pos_id], 2)
            
            neg_id = random.choice([tid for tid in self.identities.keys() if tid != pos_id])
            neg_img = random.choice(self.identities[neg_id])

            triplets.append((
                anchor_img["image_path"],
                pos_img["image_path"],
                neg_img["image_path"]
            ))

        return triplets
