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

        # Check for standard ATRW json annotation or directory structure
        ann_file = self.root_dir / "annotations.json" if self.root_dir else None
        if ann_file and ann_file.exists():
            with open(ann_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                for item in data.get("images", []):
                    tiger_id = item.get("tiger_id", "unknown")
                    sample = {
                        "image_path": str(self.root_dir / item.get("filename", "")),
                        "tiger_id": tiger_id,
                        "flank_side": item.get("flank_side", "left"),
                        "bbox": item.get("bbox", [0, 0, 1, 1])
                    }
                    self.all_samples.append(sample)
                    if tiger_id not in self.identities:
                        self.identities[tiger_id] = []
                    self.identities[tiger_id].append(sample)
        else:
            # Subfolder per tiger ID structure (e.g. atrw/tiger_001/img1.jpg)
            if self.root_dir and self.root_dir.exists():
                for sub in self.root_dir.iterdir():
                    if sub.is_dir() and not sub.name.startswith("."):
                        tiger_id = sub.name
                        for img_path in list(sub.glob("*.jpg")) + list(sub.glob("*.png")) + list(sub.glob("*.jpeg")):
                            sample = {
                                "image_path": str(img_path),
                                "tiger_id": tiger_id,
                                "flank_side": "left" if "left" in img_path.name.lower() else "right",
                                "bbox": [0, 0, 1, 1]
                            }
                            self.all_samples.append(sample)
                            if tiger_id not in self.identities:
                                self.identities[tiger_id] = []
                            self.identities[tiger_id].append(sample)

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
