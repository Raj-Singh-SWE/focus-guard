from sqlalchemy import Column, Integer, String, DateTime, Float
from database import Base
import datetime

class User(Base):
    """
    User model to track basic profile and admin documents
    """
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String, index=True)
    dob = Column(DateTime, nullable=True)
    license_number = Column(String, nullable=True)
    license_expiry = Column(DateTime)
    insurance_expiry = Column(DateTime)
    emergency_contact = Column(String, nullable=True)

class EmergencyDispatch(Base):
    """
    Log of automatic accident SOS notifications. Tracks atomic dispatch events.
    """
    __tablename__ = "emergency_dispatches"
    
    id = Column(Integer, primary_key=True, index=True)
    user_email = Column(String, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    contact_called = Column(String)
    police_notified = Column(Integer, default=1) # 1 = Yes
    status = Column(String, default="DISPATCHED")

class DrivingSession(Base):
    """
    Tracks telemetry and driver status during an active trip
    """
    __tablename__ = "driving_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_email = Column(String, index=True, nullable=True)
    start_time = Column(DateTime, default=datetime.datetime.utcnow)
    duration = Column(Float, default=0.0) # Duration in seconds
    alerts_triggered = Column(Integer, default=0) # e.g. Count of drowsiness detected
