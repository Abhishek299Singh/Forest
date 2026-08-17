"""
Regression Guard Test: Zero Synthetic Data Pollution in Production.
===================================================================
Guarantees that no procedurally-generated synthetic placeholder images
(e.g. flat-color canvases with solid geometric bars or low-entropy histograms)
and no test artifacts pollute production backend/data/ storage or database.
"""
import os
import sqlite3
import pytest
import numpy as np
from pathlib import Path
from PIL import Image as PILImage

from app.core.config import _BASE_DIR

def is_synthetic_placeholder(image_path: Path) -> bool:
    """
    Detects procedurally generated placeholder images:
    1. Low entropy / near-zero variance histograms.
    2. Small number of unique colors (< 8 discrete colors in RGB).
    3. Solid color backgrounds with primitive raster stripes.
    """
    try:
        with PILImage.open(image_path) as im:
            im_rgb = im.convert("RGB")
            arr = np.array(im_rgb)
            
            # Check unique RGB colors (synthetic generators use 2-4 discrete colors)
            pixels = arr.reshape(-1, 3)
            # Sample 1000 pixels for fast evaluation
            if len(pixels) > 1000:
                indices = np.random.choice(len(pixels), 1000, replace=False)
                sample = pixels[indices]
            else:
                sample = pixels
                
            unique_colors = len(np.unique(sample, axis=0))
            if unique_colors < 8:
                return True
                
            # Check for near-zero standard deviation across the canvas
            std_dev = np.std(arr)
            if std_dev < 5.0:
                return True
                
            return False
    except Exception:
        return False

def test_production_directories_clean_of_synthetic_images():
    """Verify that backend/data directories contain zero procedural placeholder JPEGs."""
    prod_data_dir = _BASE_DIR / "data"
    
    if not prod_data_dir.exists():
        return
        
    for sub in ["images", "crops", "thumbnails", "quarantine", "reference_gallery"]:
        sub_dir = prod_data_dir / sub
        if not sub_dir.exists():
            continue
            
        for img_path in sub_dir.rglob("*.*"):
            if img_path.is_file() and img_path.suffix.lower() in (".jpg", ".jpeg", ".png"):
                assert not is_synthetic_placeholder(img_path), (
                    f"Found synthetic/placeholder image in production storage: {img_path}"
                )

def test_production_database_clean_of_test_artifacts():
    """Verify that production SQLite database does not contain dummy test tiger identities."""
    prod_db_path = _BASE_DIR / "data" / "pench_offline.db"
    
    if not prod_db_path.exists():
        return
        
    conn = sqlite3.connect(str(prod_db_path))
    cursor = conn.cursor()
    
    # Check for test tiger codes in production DB
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='tigers'")
    if cursor.fetchone():
        cursor.execute("SELECT tiger_code FROM tigers WHERE tiger_code LIKE 'TEST-%' OR tiger_code LIKE '%DUMMY%'")
        polluted_tigers = cursor.fetchall()
        assert len(polluted_tigers) == 0, f"Found test tigers in production DB: {polluted_tigers}"
        
    conn.close()
