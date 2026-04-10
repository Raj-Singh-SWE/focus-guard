from sqlalchemy.orm import Session
import models
import schemas
import datetime

# ─────────────────────────────────────────────────
#  User CRUD
# ─────────────────────────────────────────────────
def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def create_or_update_user(db: Session, email: str, user_update: schemas.UserUpdate):
    db_user = get_user_by_email(db, email)
    
    update_data = user_update.model_dump(exclude_unset=True)
    
    if not db_user:
        # Create new user
        db_user = models.User(email=email)
        db.add(db_user)
        
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
