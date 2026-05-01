"""Transcribe audio del podcast Everyday AI usando Groq Whisper."""
from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Optional

import requests
from groq import Groq

UA = {"User-Agent": "Mozilla/5.0 (compatible; AINewsBot/1.0)"}
WHISPER_MODEL = "whisper-large-v3-turbo"


def _download_audio(audio_url: str, dest: Path) -> Path:
    print(f"[transcribe] downloading {audio_url[:80]}...")
    r = requests.get(audio_url, stream=True, timeout=120, headers=UA)
    r.raise_for_status()
    with open(dest, "wb") as f:
        for chunk in r.iter_content(chunk_size=8192):
            f.write(chunk)
    print(f"[transcribe] downloaded {dest.stat().st_size // 1024} KB")
    return dest


def transcribe_url(audio_url: str, max_seconds: int = 1800) -> Optional[str]:
    """Descarga y transcribe el audio. Devuelve texto (en idioma original).

    Groq Whisper acepta archivos hasta 25 MB. Si el episodio es más grande,
    igual lo intentamos — Groq segmenta internamente. Si falla, devuelve None.
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        print("[transcribe] GROQ_API_KEY missing")
        return None
    client = Groq(api_key=api_key)
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "ep.mp3"
        try:
            _download_audio(audio_url, path)
        except Exception as e:
            print(f"[transcribe] download failed: {e}")
            return None
        size_mb = path.stat().st_size / (1024 * 1024)
        if size_mb > 24:
            print(f"[transcribe] file too large ({size_mb:.1f} MB), skipping")
            return None
        print(f"[transcribe] sending to Groq Whisper ({size_mb:.1f} MB)...")
        try:
            with open(path, "rb") as f:
                resp = client.audio.transcriptions.create(
                    file=(path.name, f.read()),
                    model=WHISPER_MODEL,
                    response_format="text",
                    language="en",
                )
            text = resp if isinstance(resp, str) else getattr(resp, "text", "")
            print(f"[transcribe] ok, {len(text)} chars")
            return text
        except Exception as e:
            print(f"[transcribe] groq failed: {e}")
            return None


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv("dashboard/.env.local")
    from sources import fetch_everyday_ai_latest
    ep = fetch_everyday_ai_latest()
    if ep and ep.audio_url:
        text = transcribe_url(ep.audio_url)
        print((text or "")[:1000])
