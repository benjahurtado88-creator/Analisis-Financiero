"""
youtube_signals.py — Polling diario de canales YouTube de inversión.

Para cada canal en CHANNELS:
  1. Scrape la página /videos del canal → últimos N videoIds
  2. Para cada video nuevo (no procesado antes):
     - Descarga transcript (es preferido, en como fallback)
     - Pasa a Groq llama-3.3-70b para extraer señales estructuradas
     - Guarda en youtube_signals.json

Estado se persiste en youtube_signals.json — corridas siguientes solo procesan videos nuevos.

Uso:
    python youtube_signals.py                # procesa últimos 5 videos por canal
    python youtube_signals.py --max 10       # últimos 10 por canal
    python youtube_signals.py --force VID    # reprocesa un video específico
"""
import sys, io, os, json, re, argparse, urllib.request, urllib.error
from datetime import datetime, timezone
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).parent
SIGNALS_FILE = ROOT / "youtube_signals.json"
ENV_FILE     = ROOT / "dashboard" / ".env.local"

CHANNELS = [
    {"handle": "KManuS88",                "channel_id": "UC0Ym7ckYtSsgcbZX1VvYMQQ"},
    {"handle": "JavierDV",                "channel_id": "UCGBuHt_WnA9W9VlIE7FOowA"},
    {"handle": "academiadeinversoresusa", "channel_id": "UC5MrBwWA29UVKJUiv0S6I6A"},
]

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")
TRANSCRIPT_MAX_CHARS = 12000  # Cap antes de mandar a Groq para encajar en context window
GROQ_MODEL = "llama-3.3-70b-versatile"


