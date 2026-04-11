from pydantic import BaseModel
from datetime import datetime
from typing import Optional

# ─────────────────────────────────────────────────
#  User Schemas
# ─────────────────────────────────────────────────
class UserBase(BaseModel):
    email: str
    name: str

class UserCreate(UserBase):
    dob: datetime
    license_number: str
    license_expiry: datetime
    insurance_expiry: datetime

class UserUpdate(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None
    dob: Optional[datetime] = None
    license_number: Optional[str] = None
    license_expiry: Optional[datetime] = None
    insurance_expiry: Optional[datetime] = None
    emergency_contact: Optional[str] = None

class UserResponse(UserBase):
    id: int
    dob: Optional[datetime] = None
    license_number: Optional[str] = None
    license_expiry: Optional[datetime] = None
    insurance_expiry: Optional[datetime] = None
    emergency_contact: Optional[str] = None

    class Config:
        from_attributes = True

# ─────────────────────────────────────────────────
#  Emergency Schemas
# ─────────────────────────────────────────────────
class EmergencyResponse(BaseModel):
    id: int
    user_email: str
    timestamp: datetime
    contact_called: str
    police_notified: int
    status: str

    class Config:
        from_attributes = True

# ─────────────────────────────────────────────────
#  Driving Session Schemas
# ─────────────────────────────────────────────────
class DrivingSessionBase(BaseModel):
    pass

class DrivingSessionCreate(DrivingSessionBase):
    user_email: Optional[str] = None

class DrivingSessionUpdate(BaseModel):
    duration: float
    alerts_triggered: int

class DrivingSessionResponse(DrivingSessionBase):
    id: int
    user_email: Optional[str] = None
    start_time: datetime
    duration: float
    alerts_triggered: int

    class Config:
        from_attributes = True
