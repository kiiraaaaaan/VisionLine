from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from backend.app.config import settings
from backend.app.database import engine, Base
from backend.app.api.router import api_router
from backend.app.services.ai_service import ai_service

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Initialize database tables automatically
    print("[FASTAPI STARTUP] Ensuring database tables exist...")
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("[FASTAPI STARTUP] Database tables verified.")
    except Exception as e:
        print(f"[FASTAPI STARTUP] WARNING: Could not connect to database: {e}")
        print("[FASTAPI STARTUP] Server will start, but DB-dependent endpoints will fail until PostgreSQL is running.")

    # 2. Load ML models and warm up
    print("[FASTAPI STARTUP] Loading YOLO11 and MobileNetV3 checkpoints...")
    try:
        ai_service.load_models()
        print("[FASTAPI STARTUP] AI Models warmed up and operational.")
    except Exception as e:
        print(f"[FASTAPI STARTUP] CRITICAL ERROR loading AI models: {e}")
        print("Please verify models are present in the models/ folder.")
    
    yield
    
    # Clean up and shutdown operations
    print("[FASTAPI SHUTDOWN] Disposing database engine...")
    await engine.dispose()
    print("[FASTAPI SHUTDOWN] Cleaned up resource pools.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# Set CORS middleware parameters (allow all origins to support local Wi-Fi cameras)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "api_docs": "/docs"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "database": "connected"  # Simple ping
    }
