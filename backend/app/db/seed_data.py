from sqlalchemy.orm import Session
from app.core.security import get_password_hash
from app.db.models import User

def seed_database(db: Session):
    """
    Initializes necessary baseline authentication users for field deployment.
    Does NOT seed fake tigers, mock camera stations, pre-generated sightings, or fake alerts.
    The database starts completely empty of wildlife data, waiting for raw SD-card imports.
    """
    if db.query(User).count() == 0:
        users = [
            User(
                email="admin@pench.gov.in",
                full_name="Dr. Shubham Sharma (Field Director)",
                hashed_password=get_password_hash("pench123"),
                role="admin"
            ),
            User(
                email="biologist@pench.gov.in",
                full_name="Priya Sengupta (Wildlife Biologist)",
                hashed_password=get_password_hash("pench123"),
                role="biologist"
            ),
            User(
                email="staff@pench.gov.in",
                full_name="Rajesh Uikey (Turia Range Forest Officer)",
                hashed_password=get_password_hash("pench123"),
                role="forest_staff"
            ),
            User(
                email="reviewer@pench.gov.in",
                full_name="Amitabh Verma (Camera Trap Data Analyst)",
                hashed_password=get_password_hash("pench123"),
                role="reviewer"
            )
        ]
        db.add_all(users)
        db.commit()
