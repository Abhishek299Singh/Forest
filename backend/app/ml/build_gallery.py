"""
Build Real Tiger Comparison Gallery from Amur / ATRW Dataset.
Enrolls real tiger photographs and bilateral flank stripe embeddings into the reference database.
Zero synthetic or artificial imagery.
"""
import os
import sys
import json
import shutil
import hashlib
import argparse
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from PIL import Image as PILImage

from app.core.config import settings
from app.db.database import SessionLocal, engine, Base
from app.db.models import Tiger, Image, TigerImage, TigerEmbedding, AuditLog
from app.ml.tiger_detector import TigerDetector
from app.ml.stripe_embedder import StripeEmbedder

class GalleryBuilder:
    def __init__(self):
        self.detector = TigerDetector()
        self.embedder = StripeEmbedder()

    def _compute_hash(self, file_path: Path) -> str:
        sha = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                sha.update(chunk)
        return sha.hexdigest()

    def build_from_directory(
        self,
        dataset_dir: str | Path,
        dataset_source: str = "amur_atrw",
        identity_prefix: str = "ATRW-T"
    ) -> Dict[str, Any]:
        """
        Scans directory of real tiger images grouped by identity or annotations.
        Enrolls individuals, creates real crops and 128-D stripe embeddings.
        """
        source_dir = Path(dataset_dir)
        if not source_dir.exists():
            raise FileNotFoundError(f"Dataset directory not found: {dataset_dir}")

        db = SessionLocal()
        stats = {
            "source_directory": str(source_dir),
            "dataset_source": dataset_source,
            "tigers_enrolled": 0,
            "images_processed": 0,
            "embeddings_generated": 0,
            "identities": []
        }

        # Step 1: Discover tiger folders or files
        # Check if subfolders represent tiger IDs
        subdirs = [d for d in source_dir.iterdir() if d.is_dir()]
        
        tiger_groups: Dict[str, List[Path]] = {}

        if len(subdirs) > 0:
            for d in subdirs:
                imgs = [p for p in d.rglob("*.*") if p.suffix.lower() in (".jpg", ".jpeg", ".png")]
                if imgs:
                    raw_id = d.name.upper().replace("TIGER_", "").replace("TIGER-", "").replace("T_", "").replace("T-", "")
                    t_code = f"{identity_prefix}{raw_id.zfill(3)}" if raw_id.isdigit() else f"{identity_prefix}{d.name.upper()}"
                    tiger_groups[t_code] = sorted(imgs)
        else:
            # Flat directory: group by filename prefix (e.g., T001_01.jpg or ATRW_001_01.jpg)
            imgs = [p for p in source_dir.iterdir() if p.suffix.lower() in (".jpg", ".jpeg", ".png")]
            for img in imgs:
                parts = img.stem.split("_")
                raw_id = parts[0].upper()
                if "TIGER" in raw_id or "ATRW" in raw_id or raw_id.startswith("T"):
                    clean_id = raw_id.replace("TIGER", "").replace("ATRW", "").replace("T", "").replace("-", "")
                    t_code = f"{identity_prefix}{clean_id.zfill(3)}" if clean_id.isdigit() else f"{identity_prefix}{raw_id}"
                else:
                    t_code = f"{identity_prefix}001"
                tiger_groups.setdefault(t_code, []).append(img)

        # Step 2: Enroll each individual tiger and its real images
        for t_code, image_paths in tiger_groups.items():
            # Check or create Tiger record
            tiger = db.query(Tiger).filter(Tiger.tiger_code == t_code).first()
            if not tiger:
                callsign = f"Reference Individual {t_code} ({dataset_source.upper()})"
                tiger = Tiger(
                    tiger_code=t_code,
                    callsign=callsign,
                    sex="Unknown",
                    age_class="Adult",
                    status="reference",
                    dataset_source=dataset_source,
                    is_reference=True,
                    primary_zone="Amur / Reference Database",
                    confidence=1.0,
                    notes=f"Enrolled into Reference Tiger Gallery from {dataset_source} dataset."
                )
                db.add(tiger)
                db.flush()
            else:
                tiger.dataset_source = dataset_source
                tiger.is_reference = True

            if t_code not in stats["identities"]:
                stats["identities"].append(t_code)
            stats["tigers_enrolled"] = len(stats["identities"])

            for img_path in image_paths:
                file_hash = self._compute_hash(img_path)
                
                # Copy real image to managed storage
                safe_filename = f"ref_{t_code}_{img_path.name}"
                managed_path = settings.IMAGES_DIR / safe_filename
                shutil.copy2(img_path, managed_path)

                # Generate thumbnail
                thumb_path = settings.THUMBNAILS_DIR / f"thumb_{safe_filename}"
                try:
                    with PILImage.open(managed_path) as im:
                        im_rgb = im.convert("RGB")
                        im_rgb.thumbnail((320, 240))
                        im_rgb.save(thumb_path, "JPEG", quality=85)
                except Exception:
                    thumb_path = managed_path

                # Create Image record
                db_image = db.query(Image).filter(Image.file_hash == file_hash).first()
                if not db_image:
                    db_image = Image(
                        file_hash=file_hash,
                        filename=img_path.name,
                        original_path=str(img_path),
                        storage_path=str(managed_path),
                        thumbnail_path=str(thumb_path),
                        captured_at=datetime.now(timezone.utc),
                        status="reference"
                    )
                    db.add(db_image)
                    db.flush()

                # Detect tiger body & flank from the real image
                det_res = self.detector.detect(managed_path)
                flank_bbox = det_res["flank_bbox"]
                flank_side = det_res["flank_side"]

                # Extract and save real flank crop
                crop_filename = f"flank_{db_image.id}_{flank_side}.jpg"
                crop_path = settings.CROPS_DIR / crop_filename
                self.detector.crop_flank(managed_path, flank_bbox, crop_path)

                # Save body crop
                body_crop_path = settings.CROPS_DIR / f"body_{db_image.id}.jpg"
                self.detector.crop_tiger_body(managed_path, det_res["bbox"], body_crop_path)

                # Create or update TigerImage record
                t_img = db.query(TigerImage).filter(TigerImage.tiger_id == tiger.id, TigerImage.image_id == db_image.id).first()
                if not t_img:
                    t_img = TigerImage(
                        tiger_id=tiger.id,
                        image_id=db_image.id,
                        flank_side=flank_side,
                        crop_path=str(crop_path),
                        original_image_path=str(img_path),
                        dataset_source=dataset_source,
                        quality_score=0.92,
                        is_reference=True
                    )
                    db.add(t_img)
                    db.flush()
                else:
                    t_img.dataset_source = dataset_source
                    t_img.is_reference = True
                    t_img.crop_path = str(crop_path)
                    t_img.original_image_path = str(img_path)

                # Generate 128-D Stripe Feature Embedding
                stripe_vector = self.embedder.extract_embedding(crop_path)
                emb = db.query(TigerEmbedding).filter(TigerEmbedding.tiger_image_id == t_img.id).first()
                if not emb:
                    emb = TigerEmbedding(
                        tiger_id=tiger.id,
                        tiger_image_id=t_img.id,
                        embedding_json=json.dumps(stripe_vector),
                        dataset_source=dataset_source,
                        model_version=self.embedder.model_version
                    )
                    db.add(emb)
                else:
                    emb.embedding_json = json.dumps(stripe_vector)
                    emb.dataset_source = dataset_source
                
                stats["images_processed"] += 1
                stats["embeddings_generated"] += 1

        # Audit log entry
        audit = AuditLog(
            actor_id="GalleryBuilder-CLI",
            actor_role="admin",
            action="build_reference_gallery",
            entity_type="gallery",
            entity_id=dataset_source,
            details_json=json.dumps(stats)
        )
        db.add(audit)
        db.commit()
        db.close()

        return stats

def main():
    parser = argparse.ArgumentParser(description="Build Reference Tiger Gallery from Dataset")
    parser.add_argument("--dataset-dir", type=str, required=True, help="Path to Amur / ATRW dataset directory")
    parser.add_argument("--dataset-source", type=str, default="amur_atrw", help="Dataset source identifier")
    parser.add_argument("--prefix", type=str, default="ATRW-T", help="Tiger ID prefix (e.g. ATRW-T)")
    args = parser.parse_args()

    print(f"[*] Building Tiger Reference Gallery from: {args.dataset_dir}")
    builder = GalleryBuilder()
    results = builder.build_from_directory(args.dataset_dir, args.dataset_source, args.prefix)
    
    print("\n[OK] Reference Gallery Built Successfully!")
    print(f"  - Source: {results['dataset_source']}")
    print(f"  - Reference Tigers Enrolled: {results['tigers_enrolled']}")
    print(f"  - Real Images Processed: {results['images_processed']}")
    print(f"  - 128-D Stripe Embeddings: {results['embeddings_generated']}")
    print(f"  - Identity Codes: {', '.join(results['identities'][:10])}")

if __name__ == "__main__":
    main()
