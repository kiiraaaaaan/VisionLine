from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select, func, desc, and_, cast, Date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.models.inspection import Inspection
from backend.app.models.detection import Detection
from backend.app.schemas.inspection import InspectionReviewUpdate

async def create_inspection(
    db: AsyncSession, 
    result_data: dict, 
    original_bytes: bytes, 
    annotated_bytes: bytes
) -> Inspection:
    """Create an inspection record and its corresponding detections in the database."""
    # Create the parent inspection
    db_inspection = Inspection(
        filename=result_data["filename"],
        original_image_bytes=original_bytes,
        annotated_image_bytes=annotated_bytes,
        status=result_data["status"],
        total_objects=result_data["total_objects"],
        defective_objects=result_data["defective_objects"],
        max_defect_probability=result_data["max_defect_probability"],
        yolo_time_ms=result_data["yolo_time_ms"],
        mobilenet_time_ms=result_data["mobilenet_time_ms"],
        total_time_ms=result_data["total_time_ms"],
        message=result_data["message"],
        review_status="PENDING" if result_data["status"] == "DEFECTIVE" else "APPROVED" # Auto approve normal/no-object runs
    )
    db.add(db_inspection)
    await db.flush() # Flush to populate db_inspection.id
    
    # Create child detections
    for det in result_data["detections"]:
        db_det = Detection(
            inspection_id=db_inspection.id,
            class_name=det["class_name"],
            yolo_confidence=det["yolo_confidence"],
            mobilenet_probability=det["mobilenet_probability"],
            is_defective=det["is_defective"],
            box_x1=det["box_x1"],
            box_y1=det["box_y1"],
            box_x2=det["box_x2"],
            box_y2=det["box_y2"],
            polygon_points=det["polygon_points"]
        )
        db.add(db_det)
        
    await db.commit()
    await db.refresh(db_inspection)
    return db_inspection

async def get_inspections(
    db: AsyncSession, 
    status: Optional[str] = None, 
    review_status: Optional[str] = None, 
    page: int = 1, 
    limit: int = 20
) -> tuple[list[Inspection], int]:
    """Retrieve inspections with pagination and filtering by status or review status."""
    conditions = []
    if status:
        conditions.append(Inspection.status == status)
    if review_status:
        conditions.append(Inspection.review_status == review_status)
        
    where_clause = and_(*conditions) if conditions else True
    
    # Count total query
    count_stmt = select(func.count(Inspection.id)).where(where_clause)
    count_result = await db.execute(count_stmt)
    total_count = count_result.scalar_one()
    
    # Paginated select
    stmt = (
        select(Inspection)
        .where(where_clause)
        .order_by(desc(Inspection.created_at))
        .offset((page - 1) * limit)
        .limit(limit)
    )
    result = await db.execute(stmt)
    inspections = list(result.scalars().all())
    
    return inspections, total_count

async def get_inspection_by_id(db: AsyncSession, inspection_id: str) -> Optional[Inspection]:
    """Get a detailed inspection record by ID, loading all nested detections."""
    stmt = (
        select(Inspection)
        .where(Inspection.id == inspection_id)
        .options(selectinload(Inspection.detections))
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()

async def update_inspection_review(
    db: AsyncSession, 
    inspection_id: str, 
    review_data: InspectionReviewUpdate
) -> Optional[Inspection]:
    """Update the manager review fields for a specific inspection."""
    inspection = await get_inspection_by_id(db, inspection_id)
    if not inspection:
        return None
        
    inspection.review_status = review_data.review_status
    inspection.review_notes = review_data.review_notes
    inspection.reviewer_name = review_data.reviewer_name
    inspection.reviewed_at = datetime.now(timezone.utc)
    
    await db.commit()
    await db.refresh(inspection)
    return inspection

async def get_dashboard_stats(db: AsyncSession) -> dict:
    """Compile aggregated analytics and timeseries data for the dashboard views."""
    # Total counts
    total_stmt = select(func.count(Inspection.id))
    total_res = await db.execute(total_stmt)
    total = total_res.scalar_one()
    
    if total == 0:
        return {
            "total_inspections": 0,
            "defect_rate": 0.0,
            "defective_count": 0,
            "normal_count": 0,
            "no_objects_count": 0,
            "avg_inference_time_ms": 0.0,
            "pending_reviews_count": 0,
            "defect_class_counts": {},
            "daily_trends": []
        }
        
    # Status distribution
    status_stmt = select(Inspection.status, func.count(Inspection.id)).group_by(Inspection.status)
    status_res = await db.execute(status_stmt)
    status_counts = {status: count for status, count in status_res.all()}
    
    defective_count = status_counts.get("DEFECTIVE", 0)
    normal_count = status_counts.get("NORMAL", 0)
    no_objects_count = status_counts.get("NO_OBJECTS", 0)
    
    # Calculate defect rate as percentage of defective inspections vs normal + defective
    tested = normal_count + defective_count
    defect_rate = round((defective_count / tested * 100.0), 1) if tested > 0 else 0.0
    
    # Average total inference time (excluding errors/warmups)
    avg_time_stmt = select(func.avg(Inspection.total_time_ms)).where(Inspection.status != "ERROR")
    avg_time_res = await db.execute(avg_time_stmt)
    avg_inference_time_ms = round(avg_time_res.scalar_one() or 0.0, 1)
    
    # Pending reviews
    pending_stmt = select(func.count(Inspection.id)).where(Inspection.review_status == "PENDING")
    pending_res = await db.execute(pending_stmt)
    pending_reviews_count = pending_res.scalar_one()
    
    # Counts of specific defect classes in detections
    class_stmt = (
        select(Detection.class_name, func.count(Detection.id))
        .where(Detection.is_defective == True)
        .group_by(Detection.class_name)
    )
    class_res = await db.execute(class_stmt)
    defect_class_counts = {name: count for name, count in class_res.all()}
    
    # Daily trends (last 14 days)
    # Cast date grouping compatible with Postgres
    daily_stmt = (
        select(
            cast(Inspection.created_at, Date).label("day"),
            func.count(Inspection.id).label("total"),
            func.count(func.nullif(Inspection.status != "DEFECTIVE", True)).label("defective")
        )
        .group_by(cast(Inspection.created_at, Date))
        .order_by(desc("day"))
        .limit(14)
    )
    daily_res = await db.execute(daily_stmt)
    daily_trends = []
    
    # Reverse trends to chronological order for charts
    for row in reversed(daily_res.all()):
        daily_trends.append({
            "date": str(row.day),
            "total": row.total,
            "defective": row.defective
        })
        
    return {
        "total_inspections": total,
        "defect_rate": defect_rate,
        "defective_count": defective_count,
        "normal_count": normal_count,
        "no_objects_count": no_objects_count,
        "avg_inference_time_ms": avg_inference_time_ms,
        "pending_reviews_count": pending_reviews_count,
        "defect_class_counts": defect_class_counts,
        "daily_trends": daily_trends
    }



