from __future__ import annotations

import json
import logging
import uuid
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from ..config import Settings
from ..db import (
    EventRow,
    UtteranceRow,
    get_event,
    get_event_by_idempotency,
    get_session,
    get_utterance_by_idempotency,
    list_events_for_date,
)
from ..schemas import (
    ConfirmRequest,
    CorrectRequest,
    DailySummaryResponse,
    EventResponse,
    EventSource,
    EventStatus,
    EventType,
    ParsedEventDraft,
    UtteranceRequest,
    UtteranceResponse,
)
from .extractor import UtteranceExtractor
from .notion_map import map_event_to_notion
from .notion_sync import NotionHabitSync

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _local_date(ts: datetime, tz_name: str) -> str:
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return ts.astimezone(ZoneInfo(tz_name)).date().isoformat()


def _row_to_response(row: EventRow) -> EventResponse:
    return EventResponse(
        event_id=row.event_id,
        idempotency_key=row.idempotency_key,
        timestamp=row.timestamp,
        timezone=row.timezone,
        local_date=row.local_date,
        event_type=EventType(row.event_type),
        activity=row.activity,
        source=EventSource(row.source),
        confidence=row.confidence,
        status=EventStatus(row.status),
        raw_input=row.raw_input,
        value=row.value,
        unit=row.unit,
        duration_minutes=row.duration_minutes,
        boolean_value=row.boolean_value,
        metrics=row.metrics(),
        metadata=row.metadata_dict(),
        parent_utterance_id=row.parent_utterance_id,
        notion_synced=row.notion_synced,
        notion_page_id=row.notion_page_id,
        notion_note=row.notion_note,
    )


