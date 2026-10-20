from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class EventType(str, Enum):
    hydration = "hydration"
    medication = "medication"
    habit = "habit"
    focus = "focus"
    exercise = "exercise"
    sleep = "sleep"
    vitals = "vitals"
    utterance = "utterance"
    correction = "correction"


class EventSource(str, Enum):
    gemini_voice = "gemini_voice"
    watch_sensor = "watch_sensor"
    watch_health_data = "watch_health_data"
    manual = "manual"
    inferred = "inferred"
    system = "system"
    rule_fallback = "rule_fallback"


class EventStatus(str, Enum):
    pending_confirmation = "pending_confirmation"
    accepted = "accepted"
    rejected = "rejected"
    corrected = "corrected"
    retracted = "retracted"


class ProvenanceKind(str, Enum):
    explicit = "explicit"
    sensor = "sensor"
    inferred = "inferred"
    defaulted = "defaulted"


class ParsedEventDraft(BaseModel):
    event_type: EventType
    activity: str | None = None
    value: float | None = None
    unit: str | None = None
    duration_minutes: float | None = None
    boolean_value: bool | None = None
    confidence: float = Field(ge=0, le=1, default=0.9)
    provenance_kind: ProvenanceKind = ProvenanceKind.explicit
    metrics: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)
    needs_confirmation: bool = False
    confirmation_prompt: str | None = None


class UtteranceRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    idempotency_key: str = Field(..., min_length=8, max_length=200)
    timestamp: datetime | None = None
    timezone: str | None = None
    device: str = "galaxy_watch_5"


class EventResponse(BaseModel):
    event_id: str
    idempotency_key: str | None = None
    timestamp: datetime
    timezone: str
    local_date: str
    event_type: EventType
    activity: str | None = None
    source: EventSource
    confidence: float
    status: EventStatus
    raw_input: str | None = None
    value: float | None = None
    unit: str | None = None
    duration_minutes: float | None = None
    boolean_value: bool | None = None
    metrics: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)
    parent_utterance_id: str | None = None
    notion_synced: bool = False
    notion_page_id: str | None = None
    notion_note: str | None = None


class UtteranceResponse(BaseModel):
    utterance_id: str
    raw_input: str
    events: list[EventResponse]
    extractor: str
    notion_sync_summary: list[str] = Field(default_factory=list)


class ConfirmRequest(BaseModel):
    accept: bool = True


class CorrectRequest(BaseModel):
    activity: str | None = None
    value: float | None = None
    unit: str | None = None
    duration_minutes: float | None = None
    boolean_value: bool | None = None
    raw_note: str | None = None


class HealthResponse(BaseModel):
    status: str
    gemini_configured: bool
    notion_configured: bool
    auth_configured: bool
    database: str
    timezone: str
    model: str


class DailySummaryResponse(BaseModel):
    date: str
    timezone: str
    events: list[EventResponse]
    habits: dict[str, bool]
    totals: dict[str, float]
