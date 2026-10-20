from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    select,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from .config import Settings


class Base(DeclarativeBase):
    pass


class EventRow(Base):
    __tablename__ = "events"
    __table_args__ = (UniqueConstraint("idempotency_key", name="uq_events_idempotency"),)

    event_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    timezone: Mapped[str] = mapped_column(String(64))
    local_date: Mapped[str] = mapped_column(String(16), index=True)
    event_type: Mapped[str] = mapped_column(String(64), index=True)
    activity: Mapped[str | None] = mapped_column(String(128), nullable=True)
    source: Mapped[str] = mapped_column(String(64))
    confidence: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(64), index=True)
    raw_input: Mapped[str | None] = mapped_column(Text, nullable=True)
    value: Mapped[float | None] = mapped_column(Float, nullable=True)
    unit: Mapped[str | None] = mapped_column(String(32), nullable=True)
    duration_minutes: Mapped[float | None] = mapped_column(Float, nullable=True)
    boolean_value: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    metrics_json: Mapped[str] = mapped_column(Text, default="{}")
    metadata_json: Mapped[str] = mapped_column(Text, default="{}")
    parent_utterance_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    correction_of: Mapped[str | None] = mapped_column(String(64), nullable=True)
    notion_synced: Mapped[bool] = mapped_column(Boolean, default=False)
    notion_page_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    notion_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    def metrics(self) -> dict[str, Any]:
        return json.loads(self.metrics_json or "{}")

    def metadata_dict(self) -> dict[str, Any]:
        return json.loads(self.metadata_json or "{}")


class UtteranceRow(Base):
    __tablename__ = "utterances"
    __table_args__ = (UniqueConstraint("idempotency_key", name="uq_utterances_idempotency"),)

    utterance_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    idempotency_key: Mapped[str] = mapped_column(String(200), index=True)
    raw_input: Mapped[str] = mapped_column(Text)
    extractor: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


_engine = None
_SessionLocal: sessionmaker[Session] | None = None


def init_db(settings: Settings) -> None:
    global _engine, _SessionLocal
    url = settings.sqlalchemy_url
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    _engine = create_engine(url, future=True, connect_args=connect_args)
    _SessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(_engine)


def get_session() -> Session:
    if _SessionLocal is None:
        raise RuntimeError("Database not initialized")
    return _SessionLocal()


def get_event_by_idempotency(session: Session, key: str) -> EventRow | None:
    return session.scalar(select(EventRow).where(EventRow.idempotency_key == key))


def get_utterance_by_idempotency(session: Session, key: str) -> UtteranceRow | None:
    return session.scalar(select(UtteranceRow).where(UtteranceRow.idempotency_key == key))


def list_events_for_date(session: Session, local_date: str) -> list[EventRow]:
    rows = session.scalars(
        select(EventRow)
        .where(EventRow.local_date == local_date)
        .where(EventRow.status.in_(["accepted", "pending_confirmation"]))
        .order_by(EventRow.timestamp.asc())
    ).all()
    return list(rows)


def get_event(session: Session, event_id: str) -> EventRow | None:
    return session.get(EventRow, event_id)
