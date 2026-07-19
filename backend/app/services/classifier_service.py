from __future__ import annotations

import os
from abc import ABC, abstractmethod
from pathlib import Path
import numpy as np
import torch
from PIL import Image, ImageOps

from backend.app.config import settings

class BaseClassifier(ABC):
    @abstractmethod
    def load(self, device: torch.device) -> None:
        """Load the model weights and configurations."""
        pass

    @abstractmethod
    def classify_batch(self, objects: list) -> np.ndarray:
        """Classify a list of SegmentedObject crops and return float probabilities."""
        pass

    @property
    @abstractmethod
    def threshold(self) -> float:
        """The probability threshold boundary for a defect."""
        pass

    @property
    @abstractmethod
    def class_to_idx(self) -> dict[str, int]:
        """A dictionary mapping class names to index values."""
        pass


def preprocess_keras(image: Image.Image, size: int = 224) -> np.ndarray:
    """Helper to square-pad, resize and normalize crop image for Keras MobileNetV2."""
    width, height = image.size
    side = max(width, height)
    left = (side - width) // 2
    top = (side - height) // 2
    padded = ImageOps.expand(image, border=(left, top, side - width - left, side - height - top), fill=0)
    resized = padded.resize((size, size), Image.Resampling.BILINEAR)
    arr = np.array(resized, dtype=np.float32) / 127.5 - 1.0
    return arr


class KerasMobileNetClassifier(BaseClassifier):
    def __init__(self):
        self.device = None
        self.model = None
        self.image_size = 224
        self._threshold = 0.5
        self._class_to_idx = {"Industrial Equipment": 0}

    def load(self, device: torch.device) -> None:
        # Import Keras dynamically within load to avoid global environment side-effects
        os.environ["KERAS_BACKEND"] = "torch"
        import keras
        
        keras_path = Path(settings.KERAS_MODEL_PATH)
        if not keras_path.is_file():
            raise FileNotFoundError(f"Keras model file not found at {keras_path}")
            
        self.device = device
        self.model = keras.models.load_model(str(keras_path))

    def classify_batch(self, objects: list) -> np.ndarray:
        from backend.app.services.ai_service import _sync_cuda
        _sync_cuda(self.device)
        
        inputs = np.stack([preprocess_keras(item.crop, self.image_size) for item in objects])
        tensor_inputs = torch.from_numpy(inputs).to(self.device)
        with torch.inference_mode():
            probs_tensor = self.model(tensor_inputs)
            probabilities = probs_tensor.view(-1).cpu().numpy()
            
        _sync_cuda(self.device)
        return probabilities

    @property
    def threshold(self) -> float:
        return self._threshold

    @property
    def class_to_idx(self) -> dict[str, int]:
        return self._class_to_idx


def get_classifier(backend: str) -> BaseClassifier:
    """Factory to retrieve classification backend."""
    if backend == "keras":
        return KerasMobileNetClassifier()
    else:
        raise ValueError(f"Unsupported CLASSIFIER_BACKEND: {backend}. Only 'keras' is supported.")
