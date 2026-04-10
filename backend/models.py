from sqlalchemy import Column, Integer, String, DateTime, Float
from database import Base
import datetime

class User(Base):
    """
    User model to track basic profile and admin documents
    """
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    license_expiry = Column(DateTime)
    insurance_expiry = Column(DateTime)

class DrivingSession(Base):
    """
    Tracks telemetry and driver status during an active trip
    """
    __tablename__ = "driving_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    start_time = Column(DateTime, default=datetime.datetime.utcnow)
    duration = Column(Float, default=0.0) # Duration in seconds
    alerts_triggered = Column(Integer, default=0) # e.g. Count of drowsiness detected
