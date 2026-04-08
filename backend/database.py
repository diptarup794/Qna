from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from backend.config import get_settings


class Base(DeclarativeBase):
    pass


def _engine():
    url = get_settings().database_url
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(url, connect_args=connect_args)


engine = _engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _sqlite_add_column_if_missing(table: str, column: str, ddl: str) -> None:
    if not str(engine.url).startswith("sqlite"):
        return
    from sqlalchemy import inspect, text

    insp = inspect(engine)
    cols = {c["name"] for c in insp.get_columns(table)}
    if column not in cols:
        with engine.begin() as conn:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {ddl}"))


def init_db():
    from backend import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _sqlite_add_column_if_missing(
        "question_answers",
        "source_document_ids",
        "source_document_ids TEXT",
    )
