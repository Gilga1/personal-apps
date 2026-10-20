"""Probe Notion access for Habit Tracker. Run from api/ with venv active."""
from __future__ import annotations

import json
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")
load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=True)

KEY = os.environ.get("NOTION_API_KEY", "")
print("key_configured", bool(KEY), "len", len(KEY))

versions = ["2022-06-28", "2025-09-03", "2026-03-11"]
ids = {
    "db": "d5ed17f2-1d70-4755-b028-066c8e8d93e2",
    "ds": "bd13c6c6-ca63-4ac6-8d55-75ac013b278b",
    "meals_db": "45a56aaa-1c6a-441a-b6f8-2b01ac9ca2b7",
}

with httpx.Client(timeout=30) as client:
    for ver in versions:
        headers = {
            "Authorization": f"Bearer {KEY}",
            "Notion-Version": ver,
            "Content-Type": "application/json",
        }
        print("\n=== version", ver, "===")
        for label, oid in ids.items():
            r = client.get(f"https://api.notion.com/v1/databases/{oid}", headers=headers)
            print(f"GET databases/{label}", r.status_code, r.text[:180].replace("\n", " "))
            r = client.get(f"https://api.notion.com/v1/data_sources/{oid}", headers=headers)
            print(f"GET data_sources/{label}", r.status_code, r.text[:180].replace("\n", " "))

        # search
        body = {"query": "Habit Tracker", "page_size": 10}
        if ver >= "2025-09-03":
            body["filter"] = {"value": "data_source", "property": "object"}
        else:
            body["filter"] = {"value": "database", "property": "object"}
        r = client.post("https://api.notion.com/v1/search", headers=headers, json=body)
        print("search", r.status_code)
        if r.status_code == 200:
            for item in r.json().get("results", [])[:8]:
                title = ""
                if item.get("object") == "database":
                    t = item.get("title") or []
                    title = t[0].get("plain_text", "") if t else ""
                elif item.get("object") == "data_source":
                    t = item.get("title") or item.get("name") or ""
                    if isinstance(t, list) and t:
                        title = t[0].get("plain_text", "")
                    else:
                        title = str(t)
                print(" ", item.get("object"), item.get("id"), title)
