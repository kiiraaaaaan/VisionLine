from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.app.schemas.inspection import DashboardStats
from backend.app.services import db_service

router = APIRouter()

@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_analytics(db: AsyncSession = Depends(get_db)):
    """Fetch dashboard statistics, defect rates, breakdowns, and daily history."""
    stats = await db_service.get_dashboard_stats(db)
    return stats
