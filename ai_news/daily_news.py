"""Pipeline diario AI News.

Flujo: collect sources → transcribe Everyday AI → summarize con Llama → guardar JSON → enviar email.

Uso:
    python ai_news/daily_news.py            # corre todo
    python ai_news/daily_news.py --no-email # no manda mail (testing)
    python ai_news/daily_news.py --no-transcribe  # skip Whisper (más rápido)
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "ai_news"))

load_dotenv(ROOT / "dashboard" / ".env.local")

from sources import collect_all  # noqa: E402
from transcribe import transcribe_url  # noqa: E402
from summarize import summarize  # noqa: E402
from send_email import send_daily_email  # noqa: E402

OUTPUT_DIR = ROOT / "dashboard" / "public" / "data" / "ai-news"


def run(no_email: bool = False, no_transcribe: bool = False) -> int:
    today_iso = date.today().isoformat()
    print(f"\n=== AI Daily — {today_iso} ===\n")

    print("[1/4] Recolectando fuentes...")
    sources = collect_all()

    transcript = None
    if not no_transcribe:
        ep = sources.get("everyday_ai")
        if ep and ep.get("audio_url"):
            print(f"\n[2/4] Transcribiendo: {ep['title']}")
            transcript = transcribe_url(ep["audio_url"])
        else:
            print("\n[2/4] No hay audio_url para transcribir — skip")
    else:
        print("\n[2/4] Transcripción omitida (--no-transcribe)")

    print("\n[3/4] Generando resumen con Llama...")
    report = summarize(sources, transcript=transcript, today_iso=today_iso)
    if not report:
        print("ERROR: el resumen falló. Abortando.")
        return 1

    report["_meta"] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "transcript_used": bool(transcript),
        "transcript_chars": len(transcript) if transcript else 0,
        "sources_collected": {
            "everyday_ai": bool(sources.get("everyday_ai")),
            "tldr_ai": bool(sources.get("tldr_ai")),
            "bens_bites": bool(sources.get("bens_bites")),
            "latent_space_count": len(sources.get("latent_space") or []),
            "hacker_news_count": len(sources.get("hacker_news") or []),
        },
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / f"{today_iso}.json"
    out_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    latest_path = OUTPUT_DIR / "latest.json"
    latest_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"   guardado: {out_path}")

    if no_email:
        print("\n[4/4] Email omitido (--no-email)")
    else:
        print("\n[4/4] Enviando email...")
        send_daily_email(report)

    titular = report.get('titular_del_dia', '')
    sys.stdout.buffer.write(f"\n[OK] Done. Titular: {titular}\n".encode("utf-8", errors="replace"))
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-email", action="store_true")
    ap.add_argument("--no-transcribe", action="store_true")
    args = ap.parse_args()
    return run(no_email=args.no_email, no_transcribe=args.no_transcribe)


if __name__ == "__main__":
    sys.exit(main())
