from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
from backend.app.schemas.detection import Detection

class InspectionBase(BaseModel):
    filename: str
    status: str
    total_objects: int = 0
    defective_objects: int = 0
    max_defect_probability: Optional[float] = None
    yolo_time_ms: float = 0.0
    mobilenet_time_ms: float = 0.0
    total_time_ms: float = 0.0
    review_status: str = "PENDING"
    review_notes: Optional[str] = None
    reviewer_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    message: Optional[str] = None

class InspectionCreate(InspectionBase):
    pass

class InspectionReviewUpdate(BaseModel):
    review_status: str  # APPROVED, REJECTED, PENDING
    review_notes: Optional[str] = None
    reviewer_name: Optional[str] = "Quality Manager"

class InspectionResponse(BaseModel):
    id: str
    filename: str
    status: str
    total_objects: int
    defective_objects: int
    max_defect_probability: Optional[float]
    total_time_ms: float
    review_status: str
    created_at: datetime

    class Config:
        from_attributes = True

class InspectionDetailResponse(InspectionResponse):
    yolo_time_ms: float
    mobilenet_time_ms: float
    review_notes: Optional[str]
    reviewer_name: Optional[str]
    reviewed_at: Optional[datetime]
    message: Optional[str]
    detections: list[Detection] = []

    class Config:
        from_attributes = True

class DashboardStats(BaseModel):
    total_inspections: int
    defect_rate: float  # Percentage (e.g. 15.5%)
    defective_count: int
    normal_count: int
    no_objects_count: int
    avg_inference_time_ms: float
    pending_reviews_count: int
    defect_class_counts: Dict[str, int]
    daily_trends: list[Dict[str, Any]]  # [{"date": "2026-07-18", "total": 100, "defective": 5}]
