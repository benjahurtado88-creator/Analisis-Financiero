"""Resumen financiero Chile usando Llama 3.3 — enfoque en mercados, IPSA, dólar, BCCh."""
from __future__ import annotations

import importlib.util
import json
import os
import sys
from pathlib import Path
from typing import Optional

from groq import Groq

# Carga ai_news/summarize.py bajo otro nombre para evitar colisión.
_AI_NEWS_SUMMARIZE_PATH = Path(__file__).resolve().parent.parent / "ai_news" / "summarize.py"
_spec = importlib.util.spec_from_file_location("_ai_news_summarize", _AI_NEWS_SUMMARIZE_PATH)
_ai_news_summarize = importlib.util.module_from_spec(_spec)  # type: ignore
sys.modules["_ai_news_summarize"] = _ai_news_summarize
_spec.loader.exec_module(_ai_news_summarize)  # type: ignore
_extract_json = _ai_news_summarize._extract_json

LLAMA_MODEL = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = """Eres un analista financiero chileno que escribe en español de Chile.
Tu trabajo es escuchar el podcast Primer Click del Diario Financiero (transcripción) y entregar un resumen ejecutivo del día financiero.

ENFOQUE:
- IPSA, dólar (USD/CLP), cobre, tasa BCCh, inflación
- Hechos esenciales relevantes (CMF), M&A locales
- Contexto global que afecta a Chile (Fed, China, commodities)
- Movimientos clave del día y proyecciones

FORMATO DE SALIDA: solo JSON válido (sin markdown). Estructura exacta:

{
  "fecha": "YYYY-MM-DD",
  "titular_del_dia": "frase corta con LO MÁS importante del día financiero Chile",
  "indicadores_clave": [
    {"nombre": "IPSA | Dólar | Cobre | etc", "valor": "número o nivel actual si se menciona", "movimiento": "+/-X% o tendencia"}
  ],
  "puntos_clave": [
    {"titulo": "...", "resumen": "2-3 frases en español", "categoria": "Mercado local | Macro | Empresa | Global"}
  ],
  "contexto_global": "2-3 frases sobre cómo lo internacional afecta a Chile hoy",
  "que_mirar_hoy": "1-2 frases: qué evento o dato del día puede mover el mercado",
  "veredicto": "1 frase: ¿día tranquilo, volátil, alcista, bajista?"
}

LÍMITES:
- Máximo 5 puntos clave (los MÁS importantes).
- Máximo 6 indicadores clave (omite el campo si el podcast no los menciona).
- Texto en español de Chile, nombres propios pueden quedar en inglés.
- Si no hay transcripción, igual genera el JSON con la información disponible (resumen oficial del episodio).
"""


def _build_user_prompt(sources: dict, transcript: Optional[str], today_iso: str) -> str:
    parts = [f"FECHA: {today_iso}\n\n=== EPISODIO PRIMER CLICK ===\n"]

    pc = sources.get("primer_click")
    if pc:
        parts.append(f"\nTítulo: {pc['title']}\nURL: {pc['url']}\nResumen oficial: {pc.get('summary', '')[:1500]}\n")
        if transcript:
            t = transcript[:20000]
            parts.append(f"\nTranscripción completa (en español):\n{t}\n")
        else:
            parts.append("\n(No hay transcripción disponible — usa solo el resumen oficial)\n")
    else:
        parts.append("\n(No se pudo obtener el episodio de hoy)\n")

    parts.append("\n=== INSTRUCCIÓN ===\nGenera el JSON siguiendo el formato del system prompt. Solo JSON, sin markdown.")
    return "".join(parts)


def summarize(sources: dict, transcript: Optional[str], today_iso: str) -> Optional[dict]:
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        print("[finanzas-chile] GROQ_API_KEY missing")
        return None
    client = Groq(api_key=api_key)
    user_prompt = _build_user_prompt(sources, transcript, today_iso)
    print(f"[finanzas-chile] sending {len(user_prompt)} chars to Llama...")
    try:
        resp = client.chat.completions.create(
            model=LLAMA_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            max_tokens=4000,
            response_format={"type": "json_object"},
        )
        raw = resp.choices[0].message.content or ""
        data = _extract_json(raw)
        if not data:
            print(f"[finanzas-chile] could not parse JSON. raw[:500]={raw[:500]}")
            return None
        data.setdefault("fecha", today_iso)
        return data
    except Exception as e:
        print(f"[finanzas-chile] groq failed: {e}")
        return None
