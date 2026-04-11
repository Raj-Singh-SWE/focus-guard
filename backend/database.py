import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

# For Supabase, set DATABASE_URL in your .env (e.g., postgresql://postgres:password@db.supabase.co:5432/postgres)
# If not set, it safely falls back to your local SQLite database
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./focusdrive_v2.db")

if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    # SQLite local prototyping
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
else:
    # Supabase PostgreSQL production with connection pooling
    # SQLAlchemy requires 'postgresql://' instead of 'postgres://'
    if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
        SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)
        
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, 
        pool_size=5, 
        max_overflow=10,
        pool_pre_ping=True
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
