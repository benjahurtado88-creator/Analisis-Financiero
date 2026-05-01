"""Envía el resumen diario por Gmail SMTP."""
from __future__ import annotations

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from html import escape


def _render_html(report: dict) -> str:
    fecha = escape(report.get("fecha", ""))
    titular = escape(report.get("titular_del_dia", ""))
    veredicto = escape(report.get("veredicto", ""))
    aplicacion = escape(report.get("aplicacion_practica", ""))

    puntos_html = ""
    for p in report.get("puntos_clave") or []:
        puntos_html += f"""
        <li style="margin-bottom:14px;">
            <strong>{escape(p.get('titulo', ''))}</strong><br>
            <span style="color:#444;">{escape(p.get('resumen', ''))}</span><br>
            <small><em>{escape(p.get('fuente', ''))}</em> · <a href="{escape(p.get('url', '#'))}">link</a></small>
        </li>
        """

    tools_html = ""
    for t in report.get("herramientas_destacadas") or []:
        tools_html += f"""
        <li style="margin-bottom:8px;">
            <strong>{escape(t.get('nombre', ''))}</strong> — {escape(t.get('que_es', ''))}<br>
            <small style="color:#666;">{escape(t.get('por_que_importa', ''))}</small>
        </li>
        """
    tools_block = f"<h3>Herramientas destacadas</h3><ul>{tools_html}</ul>" if tools_html else ""

    return f"""<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 720px; margin: 0 auto; padding: 24px; color:#222;">
    <div style="border-bottom: 2px solid #eee; padding-bottom:12px; margin-bottom:20px;">
        <h1 style="margin:0; font-size:22px;">AI Daily — {fecha}</h1>
        <p style="margin:6px 0 0; color:#666; font-size:14px;">{titular}</p>
    </div>
    <h3>Puntos clave</h3>
    <ol>{puntos_html}</ol>
    {tools_block}
    <h3>Aplicación práctica</h3>
    <p>{aplicacion}</p>
    <h3>Veredicto</h3>
    <p style="font-style:italic; color:#555;">{veredicto}</p>
    <hr style="margin-top:30px; border:none; border-top:1px solid #eee;">
    <p style="font-size:12px; color:#999;">Generado automáticamente · Finance.ia AI News pipeline</p>
</body>
</html>"""


def send_daily_email(report: dict) -> bool:
    user = os.environ.get("GMAIL_USER")
    pwd = os.environ.get("GMAIL_APP_PASSWORD")
    to = os.environ.get("AI_NEWS_RECIPIENT") or user
    if not (user and pwd and to):
        print("[email] missing GMAIL_USER / GMAIL_APP_PASSWORD / AI_NEWS_RECIPIENT")
        return False

    fecha = report.get("fecha", "")
    titular = report.get("titular_del_dia", "")
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"AI Daily {fecha} — {titular[:80]}"
    msg["From"] = user
    msg["To"] = to
    msg.attach(MIMEText(_render_html(report), "html", "utf-8"))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30) as s:
            s.login(user, pwd)
            s.sendmail(user, [to], msg.as_string())
        print(f"[email] sent to {to}")
        return True
    except Exception as e:
        print(f"[email] failed: {e}")
        return False


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv("dashboard/.env.local")
    demo = {
        "fecha": "2026-04-30",
        "titular_del_dia": "Test del pipeline AI Daily",
        "puntos_clave": [{"titulo": "Test", "resumen": "Esto es un test.", "fuente": "Local", "url": "https://example.com"}],
        "aplicacion_practica": "Pipeline funcionando.",
        "veredicto": "Test ok.",
    }
    send_daily_email(demo)
