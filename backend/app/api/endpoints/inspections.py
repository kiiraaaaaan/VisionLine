import io
import zipfile
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.app.schemas.inspection import (
    InspectionResponse,
    InspectionDetailResponse,
    InspectionReviewUpdate
)
from backend.app.services.ai_service import ai_service
from backend.app.services import db_service

router = APIRouter()

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tif", ".tiff"}
MAX_ZIP_IMAGES = 500  # Safety threshold for batch endpoint
MAX_IMAGE_BYTES = 25 * 1024 * 1024  # 25 MB max per image

@router.get("", response_model=dict)
async def list_inspections(
    status: Optional[str] = None,
    review_status: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """List inspections with pagination and filters."""
    inspections, total = await db_service.get_inspections(
        db=db, 
        status=status, 
        review_status=review_status, 
        page=page, 
        limit=limit
    )
    return {
        "items": [InspectionResponse.model_validate(item) for item in inspections],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }

@router.get("/{inspection_id}", response_model=InspectionDetailResponse)
async def get_inspection(inspection_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieve detailed inspection with detections."""
    inspection = await db_service.get_inspection_by_id(db, inspection_id)
    if not inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Inspection not found"
        )
    return inspection

import httpx

@router.post("/upload", response_model=InspectionDetailResponse, status_code=status.HTTP_201_CREATED)
async def upload_inspection(
    file: Optional[UploadFile] = File(None),
    url: Optional[str] = Query(None),
    threshold: Optional[float] = Query(None, ge=0.10, le=0.90),
    yolo_conf: float = Query(0.25, ge=0.05, le=0.95),
    yolo_iou: float = Query(0.70, ge=0.10, le=0.90),
    db: AsyncSession = Depends(get_db)
):
    """Run defect inspection on a single uploaded image or network Wi-Fi/IP camera URL and store results."""
    if url:
        import re
        match = re.search(r"mobile-stream/([^/]+)/image.jpg", url)
        if match:
            session_id = match.group(1)
            from backend.app.api.endpoints.analyze import mobile_sessions
            file_bytes = mobile_sessions.get(session_id)
            if not file_bytes:
                raise HTTPException(status_code=400, detail="Mobile session has no uploaded frames yet")
            filename = "mobile_camera.jpg"
        else:
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.get(url, timeout=5.0)
                    if resp.status_code != 200:
                        raise HTTPException(status_code=400, detail="Failed to fetch image from network URL")
                    file_bytes = resp.content
                    filename = "ip_camera.jpg"
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"IP Camera connection error: {str(e)}")
    elif file:
        file_bytes = await file.read()
        filename = file.filename or "live_frame.jpg"
    else:
        raise HTTPException(status_code=400, detail="Must provide either file or url")

    if len(file_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image size exceeds limit of {MAX_IMAGE_BYTES // (1024 * 1024)} MB."
        )

    # Perform inference and render annotated image
    result, annotated_bytes = ai_service.inspect_image(
        image_bytes=file_bytes,
        filename=filename,
        yolo_conf=yolo_conf,
        yolo_iou=yolo_iou,
        threshold=threshold
    )

    # Save to database
    db_inspection = await db_service.create_inspection(
        db=db,
        result_data=result,
        original_bytes=file_bytes,
        annotated_bytes=annotated_bytes
    )
    
    # Reload model-validated detailed response to populate nested detections
    return await db_service.get_inspection_by_id(db, db_inspection.id)

@router.post("/upload-zip", response_model=list[InspectionResponse], status_code=status.HTTP_201_CREATED)
async def upload_zip_inspections(
    file: UploadFile = File(...),
    threshold: Optional[float] = Query(None, ge=0.10, le=0.90),
    yolo_conf: float = Query(0.25, ge=0.05, le=0.95),
    yolo_iou: float = Query(0.70, ge=0.10, le=0.90),
    db: AsyncSession = Depends(get_db)
):
    """Process a ZIP folder containing multiple images sequentially."""
    zip_bytes = await file.read()
    if not zipfile.is_zipfile(io.BytesIO(zip_bytes)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is not a valid ZIP archive."
        )
        
    inspections_created = []
    
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as archive:
        image_members = []
        for info in archive.infolist():
            if info.is_dir() or info.filename.split("/")[-1].startswith("."):
                continue
            path_ext = "." + info.filename.split(".")[-1].lower() if "." in info.filename else ""
            if path_ext in IMAGE_SUFFIXES:
                image_members.append(info)
                
        if not image_members:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No supported images found in the ZIP archive."
            )
            
        # Process each image in the ZIP
        for info in image_members:
            try:
                img_data = archive.read(info)
                if len(img_data) > MAX_IMAGE_BYTES:
                    continue # Skip oversized images
                
                filename = info.filename.split("/")[-1] # Basename
                result, annotated_bytes = ai_service.inspect_image(
                    image_bytes=img_data,
                    filename=filename,
                    yolo_conf=yolo_conf,
                    yolo_iou=yolo_iou,
                    threshold=threshold
                )
                db_ins = await db_service.create_inspection(
                    db=db,
                    result_data=result,
                    original_bytes=img_data,
                    annotated_bytes=annotated_bytes
                )
                inspections_created.append(db_ins)
            except Exception:
                continue # Skip corrupt archive entries
                
    return inspections_created

@router.get("/{inspection_id}/image/original")
async def get_original_image(inspection_id: str, db: AsyncSession = Depends(get_db)):
    """Stream raw uploaded original image binary."""
    inspection = await db_service.get_inspection_by_id(db, inspection_id)
    if not inspection or not inspection.original_image_bytes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Original image not found"
        )
    return Response(content=inspection.original_image_bytes, media_type="image/jpeg")

@router.get("/{inspection_id}/image/annotated")
async def get_annotated_image(inspection_id: str, db: AsyncSession = Depends(get_db)):
    """Stream model prediction annotated image binary."""
    inspection = await db_service.get_inspection_by_id(db, inspection_id)
    if not inspection or not inspection.annotated_image_bytes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Annotated image not found"
        )
    return Response(content=inspection.annotated_image_bytes, media_type="image/jpeg")

@router.put("/{inspection_id}/review", response_model=InspectionDetailResponse)
async def review_inspection(
    inspection_id: str,
    review_data: InspectionReviewUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Submit quality manager review decision for an inspection."""
    updated = await db_service.update_inspection_review(
        db=db, 
        inspection_id=inspection_id, 
        review_data=review_data
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Inspection not found"
        )
    return updated
