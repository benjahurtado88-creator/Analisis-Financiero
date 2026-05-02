"""Pipeline diario Finanzas Chile.

Flujo: fetch Primer Click -> transcribe Whisper -> resumen Llama -> guardar -> email.

Uso:
    python finanzas_chile/daily_finanzas.py
    python finanzas_chile/daily_finanzas.py --no-email
    python finanzas_chile/daily_finanzas.py --no-transcribe
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
sys.path.insert(0, str(ROOT / "finanzas_chile"))

load_dotenv(ROOT / "dashboard" / ".env.local")

from sources import collect_all  # type: ignore  # noqa: E402  (finanzas_chile/sources.py)
from transcribe import transcribe_url  # type: ignore  # noqa: E402  (ai_news/transcribe.py)
from summarize import summarize  # type: ignore  # noqa: E402  (finanzas_chile/summarize.py)
from send_email import send_daily_email  # type: ignore  # noqa: E402  (finanzas_chile/send_email.py)

OUTPUT_DIR = ROOT / "dashboard" / "public" / "data" / "finanzas-chile"


def run(no_email: bool = False, no_transcribe: bool = False) -> int:
    today_iso = date.today().isoformat()
    print(f"\n=== Finanzas Chile Daily — {today_iso} ===\n")

    print("[1/4] Recolectando Primer Click...")
    sources = collect_all()
    pc = sources.get("primer_click")
    if not pc:
        print("ERROR: no se pudo obtener el episodio.")
        return 1

    transcript = None
    if not no_transcribe and pc.get("audio_url"):
        print(f"\n[2/4] Transcribiendo: {pc['title']}")
        transcript = transcribe_url(pc["audio_url"])
    else:
        print("\n[2/4] Transcripción omitida")

    print("\n[3/4] Generando resumen con Llama...")
    report = summarize(sources, transcript=transcript, today_iso=today_iso)
    if not report:
        print("ERROR: el resumen falló.")
        return 1

    report["_meta"] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "transcript_used": bool(transcript),
        "transcript_chars": len(transcript) if transcript else 0,
        "episode_title": pc.get("title"),
        "episode_url": pc.get("url"),
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / f"{today_iso}.json"
    out_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    latest_path = OUTPUT_DIR / "latest.json"
    latest_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"   guardado: {out_path}")

    if no_email:
        print("\n[4/4] Email omitido")
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
