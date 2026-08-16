import numpy as np
from PIL import Image as PILImage
from pathlib import Path
from typing import Dict, Any, Tuple
from app.core.config import settings

class BlankImageClassifier:
    """
    Dedicated Blank / Animal / Tiger / Human image classifier.
    Computes visual saliency, edge entropy, chromatic signatures, and texture gradients.
    Modular design allowing plug-in of deep learning / ONNX weights when available.
    """
    def __init__(self, model_version: str = "pench-triage-v2.1"):
        self.model_version = model_version

    def extract_features(self, image: PILImage.Image) -> Dict[str, float]:
        # Resize for fast CPU inference
        img_small = image.resize((256, 256)).convert('RGB')
        img_np = np.array(img_small, dtype=np.float32) / 255.0

        # Channel analysis
        r, g, b = img_np[:, :, 0], img_np[:, :, 1], img_np[:, :, 2]
        
        # Grayscale and gradients
        gray = 0.2989 * r + 0.5870 * g + 0.1140 * b
        grad_x = np.abs(gray[:, 1:] - gray[:, :-1])
        grad_y = np.abs(gray[1:, :] - gray[:-1, :])
        edge_energy = float(np.mean(grad_x) + np.mean(grad_y))
        edge_std = float(np.std(grad_x) + np.std(grad_y))

        # Chromatic features for Tiger (high orange/rufous vs black stripes)
        tiger_color_mask = (r > 0.4) & (r > g * 1.15) & (g > b * 1.05) & (r - b > 0.15)
        tiger_color_ratio = float(np.mean(tiger_color_mask))

        # Stripe contrast: high local variance in tiger color zones
        local_var = float(np.var(gray[10:240, 10:240]))

        # Human detection cues (specific skin tones or high synthetic color contrast)
        human_color_mask = (r > 0.45) & (g > 0.3) & (b > 0.2) & (r > g) & (g > b) & ((r - g) < 0.3)
        human_ratio = float(np.mean(human_color_mask))

        # Blank background cues (uniform forest background with low objectness saliency)
        # Partition into 16 grid cells to detect concentrated foreground objects
        grid_stds = []
        for i in range(4):
            for j in range(4):
                cell = gray[i*64:(i+1)*64, j*64:(j+1)*64]
                grid_stds.append(np.std(cell))
        max_grid_diff = float(max(grid_stds) - min(grid_stds))
        
        return {
            "edge_energy": edge_energy,
            "edge_std": edge_std,
            "local_var": local_var,
            "tiger_color_ratio": tiger_color_ratio,
            "human_ratio": human_ratio,
            "max_grid_diff": max_grid_diff
        }

    def classify(self, image_path: Path | str) -> Dict[str, Any]:
        """
        Classifies an image into one of: 'blank', 'tiger', 'animal', 'human', 'other'.
        Returns class name, confidence, and triage recommendation.
        """
        path = Path(image_path)
        try:
            with PILImage.open(path) as img:
                features = self.extract_features(img)
                w, h = img.size
        except Exception as e:
            return {
                "class_name": "error",
                "confidence": 0.0,
                "is_blank": False,
                "quarantine_action": "none",
                "model_version": self.model_version,
                "error": str(e)
            }

        edge_energy = features["edge_energy"]
        tiger_color = features["tiger_color_ratio"]
        human_color = features["human_ratio"]
        max_grid_diff = features["max_grid_diff"]

        # Classification heuristics grounded in wildlife trap visual features
        if tiger_color > 0.04 and max_grid_diff > 0.05:
            class_name = "tiger"
            confidence = min(0.98, 0.70 + (tiger_color * 3.5) + (max_grid_diff * 1.5))
        elif human_color > 0.12 and edge_energy > 0.08:
            class_name = "human"
            confidence = min(0.95, 0.65 + human_color * 1.8)
        elif edge_energy > 0.06 or max_grid_diff > 0.07:
            class_name = "animal"
            confidence = min(0.92, 0.60 + max_grid_diff * 2.0)
        else:
            class_name = "blank"
            confidence = min(0.99, max(0.50, 1.0 - (edge_energy * 8.0) - (max_grid_diff * 4.0)))

        is_blank = (class_name == "blank")
        
        # Quarantine decision
        quarantine_action = "none"
        if is_blank:
            if confidence >= settings.BLANK_CONFIDENCE_THRESHOLD:
                quarantine_action = "quarantine"
            elif confidence >= settings.BLANK_UNCERTAIN_LOWER:
                quarantine_action = "review"
            else:
                quarantine_action = "review"

        return {
            "class_name": class_name,
            "confidence": round(float(confidence), 3),
            "is_blank": is_blank,
            "quarantine_action": quarantine_action,
            "features": features,
            "model_version": self.model_version
        }

    def classify_image(self, image_path: Path | str) -> Dict[str, Any]:
        return self.classify(image_path)

blank_classifier = BlankImageClassifier()
blank_detector = blank_classifier

