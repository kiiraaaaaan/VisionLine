import os
from pathlib import Path
from pydantic_settings import BaseSettings

# Root path of the project workspace
ROOT_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    API_V1_STR: str = "/api"
    PROJECT_NAME: str = "VisionLine Quality Inspection Platform"
    
    # Database configuration
    # Default to local PostgreSQL container set up by docker-compose
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql+asyncpg://postgres:postgrespassword@localhost:5432/ridac"
    )
    
    # Model Configurations
    KERAS_MODEL_PATH: str = os.getenv(
        "KERAS_MODEL_PATH",
        str(ROOT_DIR / "models" / "industry_defect.keras")
    )
    
    # Confidence metrics configuration
    LOW_CONFIDENCE_THRESHOLD: float = float(os.getenv("LOW_CONFIDENCE_THRESHOLD", "0.70"))
    CLASSIFIER_BACKEND: str = os.getenv("CLASSIFIER_BACKEND", "keras")
    
    # CORS Origins (frontend default development port is 3000)
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ]

    class Config:
        case_sensitive = True

settings = Settings()
