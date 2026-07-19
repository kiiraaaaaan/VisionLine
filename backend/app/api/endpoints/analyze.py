"""
Phase 2 — Live Frame Analysis Endpoint

Accepts a raw JPEG/PNG frame from the browser camera module,
runs the full AI inference pipeline, and returns the prediction
WITHOUT saving anything to the database.

This is the backend contract for useAnalysisEngine.ts.
Phase 3 will add intelligent event detection and selective DB writes on top.
"""

from fastapi import APIRouter, File, UploadFile, Query, Response
from pydantic import BaseModel
from typing import Optional

from backend.app.services.ai_service import ai_service

router = APIRouter()


class FrameAnalysisResult(BaseModel):
    """
    Lightweight inference result returned to the live camera client.
    No IDs — nothing is persisted.
    """
    status: str                          # NORMAL | DEFECTIVE | UNSUPPORTED | ERROR
    confidence: float                    # 0.0 – 1.0, adjusted for predicted class
    raw_defect_probability: float        # Raw model output (always defect probability)
    is_low_confidence: bool
    yolo_time_ms: float
    keras_time_ms: float
    total_time_ms: float
    message: Optional[str] = None


import httpx
from fastapi import HTTPException

@router.post("/frame", response_model=FrameAnalysisResult)
async def analyze_frame(
    file: Optional[UploadFile] = File(None),
    url: Optional[str] = Query(None),
    threshold: float = Query(0.50, ge=0.0, le=1.0),
):
    """
    Run AI inference on a single camera frame (either uploaded or fetched from network/wifi URL).
    """
    if url:
        import re
        match = re.search(r"mobile-stream/([^/]+)/image.jpg", url)
        if match:
            session_id = match.group(1)
            image_bytes = mobile_sessions.get(session_id)
            if not image_bytes:
                raise HTTPException(status_code=400, detail="Mobile session has no uploaded frames yet")
            filename = "mobile_camera.jpg"
        else:
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.get(url, timeout=5.0)
                    if resp.status_code != 200:
                        raise HTTPException(status_code=400, detail="Failed to fetch image from network URL")
                    image_bytes = resp.content
                    filename = "ip_camera.jpg"
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"IP Camera connection error: {str(e)}")
    elif file:
        image_bytes = await file.read()
        filename = file.filename or "live_frame.jpg"
    else:
        raise HTTPException(status_code=400, detail="Must provide either file or url")

    # Full AI pipeline — same code path as the upload endpoint, no DB writes
    result, _annotated_bytes = ai_service.inspect_image(
        image_bytes=image_bytes,
        filename=filename,
        threshold=threshold,
    )

    raw_prob = result.get("max_defect_probability") or 0.0
    status = result.get("status", "ERROR")
    is_def = status == "DEFECTIVE"

    # Confidence relative to the predicted class
    confidence = (1.0 - raw_prob) if is_def else raw_prob

    from backend.app.config import settings
    is_low = confidence < settings.LOW_CONFIDENCE_THRESHOLD

    return FrameAnalysisResult(
        status=status,
        confidence=round(confidence, 4),
        raw_defect_probability=round(raw_prob, 4),
        is_low_confidence=is_low,
        yolo_time_ms=result.get("yolo_time_ms", 0.0),
        keras_time_ms=result.get("mobilenet_time_ms", 0.0),
        total_time_ms=result.get("total_time_ms", 0.0),
        message=result.get("message"),
    )


# Store latest image bytes per mobile session in-memory
mobile_sessions = {}

# A solid-black placeholder image returned when a session hasn't uploaded a frame yet
BLACK_GIF = (
    b"\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00"
    b"\xff\xff\xff\x21\xf9\x04\x01\x00\x00\x00\x00\x2c\x00\x00\x00\x00"
    b"\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b"
)


@router.post("/mobile-stream/{session_id}")
async def upload_mobile_frame(session_id: str, file: UploadFile = File(...)):
    """
    Accepts a raw frame upload from a smartphone's web browser camera,
    and caches it in memory for the desktop client to poll.
    """
    content = await file.read()
    mobile_sessions[session_id] = content
    return {"status": "success", "session_id": session_id, "bytes_received": len(content)}


@router.get("/mobile-stream/{session_id}/image.jpg")
async def get_mobile_frame(session_id: str):
    """
    Serves the cached raw frame from the designated mobile session as an image/jpeg.
    Allows standard network-based IP camera polling logic to work out of the box.
    """
    img_data = mobile_sessions.get(session_id)
    if not img_data:
        return Response(content=BLACK_GIF, media_type="image/gif")
    return Response(content=img_data, media_type="image/jpeg")


@router.get("/system/ip")
async def get_system_ip():
    """
    Discovers the server's local network Wi-Fi/Ethernet IP address.
    Used to automatically generate local QR connection links for smartphones.
    """
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return {"ip": ip}
    except Exception:
        return {"ip": "127.0.0.1"}

