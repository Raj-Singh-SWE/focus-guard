from sqlalchemy.orm import Session
import models
import schemas
import datetime

# ─────────────────────────────────────────────────
#  User CRUD
# ─────────────────────────────────────────────────
def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_or_create_default_user(db: Session) -> models.User:
    """Ensures at least one user exists for the prototype"""
    user = get_user(db, 1)
    if not user:
        # Default user with expirations 6 months from now
        future = datetime.datetime.utcnow() + datetime.timedelta(days=180)
        user = models.User(
            name="Raj Singh",
            dob=datetime.datetime(2005, 1, 1), # Default 21 years old
            license_number="DL-12345-ABCD",
            license_expiry=future,
            insurance_expiry=future
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

def update_user(db: Session, user_id: int, user_update: schemas.UserUpdate):
    db_user = get_user(db, user_id)
    if not db_user:
        return None
    
    update_data = user_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_user, key, value)
    
    db.commit()
    db.refresh(db_user)
    return db_user

# ─────────────────────────────────────────────────
#  Driving Session CRUD
# ─────────────────────────────────────────────────
def create_driving_session(db: Session):
    db_session = models.DrivingSession()
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session

def update_driving_session(db: Session, session_id: int, session_update: schemas.DrivingSessionUpdate):
    db_session = db.query(models.DrivingSession).filter(models.DrivingSession.id == session_id).first()
    if not db_session:
        return None
        
    db_session.duration = session_update.duration
    db_session.alerts_triggered = session_update.alerts_triggered
    
    db.commit()
    db.refresh(db_session)
    return db_session

def get_driving_sessions(db: Session, skip: int = 0, limit: int = 50):
    # Return newest first
    return db.query(models.DrivingSession).order_by(models.DrivingSession.id.desc()).offset(skip).limit(limit).all()
