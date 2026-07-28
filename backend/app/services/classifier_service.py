from __future__ import annotations

import os
import io
import json
import base64
import urllib.request
import urllib.error
import concurrent.futures
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


class OllamaVisionClassifier(BaseClassifier):
    def __init__(self):
        self.api_url = settings.OLLAMA_API_URL
        self.model_name = settings.OLLAMA_MODEL_NAME
        self.image_size = 224
        self._threshold = 0.5
        self._class_to_idx = {"Industrial Equipment": 0}
        self.last_reasoning = ""

    def load(self, device: torch.device) -> None:
        """Verify local Ollama connection."""
        print(f"[Ollama Classifier] Verifying connection to {self.api_url} with model {self.model_name}...")
        try:
            req = urllib.request.Request(
                "http://localhost:11434/api/tags",
                method="GET"
            )
            with urllib.request.urlopen(req, timeout=3) as response:
                if response.status == 200:
                    tags_data = json.loads(response.read().decode('utf-8'))
                    models = [m.get("name") for m in tags_data.get("models", [])]
                    print(f"[Ollama Classifier] Available local models: {models}")
        except Exception as e:
            print(f"[Ollama Classifier] WARNING: Could not connect to local Ollama server during startup. "
                  f"Please make sure Ollama is running and `{self.model_name}` is pulled. Error: {e}")

    def _classify_single(self, item) -> float:
        """Call the local Ollama vision API for a single crop."""
        try:
            buffered = io.BytesIO()
            item.crop.convert("RGB").save(buffered, format="JPEG", quality=85)
            img_b64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
            
            prompt = (
                "Analyze this image of industrial equipment. Identify if it has any defects "
                "(such as cracks, scratches, deformation, or visual anomalies). "
                "Respond ONLY with a JSON object in this exact format: "
                '{"is_defective": true/false, "confidence": 0.0-1.0, "reasoning": "string"}'
            )
            
            payload = {
                "model": self.model_name,
                "prompt": prompt,
                "images": [img_b64],
                "stream": False,
                "format": "json"
            }
            
            data = json.dumps(payload).encode('utf-8')
            req = urllib.request.Request(
                self.api_url,
                data=data,
                headers={'Content-Type': 'application/json'},
                method='POST'
            )
            
            with urllib.request.urlopen(req, timeout=15) as response:
                resp_data = json.loads(response.read().decode('utf-8'))
                result_text = resp_data.get("response", "{}")
                result = json.loads(result_text)
                
                is_def = result.get("is_defective", False)
                confidence = float(result.get("confidence", 0.70))
                reasoning = result.get("reasoning", "")
                
                self.last_reasoning = reasoning
                print(f"[Ollama Defect Detection Reasoning]: {reasoning}")
                
                return (1.0 - confidence) if is_def else confidence
                
        except Exception as e:
            print(f"[Ollama Classifier] Error during image classification: {e}")
            return 0.5

    def classify_batch(self, objects: list) -> np.ndarray:
        """Run Ollama classification concurrently."""
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            probabilities = list(executor.map(self._classify_single, objects))
        return np.array(probabilities, dtype=np.float32)

    @property
    def threshold(self) -> float:
        return self._threshold

    @property
    def class_to_idx(self) -> dict[str, int]:
        return self._class_to_idx


def get_classifier(backend: str) -> BaseClassifier:
    """Factory to retrieve classification backend."""
    if backend == "ollama":
        return OllamaVisionClassifier()
    else:
        raise ValueError(f"Unsupported CLASSIFIER_BACKEND: {backend}. Only 'ollama' is supported.")
