import uuid
from sqlalchemy import Column, String, Float, Boolean, Integer, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.app.database import Base

class Detection(Base):
    __tablename__ = "detections"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    inspection_id = Column(String(36), ForeignKey("inspections.id", ondelete="CASCADE"), nullable=False)
    
    class_name = Column(String(100), nullable=False)
    yolo_confidence = Column(Float, nullable=False)
    mobilenet_probability = Column(Float, nullable=False)
    is_defective = Column(Boolean, nullable=False)
    
    # Bounding box coordinates
    box_x1 = Column(Integer, nullable=False)
    box_y1 = Column(Integer, nullable=False)
    box_x2 = Column(Integer, nullable=False)
    box_y2 = Column(Integer, nullable=False)
    
    # Polygon points stored as JSON array: [[x1, y1], [x2, y2], ...]
    polygon_points = Column(JSON, nullable=True)

    # Relationship back to parent inspection
    inspection = relationship("Inspection", back_populates="detections")
