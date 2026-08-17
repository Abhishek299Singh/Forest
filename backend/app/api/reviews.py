import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import (
    ReviewTask, ReviewDecision, Image, Tiger, TigerImage, TigerSighting,
    CameraStation, Detection, AuditLog
)
from app.api.auth import get_current_user
from app.services.occupancy import occupancy_engine
from app.services.movement_alert import movement_alert_engine

router = APIRouter(prefix="/reviews", tags=["Human Review"])

class DecisionSubmitRequest(BaseModel):
    task_id: str
    action_taken: str  # "confirm_candidate", "create_new_tiger", "reject_candidate", "mark_uncertain", "correct_metadata"
    selected_tiger_id: Optional[str] = None
    new_tiger_code: Optional[str] = None
    new_callsign: Optional[str] = None
    corrected_station_id: Optional[str] = None
    notes: Optional[str] = None

@router.get("/tasks")
def list_review_tasks(
    status: str = "pending",
    task_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = (
        db.query(ReviewTask, Image, CameraStation)
        .join(Image, ReviewTask.image_id == Image.id)
        .outerjoin(CameraStation, Image.station_id == CameraStation.id)
        .filter(ReviewTask.status == status)
    )
    if task_type:
        query = query.filter(ReviewTask.task_type == task_type)

    tasks = query.order_by(ReviewTask.created_at.desc()).all()
    results = []
    for t, img, st in tasks:
        candidate_ids = json.loads(t.candidate_tiger_ids_json) if t.candidate_tiger_ids_json else []
        scores = json.loads(t.similarity_scores_json) if t.similarity_scores_json else []
        
        candidates = []
        for idx, cid in enumerate(candidate_ids):
            tiger = db.query(Tiger).filter(Tiger.id == cid).first()
            if tiger:
                candidates.append({
                    "tiger_id": tiger.id,
                    "tiger_code": tiger.tiger_code,
                    "callsign": tiger.callsign,
                    "similarity": scores[idx] if idx < len(scores) else 0.70
                })

        results.append({
            "id": t.id,
            "task_type": t.task_type,
            "priority": t.priority,
            "status": t.status,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "image": {
                "id": img.id,
                "filename": img.filename,
                "captured_at": img.captured_at.isoformat() if img.captured_at else None,
                "station_code": st.code if st else img.station_code_detected,
                "station_name": st.name if st else "Unknown Station",
                "zone": st.zone if st else "Core",
                "thumbnail_url": f"/api/v1/images/{img.id}/thumbnail",
                "image_url": f"/api/v1/images/{img.id}/file"
            },
            "candidates": candidates
        })

    return results

@router.get("/tasks/{task_id}")
def get_task_detail(task_id: str, db: Session = Depends(get_db)):
    task = db.query(ReviewTask).filter(ReviewTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Review task not found")

    img = db.query(Image).filter(Image.id == task.image_id).first()
    st = db.query(CameraStation).filter(CameraStation.id == img.station_id).first() if img else None
    
    candidate_ids = json.loads(task.candidate_tiger_ids_json) if task.candidate_tiger_ids_json else []
    scores = json.loads(task.similarity_scores_json) if task.similarity_scores_json else []

    candidate_details = []
    for idx, cid in enumerate(candidate_ids):
        tiger = db.query(Tiger).filter(Tiger.id == cid).first()
        if tiger:
            ref_images = (
                db.query(TigerImage)
                .filter(TigerImage.tiger_id == tiger.id)
                .order_by(TigerImage.is_reference.desc())
                .limit(3)
                .all()
            )
            raw_score = scores[idx] if idx < len(scores) else 0.70
            sim_pct = int(round(raw_score * 100))
            is_ref = bool(tiger.is_reference or tiger.dataset_source == "amur_atrw")

            candidate_details.append({
                "tiger_id": tiger.id,
                "tiger_code": tiger.tiger_code,
                "callsign": tiger.callsign,
                "sex": tiger.sex,
                "age_class": tiger.age_class,
                "primary_zone": tiger.primary_zone,
                "dataset_source": "Amur/ATRW Reference Gallery" if is_ref else "Pench Resident Catalogue",
                "is_reference": is_ref,
                "similarity_score": raw_score,
                "similarity_percentage": f"{sim_pct}%",
                "similarity_display": f"Similarity: {sim_pct}%",
                "reference_images": [
                    {
                        "image_id": ri.image_id,
                        "flank_side": ri.flank_side,
                        "crop_url": f"/api/v1/images/{ri.image_id}/crop",
                        "flank_url": f"/api/v1/images/{ri.image_id}/flank",
                        "thumbnail_url": f"/api/v1/images/{ri.image_id}/thumbnail",
                        "image_url": f"/api/v1/images/{ri.image_id}/file"
                    }
                    for ri in ref_images
                ]
            })

    # Find crops for this image
    tiger_img = db.query(TigerImage).filter(TigerImage.image_id == img.id).first() if img else None

    return {
        "id": task.id,
        "task_type": task.task_type,
        "status": task.status,
        "priority": task.priority,
        "created_at": task.created_at.isoformat() if task.created_at else None,
        "image": {
            "id": img.id,
            "filename": img.filename,
            "captured_at": img.captured_at.isoformat() if img.captured_at else None,
            "station_id": st.id if st else None,
            "station_code": st.code if st else img.station_code_detected,
            "station_name": st.name if st else "Unknown Station",
            "zone": st.zone if st else "Core",
            "image_url": f"/api/v1/images/{img.id}/file",
            "thumbnail_url": f"/api/v1/images/{img.id}/thumbnail",
            "flank_crop_url": f"/api/v1/images/{img.id}/flank",
            "body_crop_url": f"/api/v1/images/{img.id}/crop",
            "flank_side": tiger_img.flank_side if tiger_img else "left"
        },
        "candidates": candidate_details
    }

@router.post("/decisions")
async def submit_decision(
    req: DecisionSubmitRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    task = db.query(ReviewTask).filter(ReviewTask.id == req.task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Review task not found")

    img = db.query(Image).filter(Image.id == task.image_id).first()
    reviewer_name = current_user.full_name if current_user else "Field Biologist"
    reviewer_role = current_user.role if current_user else "reviewer"

    target_tiger = None

    if req.action_taken == "confirm_candidate" and req.selected_tiger_id:
        target_tiger = db.query(Tiger).filter(Tiger.id == req.selected_tiger_id).first()
        if target_tiger:
            # If confirmed against a reference tiger, establish or link Pench identity
            st = db.query(CameraStation).filter(CameraStation.id == img.station_id).first()
            sighting = db.query(TigerSighting).filter(TigerSighting.image_id == img.id).first()
            if not sighting:
                sighting = TigerSighting(
                    tiger_id=target_tiger.id,
                    image_id=img.id,
                    station_id=st.id if st else db.query(CameraStation).first().id,
                    captured_at=img.captured_at,
                    latitude=st.latitude if st else 21.758,
                    longitude=st.longitude if st else 79.314,
                    confidence=1.0,
                    is_verified=True,
                    verified_by=reviewer_name,
                    notes=f"Confirmed via human review by {reviewer_name}: {req.notes or ''}"
                )
                db.add(sighting)
            else:
                sighting.tiger_id = target_tiger.id
                sighting.is_verified = True
                sighting.verified_by = reviewer_name

            # Dynamic Pench Gallery Growth: Enroll real Pench image and embedding
            t_img = db.query(TigerImage).filter(TigerImage.image_id == img.id).first()
            if not t_img:
                from app.ml.tiger_detector import TigerDetector
                from app.ml.stripe_embedder import StripeEmbedder
                from app.core.config import settings
                
                detector = TigerDetector()
                embedder = StripeEmbedder()
                
                det_res = detector.detect(img.storage_path)
                flank_side = det_res["flank_side"]
                crop_filename = f"flank_{img.id}_{flank_side}.jpg"
                crop_path = settings.CROPS_DIR / crop_filename
                detector.crop_flank(img.storage_path, det_res["flank_bbox"], crop_path)
                
                t_img = TigerImage(
                    tiger_id=target_tiger.id,
                    image_id=img.id,
                    flank_side=flank_side,
                    crop_path=str(crop_path),
                    original_image_path=img.storage_path,
                    dataset_source="pench_field",
                    is_reference=False,
                    quality_score=0.95
                )
                db.add(t_img)
                db.flush()
                
                stripe_vec = embedder.extract_embedding(crop_path)
                emb = TigerEmbedding(
                    tiger_id=target_tiger.id,
                    tiger_image_id=t_img.id,
                    embedding_json=json.dumps(stripe_vec),
                    dataset_source="pench_field",
                    model_version=embedder.model_version
                )
                db.add(emb)

            # Recalculate occupancy & movement alerts
            occupancy_engine.calculate_tiger_occupancy(db, target_tiger.id)
            await movement_alert_engine.evaluate_sighting_alerts(db, sighting)

    elif req.action_taken == "create_new_tiger":
        tiger_code = req.new_tiger_code or f"PTR-T-{db.query(Tiger).filter(Tiger.dataset_source == 'pench_field').count() + 1:03d}"
        callsign = req.new_callsign or f"Pench Resident ({tiger_code})"
        st = db.query(CameraStation).filter(CameraStation.id == img.station_id).first()
        
        target_tiger = Tiger(
            tiger_code=tiger_code,
            callsign=callsign,
            sex="Unknown",
            age_class="Adult",
            status="resident",
            dataset_source="pench_field",
            is_reference=False,
            primary_zone=st.zone if st else "Core",
            first_seen=img.captured_at,
            last_seen=img.captured_at,
            confidence=1.0,
            notes=f"Enrolled as new Pench resident tiger by {reviewer_name}. {req.notes or ''}"
        )
        db.add(target_tiger)
        db.flush()

        sighting = TigerSighting(
            tiger_id=target_tiger.id,
            image_id=img.id,
            station_id=st.id if st else db.query(CameraStation).first().id,
            captured_at=img.captured_at,
            latitude=st.latitude if st else 21.758,
            longitude=st.longitude if st else 79.314,
            confidence=1.0,
            is_verified=True,
            verified_by=reviewer_name,
            notes=f"Initial sighting enrolled upon review by {reviewer_name}"
        )
        db.add(sighting)

        # Enroll image & embedding into the Pench Tiger Gallery
        from app.ml.tiger_detector import TigerDetector
        from app.ml.stripe_embedder import StripeEmbedder
        from app.core.config import settings
        
        detector = TigerDetector()
        embedder = StripeEmbedder()
        
        det_res = detector.detect(img.storage_path)
        flank_side = det_res["flank_side"]
        crop_filename = f"flank_{img.id}_{flank_side}.jpg"
        crop_path = settings.CROPS_DIR / crop_filename
        detector.crop_flank(img.storage_path, det_res["flank_bbox"], crop_path)
        
        t_img = TigerImage(
            tiger_id=target_tiger.id,
            image_id=img.id,
            flank_side=flank_side,
            crop_path=str(crop_path),
            original_image_path=img.storage_path,
            dataset_source="pench_field",
            is_reference=False,
            quality_score=0.95
        )
        db.add(t_img)
        db.flush()
        
        stripe_vec = embedder.extract_embedding(crop_path)
        emb = TigerEmbedding(
            tiger_id=target_tiger.id,
            tiger_image_id=t_img.id,
            embedding_json=json.dumps(stripe_vec),
            dataset_source="pench_field",
            model_version=embedder.model_version
        )
        db.add(emb)
        occupancy_engine.calculate_tiger_occupancy(db, target_tiger.id)

    task.status = "resolved"

    # Create Decision record
    decision = ReviewDecision(
        task_id=task.id,
        entity_type="image",
        entity_id=img.id,
        reviewer_id=reviewer_name,
        action_taken=req.action_taken,
        new_value_json=json.dumps({
            "selected_tiger_id": req.selected_tiger_id,
            "target_tiger_code": target_tiger.tiger_code if target_tiger else None,
            "action": req.action_taken
        }),
        notes=req.notes
    )
    db.add(decision)

    # Audit log
    audit = AuditLog(
        actor_id=reviewer_name,
        actor_role=reviewer_role,
        action="review_decision_submitted",
        entity_type="review_task",
        entity_id=task.id,
        details_json=json.dumps({"action": req.action_taken, "notes": req.notes})
    )
    db.add(audit)
    db.commit()

    return {
        "status": "success",
        "task_id": task.id,
        "action_taken": req.action_taken,
        "tiger_code": target_tiger.tiger_code if target_tiger else None
    }
