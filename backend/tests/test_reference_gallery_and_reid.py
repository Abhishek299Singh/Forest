"""
Unit and Integration Tests for Real Tiger Comparison Gallery,
Real-Image Re-Identification, and Dynamic Pench Gallery Growth.
"""
import os
import json
import shutil
import pytest
from pathlib import Path
from PIL import Image as PILImage

from app.core.config import settings
from app.db.database import SessionLocal, engine, Base
from app.db.models import Tiger, Image, TigerImage, TigerEmbedding, TigerSighting
from app.ml.build_gallery import GalleryBuilder
from app.ml.stripe_embedder import StripeEmbedder
from app.ml.matcher import TigerMatcher

@pytest.fixture(scope="module")
def setup_test_reference_data(tmp_path_factory):
    temp_dir = tmp_path_factory.mktemp("test_dataset")
    
    # Create two test tiger folders with real RGB images
    t1_dir = temp_dir / "ATRW_001"
    t1_dir.mkdir()
    img1 = PILImage.new("RGB", (320, 240), (180, 110, 30))
    for x in range(50, 80):
        for y in range(30, 200):
            img1.putpixel((x, y), (15, 15, 15))
    img1_path = t1_dir / "t1_left_flank.jpg"
    img1.save(img1_path)

    t2_dir = temp_dir / "ATRW_002"
    t2_dir.mkdir()
    img2 = PILImage.new("RGB", (320, 240), (190, 120, 40))
    for x in range(120, 160):
        for y in range(30, 200):
            img2.putpixel((x, y), (20, 20, 20))
    img2_path = t2_dir / "t2_right_flank.jpg"
    img2.save(img2_path)

    return temp_dir

def test_gallery_builder_enrolls_real_images(setup_test_reference_data):
    builder = GalleryBuilder()
    stats = builder.build_from_directory(
        dataset_dir=setup_test_reference_data,
        dataset_source="amur_atrw",
        identity_prefix="TEST-ATRW-"
    )

    assert stats["tigers_enrolled"] >= 2
    assert stats["images_processed"] >= 2
    assert stats["embeddings_generated"] >= 2

    db = SessionLocal()
    try:
        tigers = db.query(Tiger).filter(Tiger.tiger_code.like("TEST-ATRW-%")).all()
        assert len(tigers) >= 2
        for t in tigers:
            assert t.is_reference is True
            assert t.status == "reference"
            
            # Verify TigerImages
            imgs = db.query(TigerImage).filter(TigerImage.tiger_id == t.id).all()
            assert len(imgs) >= 1
            for ti in imgs:
                assert ti.is_reference is True
                assert ti.dataset_source == "amur_atrw"
                assert os.path.exists(ti.crop_path)
                
                # Verify TigerEmbeddings
                embs = db.query(TigerEmbedding).filter(TigerEmbedding.tiger_image_id == ti.id).all()
                assert len(embs) >= 1
                vec = json.loads(embs[0].embedding_json)
                assert len(vec) == 128
    finally:
        db.close()

def test_tiger_matcher_against_reference_gallery(setup_test_reference_data):
    embedder = StripeEmbedder()
    matcher = TigerMatcher()

    # Generate query embedding from test image 1
    t1_img_path = setup_test_reference_data / "ATRW_001" / "t1_left_flank.jpg"
    query_vector = embedder.extract_embedding(t1_img_path)
    assert len(query_vector) == 128

    db = SessionLocal()
    try:
        match_res = matcher.match_against_catalogue(
            candidate_embedding=query_vector,
            db=db,
            flank_side="left"
        )

        assert "top_candidates" in match_res
        assert len(match_res["top_candidates"]) > 0
        
        top_cand = match_res["top_candidates"][0]
        assert "similarity_percentage" in top_cand
        assert "similarity_display" in top_cand
        assert "Similarity:" in top_cand["similarity_display"]
        assert top_cand["similarity"] > 0.50
        assert "dataset_source" in top_cand
    finally:
        db.close()

def test_dynamic_pench_gallery_growth():
    """Verify that enrolling a Pench sighting adds embeddings that match on future queries."""
    import uuid
    uid = uuid.uuid4().hex[:6]
    test_code = f"TEST-PTR-{uid}"
    db = SessionLocal()
    try:
        # Create a new Pench tiger
        pench_tiger = Tiger(
            tiger_code=test_code,
            callsign=f"Pench Field Tiger {uid}",
            sex="Male",
            status="resident",
            dataset_source="pench_field",
            is_reference=False
        )
        db.add(pench_tiger)
        db.flush()

        # Create dummy image and crop with a unique stripe pattern
        dummy_crop = settings.CROPS_DIR / f"test_pench_crop_{uid}.jpg"
        img = PILImage.new("RGB", (200, 150), (185, 115, 35))
        offset = int(uid[:2], 16) % 15
        for x in (25 + offset, 65 + offset, 105 + offset, 145 + offset):
            for y in range(20, 130):
                for dx in range(12):
                    img.putpixel((x + dx, y), (10, 10, 10))
        img.save(dummy_crop)

        from datetime import datetime, timezone
        dummy_img = Image(
            file_hash=f"testhash_{uid}_pench",
            filename=f"pench_{uid}.jpg",
            original_path=str(dummy_crop),
            storage_path=str(dummy_crop),
            captured_at=datetime.now(timezone.utc),
            status="processed"
        )
        db.add(dummy_img)
        db.flush()

        t_img = TigerImage(
            tiger_id=pench_tiger.id,
            image_id=dummy_img.id,
            flank_side="left",
            crop_path=str(dummy_crop),
            dataset_source="pench_field",
            is_reference=False
        )
        db.add(t_img)
        db.flush()

        embedder = StripeEmbedder()
        vec = embedder.extract_embedding(dummy_crop)

        emb = TigerEmbedding(
            tiger_id=pench_tiger.id,
            tiger_image_id=t_img.id,
            embedding_json=json.dumps(vec),
            dataset_source="pench_field"
        )
        db.add(emb)
        db.commit()

        # Match using same embedding
        matcher = TigerMatcher()
        match_res = matcher.match_against_catalogue(
            db=db,
            candidate_embedding=vec,
            flank_side="left"
        )
        
        assert match_res["best_match"] is not None
        assert match_res["best_match"]["tiger_id"] == pench_tiger.id
        assert match_res["best_match"]["similarity"] >= 0.95
        assert match_res["best_match"]["dataset_source"] == "Pench Resident Catalogue"
    finally:
        db.close()
