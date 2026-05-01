"""Filtra, traduce y resume el material recolectado usando Groq Llama 3.3."""
from __future__ import annotations

import json
import os
import re
from typing import Optional

from groq import Groq

LLAMA_MODEL = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = """Eres un analista de tendencias de IA que escribe en español de Chile.
Tu trabajo es leer fuentes en inglés y entregar un resumen diario filtrando solo lo realmente relevante.

REGLAS DE FILTRADO (estrictas):
- Destacar SOLO si menciona: modelo nuevo, herramienta concreta, dato cuantificable, decisión de empresa relevante (OpenAI/Anthropic/Google/Meta/etc), o cambio regulatorio.
- Descartar: opiniones genéricas, hype sin datos, listicles, "5 ways to use ChatGPT".
- Si una fuente solo tiene marketing/hype, omítela.

FORMATO DE SALIDA: solo JSON válido (sin markdown, sin texto extra antes/después). Estructura exacta:

{
  "fecha": "YYYY-MM-DD",
  "titular_del_dia": "frase corta con LO MÁS importante del día",
  "puntos_clave": [
    {"titulo": "...", "resumen": "2-3 frases en español", "fuente": "Everyday AI | Latent Space | TLDR AI | Ben's Bites | Hacker News", "url": "https://..."}
  ],
  "herramientas_destacadas": [
    {"nombre": "...", "que_es": "1 frase", "por_que_importa": "1 frase"}
  ],
  "aplicacion_practica": "2-3 frases sobre cómo aplicar esto a un negocio o automatización (perfil: builder/SDR/founder Chile)",
  "veredicto": "1-2 frases sin relleno: ¿el día tuvo señal real o fue ruido?"
}

LÍMITES:
- Máximo 5 puntos clave (los MÁS importantes — si no hay 5 reales, devuelve menos).
- Máximo 4 herramientas destacadas (omite el campo si no hay nada concreto).
- Texto en español, nombres propios y términos técnicos pueden quedar en inglés.
"""


def _extract_json(text: str) -> Optional[dict]:
    """Brace-tracking parser robusto (igual patrón que extractJson de maia-skill)."""
    start = text.find("{")
    if start < 0:
        return None
    depth = 0
    in_string = False
    escape = False
    for i in range(start, len(text)):
        ch = text[i]
        if escape:
            escape = False
            continue
        if ch == "\\":
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                blob = text[start:i + 1]
                try:
                    return json.loads(blob)
                except Exception:
                    return None
    return None


def _build_user_prompt(sources: dict, transcript: Optional[str], today_iso: str) -> str:
    parts = [f"FECHA: {today_iso}\n\n=== FUENTES DEL DÍA ===\n"]

    ep = sources.get("everyday_ai")
    if ep:
        parts.append(f"\n--- Everyday AI Podcast ---\nTítulo: {ep['title']}\nURL: {ep['url']}\nResumen oficial: {ep.get('summary', '')[:800]}\n")
        if transcript:
            t = transcript[:18000]
            parts.append(f"Transcripción (en inglés, primeros 18k chars):\n{t}\n")

    tldr = sources.get("tldr_ai")
    if tldr:
        parts.append(f"\n--- TLDR AI ---\nURL: {tldr['url']}\nContenido: {tldr.get('body_text', '')[:4000]}\n")

    bens = sources.get("bens_bites")
    if bens:
        parts.append(f"\n--- Ben's Bites ---\nContenido: {bens.get('body_text', '')[:4000]}\n")

    latent = sources.get("latent_space") or []
    if latent:
        parts.append("\n--- Latent Space (últimos posts) ---\n")
        for it in latent[:3]:
            parts.append(f"- [{it['title']}]({it['url']}): {it['summary'][:400]}\n")

    hn = sources.get("hacker_news") or []
    if hn:
        parts.append("\n--- Hacker News (top AI stories hoy) ---\n")
        for it in hn[:8]:
            parts.append(f"- [{it['title']}]({it['url']}) — {it['summary']}\n")

    parts.append("\n=== INSTRUCCIÓN ===\nGenera el JSON siguiendo el formato del system prompt. Solo JSON, sin markdown.")
    return "".join(parts)


def summarize(sources: dict, transcript: Optional[str], today_iso: str) -> Optional[dict]:
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        print("[summarize] GROQ_API_KEY missing")
        return None
    client = Groq(api_key=api_key)
    user_prompt = _build_user_prompt(sources, transcript, today_iso)
    print(f"[summarize] sending {len(user_prompt)} chars to Llama...")
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
            print(f"[summarize] could not parse JSON. raw[:500]={raw[:500]}")
            return None
        data.setdefault("fecha", today_iso)
        return data
    except Exception as e:
        print(f"[summarize] groq failed: {e}")
        return None


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv("dashboard/.env.local")
    from sources import collect_all
    from datetime import date
    src = collect_all()
    out = summarize(src, transcript=None, today_iso=date.today().isoformat())
    print(json.dumps(out, indent=2, ensure_ascii=False))