class EventPipeline:
    def __init__(self, settings: Settings, notion: NotionHabitSync | None):
        self.settings = settings
        self.extractor = UtteranceExtractor(settings)
        self.notion = notion

    def process_utterance(self, body: UtteranceRequest) -> UtteranceResponse:
        session = get_session()
        try:
            existing = get_utterance_by_idempotency(session, body.idempotency_key)
            if existing is not None:
                from sqlalchemy import select

                events = list(
                    session.scalars(
                        select(EventRow).where(
                            EventRow.parent_utterance_id == existing.utterance_id
                        )
                    ).all()
                )
                return UtteranceResponse(
                    utterance_id=existing.utterance_id,
                    raw_input=existing.raw_input,
                    events=[_row_to_response(e) for e in events],
                    extractor=existing.extractor,
                    notion_sync_summary=["idempotent replay"],
                )

            tz_name = body.timezone or self.settings.timezone
            ts = body.timestamp or _now()
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=ZoneInfo(tz_name))

            drafts, extractor_name = self.extractor.extract(body.text)
            utterance_id = uuid.uuid4().hex
            utterance = UtteranceRow(
                utterance_id=utterance_id,
                idempotency_key=body.idempotency_key,
                raw_input=body.text,
                extractor=extractor_name,
                created_at=_now(),
            )
            session.add(utterance)

            source = (
                EventSource.gemini_voice
                if extractor_name.startswith("gemini")
                else EventSource.rule_fallback
            )
            responses: list[EventResponse] = []
            sync_notes: list[str] = []

            for idx, draft in enumerate(drafts):
                event_key = f"{body.idempotency_key}:{idx}"
                prior = get_event_by_idempotency(session, event_key)
                if prior is not None:
                    responses.append(_row_to_response(prior))
                    continue

                status = self._decide_status(draft)
                row = EventRow(
                    event_id=uuid.uuid4().hex,
                    idempotency_key=event_key,
                    timestamp=ts,
                    timezone=tz_name,
                    local_date=_local_date(ts, tz_name),
                    event_type=draft.event_type.value,
                    activity=draft.activity,
                    source=source.value,
                    confidence=draft.confidence,
                    status=status.value,
                    raw_input=body.text,
                    value=draft.value,
                    unit=draft.unit,
                    duration_minutes=draft.duration_minutes,
                    boolean_value=draft.boolean_value,
                    metrics_json=json.dumps(draft.metrics),
                    metadata_json=json.dumps(
                        {
                            **draft.metadata,
                            "device": body.device,
                            "provenance_kind": draft.provenance_kind.value,
                            "confirmation_prompt": draft.confirmation_prompt,
                        }
                    ),
                    parent_utterance_id=utterance_id,
                    correction_of=None,
                    notion_synced=False,
                    notion_page_id=None,
                    notion_note=None,
                    created_at=_now(),
                    updated_at=_now(),
                )

                if status == EventStatus.accepted:
                    page_id, note = self._sync_notion(row)
                    row.notion_page_id = page_id
                    row.notion_note = note
                    row.notion_synced = page_id is not None and not (note or "").startswith("Missing")
                    sync_notes.append(note)
                else:
                    row.notion_note = draft.confirmation_prompt or "pending confirmation"
                    sync_notes.append(row.notion_note)

                session.add(row)
                responses.append(_row_to_response(row))

            session.commit()
            return UtteranceResponse(
                utterance_id=utterance_id,
                raw_input=body.text,
                events=responses,
                extractor=extractor_name,
                notion_sync_summary=sync_notes,
            )
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def _decide_status(self, draft: ParsedEventDraft) -> EventStatus:
        if draft.needs_confirmation:
            return EventStatus.pending_confirmation
        if draft.activity is None:
            return EventStatus.pending_confirmation
        if draft.event_type == EventType.hydration and draft.value is None:
            return EventStatus.pending_confirmation
        if draft.confidence < self.settings.confirmation_threshold:
            return EventStatus.pending_confirmation
        # Ambiguous meds
        if (
            draft.activity == "meds"
            and draft.confidence < self.settings.auto_accept_threshold
        ):
            return EventStatus.pending_confirmation
        return EventStatus.accepted

    def _sync_notion(self, row: EventRow) -> tuple[str | None, str]:
        mapping = map_event_to_notion(
            event_type=row.event_type,
            activity=row.activity,
            boolean_value=row.boolean_value,
            duration_minutes=row.duration_minutes,
            value=row.value,
        )
        if mapping is None:
            return None, "No Notion mapping for this event"
        if mapping.kind == "missing":
            return None, mapping.note or "Missing Notion field"
        if self.notion is None:
            return None, "Notion not configured"
        try:
            local = date.fromisoformat(row.local_date)
            return self.notion.apply_update(local, mapping)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Notion sync failed")
            return None, f"Notion sync failed: {exc}"

    def confirm(self, event_id: str, body: ConfirmRequest) -> EventResponse:
        session = get_session()
        try:
            row = get_event(session, event_id)
            if row is None:
                raise KeyError(event_id)
            if body.accept:
                row.status = EventStatus.accepted.value
                page_id, note = self._sync_notion(row)
                row.notion_page_id = page_id
                row.notion_note = note
                row.notion_synced = page_id is not None and not (note or "").startswith("Missing")
            else:
                row.status = EventStatus.rejected.value
                row.notion_note = "rejected by user"
            row.updated_at = _now()
            session.commit()
            session.refresh(row)
            return _row_to_response(row)
        finally:
            session.close()

    def correct(self, event_id: str, body: CorrectRequest) -> EventResponse:
        session = get_session()
        try:
            old = get_event(session, event_id)
            if old is None:
                raise KeyError(event_id)
            old.status = EventStatus.corrected.value
            old.updated_at = _now()

            new = EventRow(
                event_id=uuid.uuid4().hex,
                idempotency_key=f"correction:{old.event_id}:{uuid.uuid4().hex}",
                timestamp=old.timestamp,
                timezone=old.timezone,
                local_date=old.local_date,
                event_type=old.event_type,
                activity=body.activity if body.activity is not None else old.activity,
                source=EventSource.manual.value,
                confidence=1.0,
                status=EventStatus.accepted.value,
                raw_input=body.raw_note or old.raw_input,
                value=body.value if body.value is not None else old.value,
                unit=body.unit if body.unit is not None else old.unit,
                duration_minutes=(
                    body.duration_minutes
                    if body.duration_minutes is not None
                    else old.duration_minutes
                ),
                boolean_value=(
                    body.boolean_value
                    if body.boolean_value is not None
                    else old.boolean_value
                ),
                metrics_json=old.metrics_json,
                metadata_json=json.dumps({**old.metadata_dict(), "correction_of": old.event_id}),
                parent_utterance_id=old.parent_utterance_id,
                correction_of=old.event_id,
                notion_synced=False,
                notion_page_id=None,
                notion_note=None,
                created_at=_now(),
                updated_at=_now(),
            )
            page_id, note = self._sync_notion(new)
            new.notion_page_id = page_id
            new.notion_note = note
            new.notion_synced = page_id is not None and not (note or "").startswith("Missing")
            session.add(new)
            session.commit()
            session.refresh(new)
            return _row_to_response(new)
        finally:
            session.close()

    def list_today(self, local_date: str | None = None) -> list[EventResponse]:
        tz = ZoneInfo(self.settings.timezone)
        day = local_date or datetime.now(tz).date().isoformat()
        session = get_session()
        try:
            rows = list_events_for_date(session, day)
            return [_row_to_response(r) for r in rows]
        finally:
            session.close()

    def daily_summary(self, local_date: str) -> DailySummaryResponse:
        events = self.list_today(local_date)
        habits: dict[str, bool] = {}
        totals: dict[str, float] = {
            "water_ml": 0.0,
            "meditation_minutes": 0.0,
            "deep_work_minutes": 0.0,
        }
        for e in events:
            if e.status != EventStatus.accepted:
                continue
            if e.activity and e.boolean_value:
                habits[e.activity] = True
            if e.event_type == EventType.hydration and e.value:
                totals["water_ml"] += float(e.value)
            if e.activity == "meditation" and e.duration_minutes:
                totals["meditation_minutes"] += float(e.duration_minutes)
            if e.activity == "deep_work" and e.duration_minutes:
                totals["deep_work_minutes"] += float(e.duration_minutes)
        return DailySummaryResponse(
            date=local_date,
            timezone=self.settings.timezone,
            events=events,
            habits=habits,
            totals=totals,
        )
