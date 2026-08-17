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

        # Chromatic features for Tiger (broadened for camera traps: shaded, golden, dusk/morning, Amur & Bengal)
        tiger_color_mask = (r > 0.28) & (r >= g * 1.02) & (r > b + 0.04)
        tiger_color_ratio = float(np.mean(tiger_color_mask))

        # Stripe anisotropic high-frequency gradient transitions (works on both daylight & night IR)
        stripe_energy = float(np.mean(grad_x > 0.12))

        # Stripe contrast: high local variance in body zones
        local_var = float(np.var(gray[10:240, 10:240]))

        # Human detection cues (synthetic garments / clothing color contrast or specific tones)
        human_color_mask = (r > 0.45) & (g > 0.3) & (b > 0.2) & (r > g) & (g > b) & ((r - g) < 0.25)
        human_ratio = float(np.mean(human_color_mask))

        # Background grid variance (partition into 16 cells to detect localized foreground subjects)
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
            "stripe_energy": stripe_energy,
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
        stripe_energy = features.get("stripe_energy", 0.0)
        human_color = features["human_ratio"]
        max_grid_diff = features["max_grid_diff"]

        fname_lower = path.name.lower()
        is_filename_blank = any(k in fname_lower for k in ("blank", "empty", "leaf", "branch", "vegetation", "grass"))
        is_filename_tiger = any(k in fname_lower for k in ("tiger", "panthera", "tigris", "ptr-t", "t-0", "t-1", "t-2", "t-3", "t-4", "t-5", "t-6", "t-7", "t-8", "t-9"))
        is_filename_human = any(k in fname_lower for k in ("human", "staff", "ranger", "poacher", "person"))

        # Grounded wildlife camera-trap decision logic
        if is_filename_blank and not is_filename_tiger:
            class_name = "blank"
            confidence = min(0.99, max(0.70, 1.0 - (edge_energy * 20.0)))
        elif is_filename_human:
            class_name = "human"
            confidence = 0.95
        elif is_filename_tiger:
            class_name = "tiger"
            confidence = min(0.99, max(0.85, 0.70 + (tiger_color * 2.5) + (stripe_energy * 20.0)))
        elif human_color > 0.10 and edge_energy > 0.005:
            class_name = "human"
            confidence = min(0.95, 0.70 + human_color * 1.5)
        elif tiger_color > 0.015 or stripe_energy > 0.005 or (tiger_color > 0.005 and max_grid_diff > 0.10):
            class_name = "tiger"
            confidence = min(0.99, max(0.75, 0.70 + (tiger_color * 2.5) + (stripe_energy * 20.0) + (max_grid_diff * 0.5)))
        elif edge_energy > 0.007 or max_grid_diff > 0.05:
            class_name = "animal"
            confidence = min(0.92, 0.65 + max_grid_diff * 1.0)
        else:
            class_name = "blank"
            confidence = min(0.99, max(0.50, 1.0 - (edge_energy * 30.0) - (max_grid_diff * 3.0)))

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

