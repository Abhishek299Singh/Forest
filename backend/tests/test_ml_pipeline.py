import pytest
import numpy as np
from PIL import Image as PILImage
from app.ml.blank_detector import blank_classifier
from app.ml.tiger_detector import tiger_detector
from app.ml.stripe_embedder import stripe_embedder
from app.ml.matcher import tiger_matcher

def test_blank_classifier_synthetic(tmp_path):
    # Test blank image
    blank_file = tmp_path / "test_blank.jpg"
    img = PILImage.new("RGB", (200, 200), (30, 45, 30))
    img.save(blank_file)

    res = blank_classifier.classify(blank_file)
    assert res["class_name"] in ["blank", "other"]
    assert res["confidence"] > 0.40

def test_stripe_embedder_dimension(tmp_path):
    crop_file = tmp_path / "test_flank.jpg"
    img = PILImage.new("RGB", (128, 128), (210, 120, 20))
    img.save(crop_file)

    emb = stripe_embedder.extract_embedding(crop_file)
    assert len(emb) == 128
    assert isinstance(emb[0], float)

def test_tiger_matcher_cosine():
    v1 = [1.0] * 128
    v2 = [1.0] * 128
    sim = tiger_matcher.cosine_similarity(v1, v2)
    assert pytest.approx(sim, 0.01) == 1.0

    v3 = [-1.0] * 128
    sim_opp = tiger_matcher.cosine_similarity(v1, v3)
    assert pytest.approx(sim_opp, 0.01) == -1.0
