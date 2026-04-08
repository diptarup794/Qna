from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.config import get_settings
from backend.database import get_db
from backend.models import Document, User
from backend.schemas import DocumentDetail, DocumentOut
from backend.services.pdf_extract import extract_text_from_pdf_bytes

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.get("", response_model=list[DocumentOut])
def list_documents(
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    rows = db.query(Document).filter(Document.user_id == current.id).order_by(Document.created_at.desc()).all()
    return rows


@router.get("/{doc_id}", response_model=DocumentDetail)
def get_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == doc_id, Document.user_id == current.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    settings = get_settings()
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    data = await file.read()
    if len(data) > settings.max_pdf_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large (max {settings.max_pdf_bytes // (1024 * 1024)} MB)",
        )
    try:
        text = extract_text_from_pdf_bytes(data, settings.max_extracted_chars)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read PDF: {e!s}") from e
    if not text:
        raise HTTPException(status_code=400, detail="No text could be extracted from this PDF")
    doc = Document(
        user_id=current.id,
        filename=file.filename,
        extracted_text=text,
        char_count=len(text),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == doc_id, Document.user_id == current.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(doc)
    db.commit()
    return None
