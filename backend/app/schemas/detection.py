from pydantic import BaseModel
from typing import Optional, Any

class DetectionBase(BaseModel):
    class_name: str
    yolo_confidence: float
    mobilenet_probability: float
    is_defective: bool
    box_x1: int
    box_y1: int
    box_x2: int
    box_y2: int
    polygon_points: Optional[list[list[float]]] = None

class DetectionCreate(DetectionBase):
    pass

class Detection(DetectionBase):
    id: str
    inspection_id: str

    class Config:
        from_attributes = True
