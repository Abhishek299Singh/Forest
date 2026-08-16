from typing import Dict, Any, Optional
from app.db.models import User

class PrivacyPolicyManager:
    """
    Enforces privacy policy on human images and sensitive field staff telemetry.
    """
    @staticmethod
    def can_view_human_images(user_role: str) -> bool:
        """Only Admin and Biologist roles are permitted to view unblurred human images."""
        return user_role.lower() in ["admin", "biologist"]

    @staticmethod
    def sanitize_image_payload(image_dict: Dict[str, Any], user_role: str) -> Dict[str, Any]:
        """Redacts or masks human image paths if user is not authorized."""
        if image_dict.get("is_human_detection") or image_dict.get("class_name") == "human":
            if not PrivacyPolicyManager.can_view_human_images(user_role):
                image_dict["is_redacted"] = True
                image_dict["redaction_notice"] = "Human detection privacy protected. Restricted to Field Director & Biologist."
        return image_dict

privacy_policy_manager = PrivacyPolicyManager()
