from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .auth import require_device_token
from .config import get_settings
from .db import init_db
from .schemas import (
    ConfirmRequest,
    CorrectRequest,
    DailySummaryResponse,
    EventResponse,
    HealthResponse,
    UtteranceRequest,
    UtteranceResponse,
)
from .services.notion_sync import NotionHabitSync
from .services.pipeline import EventPipeline

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_ROOT / ".env")
load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    init_db(settings)
    notion = NotionHabitSync(settings) if settings.notion_configured else None
    app.state.settings = settings
    app.state.pipeline = EventPipeline(settings, notion)
    yield


app = FastAPI(
    title="Wear Apps Life Log API",
    version="0.1.0",
    lifespan=lifespan,
)

_settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    s = app.state.settings
    db = "postgres" if s.database_url.strip() else "sqlite"
    return HealthResponse(
        status="ok",
        gemini_configured=s.gemini_configured,
        notion_configured=s.notion_configured,
        auth_configured=s.auth_configured,
        database=db,
        timezone=s.timezone,
        model=s.gemini_model,
    )


@app.post(
    "/api/utterances",
    response_model=UtteranceResponse,
    dependencies=[Depends(require_device_token)],
)
def create_utterance(body: UtteranceRequest) -> UtteranceResponse:
    pipeline: EventPipeline = app.state.pipeline
    try:
        return pipeline.process_utterance(body)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Utterance processing failed: {exc}") from exc


@app.get(
    "/api/events/today",
    response_model=list[EventResponse],
    dependencies=[Depends(require_device_token)],
)
def events_today() -> list[EventResponse]:
    pipeline: EventPipeline = app.state.pipeline
    return pipeline.list_today()


@app.get(
    "/api/events",
    response_model=list[EventResponse],
    dependencies=[Depends(require_device_token)],
)
def events_for_date(date: str) -> list[EventResponse]:
    pipeline: EventPipeline = app.state.pipeline
    return pipeline.list_today(date)


@app.post(
    "/api/events/{event_id}/confirm",
    response_model=EventResponse,
    dependencies=[Depends(require_device_token)],
)
def confirm_event(event_id: str, body: ConfirmRequest) -> EventResponse:
    pipeline: EventPipeline = app.state.pipeline
    try:
        return pipeline.confirm(event_id, body)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Event not found") from exc


@app.post(
    "/api/events/{event_id}/correct",
    response_model=EventResponse,
    dependencies=[Depends(require_device_token)],
)
def correct_event(event_id: str, body: CorrectRequest) -> EventResponse:
    pipeline: EventPipeline = app.state.pipeline
    try:
        return pipeline.correct(event_id, body)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Event not found") from exc


@app.get(
    "/api/daily/{date}",
    response_model=DailySummaryResponse,
    dependencies=[Depends(require_device_token)],
)
def daily(date: str) -> DailySummaryResponse:
    pipeline: EventPipeline = app.state.pipeline
    return pipeline.daily_summary(date)


@app.post(
    "/api/notion/sync",
    dependencies=[Depends(require_device_token)],
)
def notion_sync_today() -> dict[str, str]:
    """Re-sync accepted today's mappable events (best-effort)."""
    pipeline: EventPipeline = app.state.pipeline
    events = pipeline.list_today()
    synced = 0
    for e in events:
        if e.status.value != "accepted":
            continue
        # Re-run via confirm accept path for unsynced
        if not e.notion_synced:
            pipeline.confirm(e.event_id, ConfirmRequest(accept=True))
            synced += 1
    return {"status": "ok", "re_synced": str(synced)}
