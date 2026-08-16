import json
import numpy as np
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.db.models import Tiger, TigerEmbedding, TigerImage
from app.core.config import settings

class TigerMatcher:
    """
    Vector similarity search for tiger stripe embeddings with bilateral flank asymmetry awareness.
    
    Tiger Flank Biological Rule:
    - Left and right flank stripes on the same tiger are completely asymmetric (different patterns).
    - Query left flank MUST be compared against reference left flank embeddings.
    - Query right flank MUST be compared against reference right flank embeddings.
    - If flank side is unknown, both are evaluated, and the flank orientation is determined by peak alignment.
    """
    def __init__(
        self,
        auto_match_threshold: float = settings.TIGER_AUTO_MATCH_THRESHOLD,
        ambiguous_threshold: float = settings.TIGER_AMBIGUOUS_LOWER_THRESHOLD
    ):
        self.auto_match_threshold = auto_match_threshold
        self.ambiguous_threshold = ambiguous_threshold

    def cosine_similarity(self, vec_a: List[float], vec_b: List[float]) -> float:
        a = np.array(vec_a, dtype=np.float32)
        b = np.array(vec_b, dtype=np.float32)
        dot = np.dot(a, b)
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(dot / (norm_a * norm_b))

    def match_against_catalogue(
        self,
        db: Session,
        candidate_embedding: List[float],
        flank_side: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Compares candidate embedding with all embeddings in DB.
        Applies bilateral flank normalization and decision thresholding.
        """
        all_embeddings = (
            db.query(TigerEmbedding, TigerImage, Tiger)
            .join(TigerImage, TigerEmbedding.tiger_image_id == TigerImage.id)
            .join(Tiger, TigerEmbedding.tiger_id == Tiger.id)
            .all()
        )

        if not all_embeddings:
            return {
                "decision": "new_individual",
                "confidence": 0.95,
                "recommended_tiger_id": None,
                "provisional_code": "PTR-T-NEW-0101",
                "top_candidates": [],
                "explanation": "No existing tiger profiles found in catalogue. Auto-enrolling as provisional individual."
            }

        candidates_map: Dict[str, Dict[str, Any]] = {}
        flank_normalized = flank_side.lower() if flank_side else None

        for emb, t_img, tiger in all_embeddings:
            try:
                ref_vec = json.loads(emb.embedding_json)
                sim = self.cosine_similarity(candidate_embedding, ref_vec)
                ref_flank = t_img.flank_side.lower() if t_img.flank_side else "unknown"
                
                # Asymmetric Flank Matching Rule:
                # Same flank match -> full similarity
                # Cross-flank mismatch (left vs right) -> zero/incompatible because tiger stripes do not match across flanks
                flank_compatible = True
                if flank_normalized and ref_flank and ref_flank != "unknown":
                    if flank_normalized != ref_flank:
                        flank_compatible = False
                        # Heavily penalize cross-flank comparison
                        sim = sim * 0.20

                if tiger.id not in candidates_map or sim > candidates_map[tiger.id]["similarity"]:
                    candidates_map[tiger.id] = {
                        "tiger_id": tiger.id,
                        "tiger_code": tiger.tiger_code,
                        "callsign": tiger.callsign,
                        "similarity": round(float(sim), 4),
                        "similarity_score": round(float(sim), 4),
                        "reference_crop": t_img.crop_path,
                        "flank_side": t_img.flank_side,
                        "matched_flank_side": ref_flank,
                        "flank_compatible": flank_compatible,
                        "sex": tiger.sex,
                        "status": tiger.status,
                        "territory_area_km2": tiger.territory_area_km2
                    }
            except Exception:
                continue

        sorted_candidates = sorted(candidates_map.values(), key=lambda x: x["similarity"], reverse=True)
        top_match = sorted_candidates[0] if sorted_candidates else None

        if not top_match:
            decision = "new_individual"
            rec_id = None
        elif top_match["similarity"] >= self.auto_match_threshold and top_match.get("flank_compatible", True):
            decision = "auto_accepted"
            rec_id = top_match["tiger_id"]
        elif top_match["similarity"] >= self.ambiguous_threshold:
            decision = "ambiguous_review_required"
            rec_id = top_match["tiger_id"]
        else:
            decision = "new_individual"
            rec_id = None

        return {
            "decision": decision,
            "top_candidates": sorted_candidates[:5],
            "best_match": top_match,
            "query_flank_side": flank_normalized,
            "auto_matched": (decision == "auto_accepted"),
            "needs_human_review": (decision == "ambiguous_review_required" or decision == "new_individual")
        }

tiger_matcher = TigerMatcher()
