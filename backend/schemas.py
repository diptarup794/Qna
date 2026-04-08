import json
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        if not any(c.isalpha() for c in v):
            raise ValueError("Password must contain at least one letter")
        return v


class UserOut(BaseModel):
    id: int
    email: str
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str | None = None


class DocumentOut(BaseModel):
    id: int
    filename: str
    char_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentDetail(DocumentOut):
    extracted_text: str


class AskRequest(BaseModel):
    """Send `document_ids` (1–N) or legacy single `document_id`."""

    document_id: int | None = None
    document_ids: list[int] | None = None
    question: str = Field(min_length=1, max_length=4000)

    @model_validator(mode="after")
    def resolve_document_ids(self):
        if self.document_ids is not None and len(self.document_ids) > 0:
            seen: list[int] = []
            for i in self.document_ids:
                if i not in seen:
                    seen.append(i)
            self.document_ids = seen
            return self
        if self.document_id is not None:
            self.document_ids = [self.document_id]
            return self
        raise ValueError("Provide document_id or a non-empty document_ids list")


class AskResponse(BaseModel):
    answer: str
    qa_id: int
    document_ids: list[int]


class QAHistoryItem(BaseModel):
    id: int
    document_id: int
    source_document_ids: list[int] | None = None
    question: str
    answer: str
    created_at: datetime

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def parse_source_ids(cls, data):
        if isinstance(data, dict):
            return data
        raw = getattr(data, "source_document_ids", None)
        ids = json.loads(raw) if raw else None
        return {
            "id": data.id,
            "document_id": data.document_id,
            "source_document_ids": ids,
            "question": data.question,
            "answer": data.answer,
            "created_at": data.created_at,
        }


class HealthResponse(BaseModel):
    status: str
    groq_configured: bool