def load_groq_key() -> str:
    """Lee GROQ_API_KEY desde dashboard/.env.local."""
    if not ENV_FILE.exists():
        raise RuntimeError(f"No existe {ENV_FILE}")
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("GROQ_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError("GROQ_API_KEY no encontrada en .env.local")


def load_state() -> dict:
    if SIGNALS_FILE.exists():
        return json.loads(SIGNALS_FILE.read_text(encoding="utf-8"))
    return {"last_run": None, "channels": {}, "videos": {}}


def save_state(state: dict) -> None:
    SIGNALS_FILE.write_text(
        json.dumps(state, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _json_decode(s: str) -> str:
    """Decodifica escapes JSON (\\uXXXX, \\n, etc.) sin romper UTF-8 directo."""
    try:
        return json.loads(f'"{s}"')
    except Exception:
        return s


def fetch_channel_videos(handle: str, limit: int = 5) -> list[dict]:
    """Scrape /videos page → lista de {video_id, title, published_text}."""
    url = f"https://www.youtube.com/@{handle}/videos"
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    })
    html = urllib.request.urlopen(req, timeout=15).read().decode("utf-8", errors="replace")

    # Match videoId → first "title":{"runs":[{"text":"..."}]} after it
    # (thumbnails block contains nested {} so we can't use [^}])
    title_pat = re.compile(
        r'"videoId":"([\w-]{11})".{0,5000}?"title":\{"runs":\[\{"text":"([^"]+)"',
        re.DOTALL,
    )
    pub_pat = re.compile(
        r'"videoId":"([\w-]{11})".{0,8000}?"publishedTimeText":\{"simpleText":"([^"]+)"',
        re.DOTALL,
    )
    pub_by_id: dict[str, str] = {}
    for vid, pub in pub_pat.findall(html):
        pub_by_id.setdefault(vid, _json_decode(pub))

    seen: dict[str, str] = {}
    for vid, title in title_pat.findall(html):
        if vid not in seen:
            seen[vid] = _json_decode(title)
        if len(seen) >= limit:
            break
    return [
        {"video_id": vid, "title": t, "published_text": pub_by_id.get(vid, "")}
        for vid, t in seen.items()
    ]


def fetch_transcript(video_id: str) -> tuple[str, str]:
    """Devuelve (texto_unificado, lang). Lanza excepción si no hay transcript."""
    from youtube_transcript_api import YouTubeTranscriptApi  # type: ignore
    api = YouTubeTranscriptApi()
    fetched = api.fetch(video_id, languages=["es", "en", "es-419", "en-US"])
    raw = fetched.to_raw_data()
    text = " ".join(s.get("text", "") for s in raw)
    text = re.sub(r"\s+", " ", text).strip()
    lang = getattr(fetched, "language_code", "unknown")
    return text, lang


def call_groq(api_key: str, system: str, user: str) -> str:
    """POST a Groq chat completions, retorna content del assistant."""
    payload = json.dumps({
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type":  "application/json",
            "User-Agent":    "youtube-signals/1.0 (urllib)",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        body = json.loads(r.read())
    return body["choices"][0]["message"]["content"]


ANALYSIS_SYSTEM = (
    "Eres un analista que extrae señales de inversión de transcripts de YouTube. "
    "Output JSON ESTRICTO sin texto extra. Solo extrae lo que el speaker dice "
    "explícitamente — NO inventes tickers, NO infieras tesis no mencionadas. "
    "Si el video NO trata de inversiones/finanzas/macro, devuelve relevante=false "
    "con campos vacíos."
)

ANALYSIS_SCHEMA = """{
  "relevante": true | false,
  "resumen_breve": "2-3 oraciones del mensaje principal del video",
  "tesis_principal": "la tesis central que defiende el speaker (1 oración) o '' si no hay",
  "sentimiento_general": "bullish" | "bearish" | "neutral" | "mixto",
  "horizonte": "corto" | "medio" | "largo" | "sin horizonte",
  "tickers_mencionados": [
    {
      "ticker": "BTC",
      "contexto": "qué dice del ticker",
      "sentimiento": "bullish" | "bearish" | "neutral"
    }
  ],
  "macro_temas": ["recesión", "tasas Fed", ...],
  "claims_clave": ["claim 1", "claim 2", "claim 3"],
  "riesgos_mencionados": ["..."]
}"""


def analyze_transcript(api_key: str, title: str, transcript: str, channel: str) -> dict:
    if len(transcript) > TRANSCRIPT_MAX_CHARS:
        transcript = transcript[:TRANSCRIPT_MAX_CHARS] + " [...truncado]"
    user = (
        f"CANAL: @{channel}\n"
        f"TÍTULO: {title}\n\n"
        f"TRANSCRIPT:\n{transcript}\n\n"
        f"Devuelve EXACTAMENTE este schema JSON:\n{ANALYSIS_SCHEMA}"
    )
    raw = call_groq(api_key, ANALYSIS_SYSTEM, user)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Brace tracking fallback
        start = raw.find("{")
        depth = 0
        for i in range(start, len(raw)):
            if raw[i] == "{":
                depth += 1
            elif raw[i] == "}":
                depth -= 1
                if depth == 0:
                    return json.loads(raw[start:i+1])
        raise


def process_channel(handle: str, channel_id: str, state: dict, max_videos: int,
                    api_key: str, force_video: str | None) -> int:
    """Procesa un canal. Retorna # videos nuevos analizados."""
    print(f"\n=== @{handle} ===", file=sys.stderr)
    try:
        videos = fetch_channel_videos(handle, limit=max_videos)
    except Exception as e:
        print(f"  ERROR listando videos: {e}", file=sys.stderr)
        return 0

    state["channels"].setdefault(handle, {})
    state["channels"][handle].update({
        "channel_id":     channel_id,
        "last_checked":   datetime.now(timezone.utc).isoformat(),
        "last_video_ids": [v["video_id"] for v in videos],
    })

    new_count = 0
    for v in videos:
        vid = v["video_id"]
        if vid in state["videos"] and force_video != vid:
            continue
        print(f"  → {vid} | {v['title'][:70]}", file=sys.stderr)

        try:
            transcript, lang = fetch_transcript(vid)
        except Exception as e:
            print(f"    transcript no disponible: {e}", file=sys.stderr)
            state["videos"][vid] = {
                "video_id":     vid,
                "title":        v["title"],
                "channel":      handle,
                "url":          f"https://www.youtube.com/watch?v={vid}",
                "published_text": v.get("published_text", ""),
                "fetched_at":   datetime.now(timezone.utc).isoformat(),
                "error":        f"no_transcript: {e}",
            }
            continue

        try:
            analysis = analyze_transcript(api_key, v["title"], transcript, handle)
        except Exception as e:
            print(f"    análisis falló: {e}", file=sys.stderr)
            analysis = {"_error": str(e)}

        state["videos"][vid] = {
            "video_id":         vid,
            "title":            v["title"],
            "channel":          handle,
            "url":              f"https://www.youtube.com/watch?v={vid}",
            "published_text":   v.get("published_text", ""),
            "fetched_at":       datetime.now(timezone.utc).isoformat(),
            "transcript_chars": len(transcript),
            "lang":             lang,
            "analysis":         analysis,
        }
        new_count += 1
        # Guardado incremental — si crashea a mitad, no perdemos lo procesado
        save_state(state)

    return new_count


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max", type=int, default=5, help="Videos por canal a revisar (default 5)")
    ap.add_argument("--force", type=str, default=None, help="Reprocesa un video_id específico")
    args = ap.parse_args()

    api_key = load_groq_key()
    state = load_state()

    total_new = 0
    for ch in CHANNELS:
        total_new += process_channel(
            handle=ch["handle"],
            channel_id=ch["channel_id"],
            state=state,
            max_videos=args.max,
            api_key=api_key,
            force_video=args.force,
        )

    state["last_run"] = datetime.now(timezone.utc).isoformat()
    save_state(state)

    print(f"\n✓ Listo. Videos nuevos analizados: {total_new}", file=sys.stderr)
    print(f"  Estado: {SIGNALS_FILE}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
