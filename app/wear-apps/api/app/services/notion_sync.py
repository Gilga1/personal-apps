from __future__ import annotations

import logging
from datetime import date
from typing import Any

import httpx

from ..config import Settings
from .notion_map import NotionFieldUpdate

logger = logging.getLogger(__name__)

# Post multi-source databases (2025-09-03+): query/create against data sources.
NOTION_VERSION = "2025-09-03"

SHARE_HINT = (
    "Notion 404: share the Habit Tracker database with your integration "
    "(Habit Tracker → ⋯ → Connections). Meals access alone is not enough."
)


def _normalize_uuid(value: str) -> str:
    raw = value.replace("-", "").strip()
    if len(raw) != 32:
        return value
    return f"{raw[0:8]}-{raw[8:12]}-{raw[12:16]}-{raw[16:20]}-{raw[20:32]}"


class NotionHabitSync:
    def __init__(self, settings: Settings):
        if not settings.notion_configured:
            raise RuntimeError("Notion is not configured.")
        self.settings = settings
        self.token = settings.notion_api_key
        self.database_id = _normalize_uuid(settings.notion_habit_tracker_database_id)
        self.data_source_id = _normalize_uuid(settings.notion_habit_tracker_data_source_id)

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.token}",
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json",
        }

    def _resolve_data_source_id(self, client: httpx.Client) -> str:
        if self.data_source_id:
            return self.data_source_id
        resp = client.get(
            f"https://api.notion.com/v1/databases/{self.database_id}",
            headers=self._headers(),
        )
        resp.raise_for_status()
        sources = resp.json().get("data_sources") or []
        if not sources:
            raise RuntimeError("No data_sources found on Habit Tracker database")
        self.data_source_id = sources[0]["id"]
        return self.data_source_id

    def find_daily_page(self, local_date: date) -> dict[str, Any] | None:
        payload = {
            "filter": {
                "property": "Date",
                "date": {"equals": local_date.isoformat()},
            },
            "page_size": 5,
        }
        with httpx.Client(timeout=30) as client:
            ds = self._resolve_data_source_id(client)
            resp = client.post(
                f"https://api.notion.com/v1/data_sources/{ds}/query",
                headers=self._headers(),
                json=payload,
            )
            if resp.status_code == 404:
                raise RuntimeError(SHARE_HINT)
            resp.raise_for_status()
            results = resp.json().get("results", [])
        if not results:
            return None
        if len(results) > 1:
            logger.warning("Multiple Habit Tracker rows for %s; using first", local_date)
        return results[0]

    def create_daily_page(self, local_date: date) -> dict[str, Any]:
        with httpx.Client(timeout=30) as client:
            ds = self._resolve_data_source_id(client)
            payload = {
                "parent": {"type": "data_source_id", "data_source_id": ds},
                "properties": {
                    "Name": {"title": [{"text": {"content": "Habit Tracker"}}]},
                    "Date": {"date": {"start": local_date.isoformat()}},
                },
            }
            resp = client.post(
                "https://api.notion.com/v1/pages",
                headers=self._headers(),
                json=payload,
            )
            resp.raise_for_status()
            return resp.json()

    def ensure_daily_page(self, local_date: date) -> dict[str, Any]:
        page = self.find_daily_page(local_date)
        if page is not None:
            return page
        if not self.settings.auto_create_daily_row:
            raise RuntimeError(f"No Habit Tracker row for {local_date.isoformat()}")
        return self.create_daily_page(local_date)

    def _current_number(self, page: dict[str, Any], property_name: str) -> float:
        prop = page.get("properties", {}).get(property_name, {})
        if prop.get("type") == "number":
            val = prop.get("number")
            return float(val) if val is not None else 0.0
        return 0.0

    def apply_update(
        self,
        local_date: date,
        update: NotionFieldUpdate,
    ) -> tuple[str | None, str]:
        if update.kind == "missing":
            return None, update.note or "Missing Notion field"

        page = self.ensure_daily_page(local_date)
        page_id = page["id"]
        properties: dict[str, Any] = {}

        if update.kind == "checkbox":
            properties[update.property_name] = {"checkbox": bool(update.value)}
            note = f"Set {update.property_name}={bool(update.value)}"
        elif update.kind == "number_add":
            current = self._current_number(page, update.property_name)
            new_val = current + float(update.value)
            properties[update.property_name] = {"number": new_val}
            note = f"Add {update.value} → {update.property_name}={new_val}"
        elif update.kind == "number_set":
            properties[update.property_name] = {"number": float(update.value)}
            note = f"Set {update.property_name}={update.value}"
        else:
            return page_id, f"Unsupported update kind: {update.kind}"

        with httpx.Client(timeout=30) as client:
            resp = client.patch(
                f"https://api.notion.com/v1/pages/{page_id}",
                headers=self._headers(),
                json={"properties": properties},
            )
            resp.raise_for_status()
        return page_id, note
