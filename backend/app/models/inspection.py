import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, LargeBinary, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.database import Base

class Inspection(Base):
    __tablename__ = "inspections"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String(255), nullable=False)
    original_image_bytes = Column(LargeBinary, nullable=False)
    annotated_image_bytes = Column(LargeBinary, nullable=True)
    status = Column(String(50), nullable=False, default="PENDING")
    
    total_objects = Column(Integer, nullable=False, default=0)
    defective_objects = Column(Integer, nullable=False, default=0)
    max_defect_probability = Column(Float, nullable=True)
    
    yolo_time_ms = Column(Float, nullable=False, default=0.0)
    mobilenet_time_ms = Column(Float, nullable=False, default=0.0)
    total_time_ms = Column(Float, nullable=False, default=0.0)
    
    review_status = Column(String(50), nullable=False, default="PENDING")  # PENDING, APPROVED, REJECTED
    review_notes = Column(Text, nullable=True)
    reviewer_name = Column(String(255), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    message = Column(Text, nullable=True)
    # Relationships
    detections = relationship("Detection", back_populates="inspection", cascade="all, delete-orphan", lazy="selectin")
