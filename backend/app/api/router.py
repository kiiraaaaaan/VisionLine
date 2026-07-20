from fastapi import APIRouter
from backend.app.api.endpoints import inspections, analytics, analyze, metrics

api_router = APIRouter()

# Include resource routers
api_router.include_router(inspections.router, prefix="/inspections", tags=["Inspections"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
api_router.include_router(analyze.router, prefix="/analyze", tags=["Live Analysis"])
api_router.include_router(metrics.router, prefix="/metrics", tags=["Model Metrics"])
