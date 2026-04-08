import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.config import get_settings
from backend.database import get_db
from backend.models import Document, QuestionAnswer, User
from backend.schemas import AskRequest, AskResponse, QAHistoryItem
from backend.services.groq_client import answer_from_context
from backend.services.multi_context import build_combined_context

router = APIRouter(prefix="/api/qa", tags=["qa"])


def _row_source_ids(row: QuestionAnswer) -> set[int]:
    if row.source_document_ids:
        return set(json.loads(row.source_document_ids))
    return {row.document_id}


@router.post("/ask", response_model=AskResponse)
def ask(
    body: AskRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    settings = get_settings()
    ids = body.document_ids
    if not ids:
        raise HTTPException(status_code=400, detail="No documents selected")
    if len(ids) > settings.max_documents_per_question:
        raise HTTPException(
            status_code=400,
            detail=f"At most {settings.max_documents_per_question} documents per question",
        )

    docs = (
        db.query(Document)
        .filter(Document.user_id == current.id, Document.id.in_(ids))
        .all()
    )
    by_id = {d.id: d for d in docs}
    missing = [i for i in ids if i not in by_id]
    if missing:
        raise HTTPException(status_code=404, detail=f"Document(s) not found: {missing}")

    ordered = [by_id[i] for i in ids]
    multi = len(ordered) > 1
    context = (
        build_combined_context(ordered, settings.max_multi_search_chars)
        if multi
        else ordered[0].extracted_text[: settings.max_multi_search_chars]
    )

    try:
        answer = answer_from_context(settings, context, body.question.strip(), multi_document=multi)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Model error: {e!s}") from e

    primary_id = ids[0]
    ids_json = json.dumps(ids)
    row = QuestionAnswer(
        user_id=current.id,
        document_id=primary_id,
        question=body.question.strip(),
        answer=answer,
        source_document_ids=ids_json,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return AskResponse(answer=answer, qa_id=row.id, document_ids=ids)


@router.get("/history", response_model=list[QAHistoryItem])
def history(
    document_id: int | None = None,
    document_ids: list[int] | None = Query(None),
    limit: int = 50,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    filter_ids: list[int] | None = None
    if document_ids:
        filter_ids = list(dict.fromkeys(document_ids))
    elif document_id is not None:
        filter_ids = [document_id]

    q = db.query(QuestionAnswer).filter(QuestionAnswer.user_id == current.id)
    lim = min(limit, 200)

    if filter_ids is None:
        rows = q.order_by(QuestionAnswer.created_at.desc()).limit(lim).all()
        return rows

    take = min(max(lim * 10, 80), 400)
    candidates = q.order_by(QuestionAnswer.created_at.desc()).limit(take).all()
    want = set(filter_ids)
    rows = [r for r in candidates if _row_source_ids(r) & want][:lim]
    return rows
