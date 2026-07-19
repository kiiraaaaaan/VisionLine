from __future__ import annotations

import sys
import io
import time
from pathlib import Path
from dataclasses import dataclass
from typing import Optional

import cv2
import numpy as np
import torch
from PIL import Image, ImageDraw, ImageFont, ImageOps

# Add workspace root to system path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.app.config import settings
from backend.app.services.classifier_service import get_classifier

@dataclass
class SegmentedObject:
    crop: Image.Image
    class_name: str
    class_id: int
    yolo_confidence: float
    box: tuple[int, int, int, int]
    polygon: Optional[np.ndarray]

def _sync_cuda(device: torch.device) -> None:
    if device.type == "cuda":
        torch.cuda.synchronize(device)

class AIService:
    def __init__(self):
        self.device = None
        self.classifier = None
        self.class_to_idx = None
        self.threshold = 0.5
        self.image_size = 224
        self.is_loaded = False
        self.person_detector = None

    def load_models(self) -> None:
        """Load the configured classification model backend."""
        if self.is_loaded:
            return

        self.device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
        print(f"[AI SERVICE] Loading models on device: {self.device}")
        
        # Load Classifier dynamically via factory
        print(f"[AI SERVICE] Initializing classifier backend: {settings.CLASSIFIER_BACKEND}")
        self.classifier = get_classifier(settings.CLASSIFIER_BACKEND)
        self.classifier.load(self.device)
        
        self.class_to_idx = self.classifier.class_to_idx
        self.threshold = self.classifier.threshold
        if hasattr(self.classifier, "image_size"):
            self.image_size = self.classifier.image_size

        # Load pre-trained YOLO person detector model
        yolo_path = ROOT_DIR / "models" / "yolov8n.pt"
        if yolo_path.is_file():
            try:
                from ultralytics import YOLO
                self.person_detector = YOLO(str(yolo_path))
                print("[FASTAPI STARTUP] Loaded YOLOv8 COCO person detector successfully.")
            except Exception as e:
                print(f"[FASTAPI STARTUP] WARNING: Failed to load YOLOv8 COCO person detector: {e}")

        self._warm_up()
        self.is_loaded = True
        print(f"[AI SERVICE] Models loaded successfully. Backend: {settings.CLASSIFIER_BACKEND}. Threshold: {self.threshold}")

    def _warm_up(self) -> None:
        """Warm up classifier model."""
        if self.class_to_idx:
            dummy_crop = Image.fromarray(np.zeros((self.image_size, self.image_size, 3), dtype=np.uint8))
            dummy_obj = SegmentedObject(
                crop=dummy_crop,
                class_name=list(self.class_to_idx.keys())[0],
                class_id=0,
                yolo_confidence=1.0,
                box=(0, 0, self.image_size, self.image_size),
                polygon=None
            )
            self.classifier.classify_batch([dummy_obj])
        _sync_cuda(self.device)

    def classify(self, objects: list[SegmentedObject]) -> tuple[np.ndarray, float]:
        """Perform batch classification."""
        if not objects:
            return np.empty(0, dtype=np.float32), 0.0

        _sync_cuda(self.device)
        started = time.perf_counter()
        probabilities = self.classifier.classify_batch(objects)
        _sync_cuda(self.device)
        elapsed_ms = (time.perf_counter() - started) * 1000.0
        return probabilities, elapsed_ms

    def annotate(self, image: Image.Image, is_defective: bool) -> Image.Image:
        """Render border overlay representing quality status."""
        canvas = image.convert("RGB").copy()
        draw = ImageDraw.Draw(canvas)
        width, height = canvas.size
        
        # Red border for defective, Green border for normal
        color = (225, 45, 45) if is_defective else (35, 180, 90)
        border_width = max(6, round(max(width, height) / 100))
        
        for i in range(border_width):
            draw.rectangle(
                (i, i, width - 1 - i, height - 1 - i),
                outline=color
            )
        return canvas

    def annotate_person(self, image: Image.Image, boxes: list) -> Image.Image:
        """Draw a blue border around the image and bounding boxes around detected humans."""
        canvas = image.convert("RGB").copy()
        draw = ImageDraw.Draw(canvas)
        width, height = canvas.size
        
        # 1. Blue border around the screen
        blue_color = (0, 113, 227)
        border_width = max(6, round(max(width, height) / 100))
        for i in range(border_width):
            draw.rectangle(
                (i, i, width - 1 - i, height - 1 - i),
                outline=blue_color
            )
            
        # 2. Bounding boxes around people
        for box in boxes:
            x1, y1, x2, y2 = box
            draw.rectangle(
                (x1, y1, x2, y2),
                outline=blue_color,
                width=3
            )
            
        return canvas

    def inspect_image(
        self, 
        image_bytes: bytes, 
        filename: str, 
        yolo_conf: float = 0.25, 
        yolo_iou: float = 0.70,
        threshold: Optional[float] = None
    ) -> tuple[dict, bytes]:
        """Runs the inspection pipeline using the Keras classifier."""
        if not self.is_loaded:
            self.load_models()

        try:
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        except Exception as e:
            return {
                "filename": filename,
                "status": "ERROR",
                "total_objects": 0,
                "defective_objects": 0,
                "max_defect_probability": None,
                "yolo_time_ms": 0.0,
                "mobilenet_time_ms": 0.0,
                "total_time_ms": 0.0,
                "message": f"Invalid image format: {str(e)}",
                "detections": []
            }, b""

        pipeline_started = time.perf_counter()
        
        # 1. Out-Of-Distribution (OOD) Validation Heuristic Check
        # Check standard deviation of image pixels to detect blank/uniform/noise frames
        img_np = np.asarray(image)
        print(f"[AI SERVICE] Received frame std: {img_np.std()}", flush=True)
        if img_np.std() < 1.5:
            # NOTE: Reliable out-of-distribution (unsupported image) detection is not natively possible
            # with a binary classifier trained strictly on defective/non-defective industrial equipment.
            # However, we implement a basic visual sanity check for empty or solid color frames:
            return {
                "filename": filename,
                "status": "UNSUPPORTED",
                "total_objects": 0,
                "defective_objects": 0,
                "max_defect_probability": None,
                "yolo_time_ms": 0.0,
                "mobilenet_time_ms": 0.0,
                "total_time_ms": 0.0,
                "message": "The uploaded image does not appear to contain industrial equipment that this platform was designed to inspect.",
                "detections": []
            }, image_bytes

        # Check if a human operator is present in the frame
        if self.person_detector is not None:
            try:
                yolo_results = self.person_detector(image, verbose=False)
                if yolo_results and len(yolo_results) > 0:
                    person_boxes = []
                    for box in yolo_results[0].boxes:
                        cls_id = int(box.cls[0])
                        conf = float(box.conf[0])
                        # Class 0 in COCO dataset is 'person'
                        if cls_id == 0 and conf >= 0.5:
                            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                            person_boxes.append((int(x1), int(y1), int(x2), int(y2)))
                    
                    if len(person_boxes) > 0:
                        # Human detected!
                        annotated_image = self.annotate_person(image, person_boxes)
                        annotated_buffer = io.BytesIO()
                        annotated_image.save(annotated_buffer, format="JPEG", quality=85)
                        annotated_bytes = annotated_buffer.getvalue()
                        
                        total_time = (time.perf_counter() - pipeline_started) * 1000.0
                        
                        return {
                            "filename": filename,
                            "status": "HUMAN",
                            "total_objects": len(person_boxes),
                            "defective_objects": 0,
                            "max_defect_probability": 0.0,
                            "yolo_time_ms": 0.0,
                            "mobilenet_time_ms": 0.0,
                            "total_time_ms": total_time,
                            "message": "Human operator detected in inspection workspace.",
                            "detections": [{
                                "class_name": "Human",
                                "yolo_confidence": 1.0,
                                "mobilenet_probability": 0.0,
                                "is_defective": False,
                                "box_x1": b[0],
                                "box_y1": b[1],
                                "box_x2": b[2],
                                "box_y2": b[3],
                                "polygon_points": None
                            } for b in person_boxes]
                        }, annotated_bytes
            except Exception as e:
                print(f"[AI SERVICE] Human detection error: {e}", flush=True)

        # 2. Run Direct Keras Classification on the full image frame
        width, height = image.size
        # Wrap image in a dummy SegmentedObject to maintain compatibility with classify batching
        dummy_obj = SegmentedObject(
            crop=image,
            class_name="Industrial Equipment",
            class_id=0,
            yolo_confidence=1.0,
            box=(0, 0, width, height),
            polygon=None
        )
        
        probabilities, mobile_ms = self.classify([dummy_obj])
        prob = float(probabilities[0])
        
        # Determine threshold
        active_threshold = threshold if threshold is not None else self.threshold
        is_def = prob < active_threshold
        
        _sync_cuda(self.device)
        total_inference_ms = (time.perf_counter() - pipeline_started) * 1000.0

        # Calculate prediction confidence based on output class
        confidence = (1.0 - prob) if is_def else prob
        is_low_confidence = confidence < settings.LOW_CONFIDENCE_THRESHOLD

        # Build compat detection object list representing the inspected item
        detections_data = [{
            "class_name": "Industrial Equipment",
            "yolo_confidence": 1.0,
            "mobilenet_probability": prob,
            "is_defective": is_def,
            "box_x1": 0,
            "box_y1": 0,
            "box_x2": width,
            "box_y2": height,
            "polygon_points": None
        }]

        status = "DEFECTIVE" if is_def else "NORMAL"
        message = "Inference run successful"
        if is_low_confidence:
            message = "Low confidence prediction. Manual inspection is recommended."

        # Generate annotated image with status border overlay
        annotated_image = self.annotate(image, is_def)
        annotated_buffer = io.BytesIO()
        annotated_image.save(annotated_buffer, format="JPEG", quality=85)
        annotated_bytes = annotated_buffer.getvalue()

        inspection_result = {
            "filename": filename,
            "status": status,
            "total_objects": 1,
            "defective_objects": 1 if is_def else 0,
            "max_defect_probability": prob,
            "yolo_time_ms": 0.0,
            "mobilenet_time_ms": mobile_ms,
            "total_time_ms": total_inference_ms,
            "message": message,
            "detections": detections_data
        }

        return inspection_result, annotated_bytes

# Initialize global singleton instance
ai_service = AIService()
