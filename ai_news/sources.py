"""Recolecta items de las 5 fuentes de IA.

Cada fuente devuelve una lista de dicts con: source, title, url, published, summary, audio_url (opcional).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional

import feedparser
import requests
from bs4 import BeautifulSoup

EVERYDAY_AI_ITUNES_ID = "1683401861"
LATENT_SPACE_FEED = "https://www.latent.space/feed"
HN_ALGOLIA = "https://hn.algolia.com/api/v1/search_by_date"
TLDR_AI_URL = "https://tldr.tech/ai"
BENS_BITES_URL = "https://bensbites.com/"

UA = {"User-Agent": "Mozilla/5.0 (compatible; AINewsBot/1.0)"}


@dataclass
class Item:
    source: str
    title: str
    url: str
    published: str = ""
    summary: str = ""
    audio_url: Optional[str] = None
    body_text: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


def _itunes_lookup_feed(itunes_id: str) -> Optional[str]:
    try:
        r = requests.get(
            "https://itunes.apple.com/lookup",
            params={"id": itunes_id, "entity": "podcast"},
            timeout=10,
            headers=UA,
        )
        r.raise_for_status()
        data = r.json()
        results = data.get("results") or []
        if results:
            return results[0].get("feedUrl")
    except Exception as e:
        print(f"[sources] itunes lookup failed: {e}")
    return None


def fetch_everyday_ai_latest() -> Optional[Item]:
    """Devuelve el último episodio de Everyday AI con audio_url."""
    feed_url = _itunes_lookup_feed(EVERYDAY_AI_ITUNES_ID)
    if not feed_url:
        print("[sources] no feed url for Everyday AI")
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
        source="Everyday AI",
        title=e.get("title", ""),
        url=e.get("link", ""),
        published=e.get("published", ""),
        summary=BeautifulSoup(e.get("summary", ""), "html.parser").get_text(" ", strip=True)[:1500],
        audio_url=audio_url,
    )


def fetch_latent_space(limit: int = 3) -> list[Item]:
    parsed = feedparser.parse(LATENT_SPACE_FEED)
    out = []
    for e in parsed.entries[:limit]:
        out.append(Item(
            source="Latent Space",
            title=e.get("title", ""),
            url=e.get("link", ""),
            published=e.get("published", ""),
            summary=BeautifulSoup(e.get("summary", ""), "html.parser").get_text(" ", strip=True)[:1200],
        ))
    return out


def fetch_hn_ai(limit: int = 8) -> list[Item]:
    """Top historias HN de ayer/hoy con tag AI/LLM/GPT en título."""
    try:
        r = requests.get(
            HN_ALGOLIA,
            params={"tags": "story", "hitsPerPage": 50, "numericFilters": "points>=80"},
            timeout=10,
            headers=UA,
        )
        r.raise_for_status()
        hits = r.json().get("hits", [])
    except Exception as e:
        print(f"[sources] HN failed: {e}")
        return []
    pat = re.compile(r"\b(AI|LLM|GPT|Claude|Gemini|Llama|agent|model|inference|RAG|Anthropic|OpenAI)\b", re.I)
    out = []
    for h in hits:
        title = h.get("title") or ""
        if not pat.search(title):
            continue
        out.append(Item(
            source="Hacker News",
            title=title,
            url=h.get("url") or f"https://news.ycombinator.com/item?id={h.get('objectID')}",
            published=h.get("created_at", ""),
            summary=f"{h.get('points', 0)} pts · {h.get('num_comments', 0)} comments",
        ))
        if len(out) >= limit:
            break
    return out


def _scrape_page_text(url: str, max_chars: int = 4000) -> str:
    try:
        r = requests.get(url, timeout=15, headers=UA)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        text = soup.get_text(" ", strip=True)
        return text[:max_chars]
    except Exception as e:
        print(f"[sources] scrape failed {url}: {e}")
        return ""


def fetch_tldr_ai() -> Optional[Item]:
    """TLDR AI: scrape la home y toma el último issue link."""
    try:
        r = requests.get(TLDR_AI_URL, timeout=15, headers=UA)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        link = None
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if "/tech/" in href or "/ai/" in href:
                if re.search(r"\d{4}-\d{2}-\d{2}", href):
                    link = href if href.startswith("http") else f"https://tldr.tech{href}"
                    break
        if not link:
            link = TLDR_AI_URL
        body = _scrape_page_text(link, max_chars=6000)
        return Item(
            source="TLDR AI",
            title="TLDR AI — último issue",
            url=link,
            summary=body[:600],
            body_text=body,
        )
    except Exception as e:
        print(f"[sources] TLDR AI failed: {e}")
        return None


def fetch_bens_bites() -> Optional[Item]:
    try:
        body = _scrape_page_text(BENS_BITES_URL, max_chars=6000)
        if not body:
            return None
        return Item(
            source="Ben's Bites",
            title="Ben's Bites — último newsletter",
            url=BENS_BITES_URL,
            summary=body[:600],
            body_text=body,
        )
    except Exception as e:
        print(f"[sources] Ben's Bites failed: {e}")
        return None


def collect_all() -> dict:
    """Devuelve dict con todas las fuentes recolectadas."""
    print("[sources] fetching Everyday AI...")
    everyday = fetch_everyday_ai_latest()
    print("[sources] fetching Latent Space...")
    latent = fetch_latent_space()
    print("[sources] fetching HN AI...")
    hn = fetch_hn_ai()
    print("[sources] fetching TLDR AI...")
    tldr = fetch_tldr_ai()
    print("[sources] fetching Ben's Bites...")
    bens = fetch_bens_bites()
    return {
        "everyday_ai": everyday.to_dict() if everyday else None,
        "latent_space": [i.to_dict() for i in latent],
        "hacker_news": [i.to_dict() for i in hn],
        "tldr_ai": tldr.to_dict() if tldr else None,
        "bens_bites": bens.to_dict() if bens else None,
        "collected_at": datetime.now(timezone.utc).isoformat(),
    }


if __name__ == "__main__":
    import json
    print(json.dumps(collect_all(), indent=2, ensure_ascii=False)[:3000])
