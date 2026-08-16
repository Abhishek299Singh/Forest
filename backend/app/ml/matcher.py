import json
import numpy as np
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.db.models import Tiger, TigerEmbedding, TigerImage
from app.core.config import settings

class TigerMatcher:
    """
    Vector similarity search for tiger stripe embeddings.
    Performs cosine similarity across registered individuals in the persistent catalogue.
    """
    def __init__(
        self,
        auto_match_threshold: float = settings.TIGER_AUTO_MATCH_THRESHOLD,
        ambiguous_threshold: float = settings.TIGER_AMBIGUOUS_THRESHOLD
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
        Returns top candidates, similarity scores, decision status, and recommendation.
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

        for emb, t_img, tiger in all_embeddings:
            try:
                ref_vec = json.loads(emb.embedding_json)
                sim = self.cosine_similarity(candidate_embedding, ref_vec)
                
                # Bonus if flank side matches
                if flank_side and t_img.flank_side and flank_side == t_img.flank_side:
                    sim = min(1.0, sim * 1.05)

                if tiger.id not in candidates_map or sim > candidates_map[tiger.id]["similarity"]:
                    candidates_map[tiger.id] = {
                        "tiger_id": tiger.id,
                        "tiger_code": tiger.tiger_code,
                        "callsign": tiger.callsign,
                        "similarity": round(float(sim), 4),
                        "reference_crop": t_img.crop_path,
                        "flank_side": t_img.flank_side,
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
        elif top_match["similarity"] >= self.auto_match_threshold:
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
            "auto_matched": (decision == "auto_accepted"),
            "needs_human_review": (decision == "ambiguous_review_required" or decision == "new_individual")
        }

tiger_matcher = TigerMatcher()
