"""Recolecta el último episodio de Primer Click (Diario Financiero)."""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from typing import Optional

import feedparser
from bs4 import BeautifulSoup

# Carga ai_news/sources.py bajo otro nombre para evitar colisión (ambos archivos se llaman sources.py).
_AI_NEWS_SOURCES_PATH = Path(__file__).resolve().parent.parent / "ai_news" / "sources.py"
_spec = importlib.util.spec_from_file_location("_ai_news_sources", _AI_NEWS_SOURCES_PATH)
_ai_news_sources = importlib.util.module_from_spec(_spec)  # type: ignore
sys.modules["_ai_news_sources"] = _ai_news_sources
_spec.loader.exec_module(_ai_news_sources)  # type: ignore
_itunes_lookup_feed = _ai_news_sources._itunes_lookup_feed
Item = _ai_news_sources.Item

PRIMER_CLICK_ITUNES_ID = "1664526913"


def fetch_primer_click_latest() -> Optional[Item]:
    feed_url = _itunes_lookup_feed(PRIMER_CLICK_ITUNES_ID)
    if not feed_url:
        print("[finanzas-chile] no feed url for Primer Click")
        return None
    parsed = feedparser.parse(feed_url)
    if not parsed.entries:
        return None
    e = parsed.entries[0]
    audio_url = None
    for link in e.get("links", []):
        if link.get("type", "").startswith("audio"):
            audio_url = link.get("href")
            break
    if not audio_url:
        for enc in e.get("enclosures", []) or []:
            if enc.get("type", "").startswith("audio"):
                audio_url = enc.get("href") or enc.get("url")
                break
    return Item(
        source="Primer Click — Diario Financiero",
        title=e.get("title", ""),
        url=e.get("link", ""),
        published=e.get("published", ""),
        summary=BeautifulSoup(e.get("summary", ""), "html.parser").get_text(" ", strip=True)[:1500],
        audio_url=audio_url,
    )


def collect_all() -> dict:
    print("[finanzas-chile] fetching Primer Click...")
    pc = fetch_primer_click_latest()
    return {
        "primer_click": pc.to_dict() if pc else None,
    }


if __name__ == "__main__":
    import json
    print(json.dumps(collect_all(), indent=2, ensure_ascii=False))
