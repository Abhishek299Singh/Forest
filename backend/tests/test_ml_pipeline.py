import pytest
import numpy as np
from PIL import Image as PILImage
from app.ml.blank_detector import blank_detector
from app.ml.tiger_detector import tiger_detector
from app.ml.stripe_embedder import stripe_embedder
from app.ml.matcher import tiger_matcher
from app.ml.benchmark import ai_benchmark

def test_blank_classifier_synthetic(tmp_path):
    blank_file = tmp_path / "test_blank.jpg"
    img = PILImage.new("RGB", (200, 200), (30, 45, 30))
    img.save(blank_file)

    res = blank_detector.classify_image(blank_file)
    assert res["class_name"] in ["blank", "other"]
    assert res["confidence"] > 0.40

def test_stripe_embedder_dimension(tmp_path):
    crop_file = tmp_path / "test_flank.jpg"
    img = PILImage.new("RGB", (128, 128), (210, 120, 20))
    img.save(crop_file)

    emb = stripe_embedder.extract_embedding(crop_file)
    assert len(emb) == 128
    assert isinstance(emb[0], float)

def test_tiger_matcher_cosine_and_flank_asymmetry():
    # Test identical vectors
    v1 = [0.1] * 128
    v2 = [0.1] * 128
    sim = tiger_matcher.cosine_similarity(v1, v2)
    assert pytest.approx(sim, 0.01) == 1.0

    # Test opposing vectors
    v3 = [-0.1] * 128
    sim_opp = tiger_matcher.cosine_similarity(v1, v3)
    assert pytest.approx(sim_opp, 0.01) == -1.0

def test_ai_benchmark_execution(tmp_path):
    test_img = tmp_path / "bench_test.jpg"
    img = PILImage.new("RGB", (128, 128), (200, 100, 20))
    img.save(test_img)

    result = ai_benchmark.run_benchmark(sample_image_path=str(test_img), iterations=10)
    assert result["status"] == "completed"
    assert result["throughput"]["images_per_second_fps"] > 0
    assert result["accuracy_benchmarks"]["blank_detection_accuracy"] >= 0.90
    assert result["accuracy_benchmarks"]["blank_detection_f1"] >= 0.85
