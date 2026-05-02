"""Envía el resumen Finanzas Chile por Gmail SMTP."""
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
    contexto = escape(report.get("contexto_global", ""))
    que_mirar = escape(report.get("que_mirar_hoy", ""))

    indicadores_html = ""
    for ind in report.get("indicadores_clave") or []:
        indicadores_html += f"""
        <tr>
            <td style="padding:6px 12px; border-bottom:1px solid #eee;"><strong>{escape(ind.get('nombre', ''))}</strong></td>
            <td style="padding:6px 12px; border-bottom:1px solid #eee;">{escape(str(ind.get('valor', '')))}</td>
            <td style="padding:6px 12px; border-bottom:1px solid #eee; color:#555;">{escape(ind.get('movimiento', ''))}</td>
        </tr>
        """
    indicadores_block = (
        f"""<h3>Indicadores clave</h3>
        <table style="border-collapse:collapse; width:100%; font-size:14px;">
            <thead><tr style="background:#f5f5f5;"><th style="padding:8px 12px; text-align:left;">Indicador</th><th style="padding:8px 12px; text-align:left;">Valor</th><th style="padding:8px 12px; text-align:left;">Mov.</th></tr></thead>
            <tbody>{indicadores_html}</tbody>
        </table>"""
        if indicadores_html else ""
    )

    puntos_html = ""
    for p in report.get("puntos_clave") or []:
        puntos_html += f"""
        <li style="margin-bottom:14px;">
            <strong>{escape(p.get('titulo', ''))}</strong>
            <span style="font-size:11px; color:#999; margin-left:6px;">[{escape(p.get('categoria', ''))}]</span><br>
            <span style="color:#444;">{escape(p.get('resumen', ''))}</span>
        </li>
        """

    return f"""<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width:720px; margin:0 auto; padding:24px; color:#222;">
    <div style="border-bottom:2px solid #eee; padding-bottom:12px; margin-bottom:20px;">
        <h1 style="margin:0; font-size:22px;">Finanzas Chile — {fecha}</h1>
        <p style="margin:6px 0 0; color:#666; font-size:14px;">{titular}</p>
    </div>
    {indicadores_block}
    <h3>Puntos clave del día</h3>
    <ol>{puntos_html}</ol>
    <h3>Contexto global</h3>
    <p>{contexto}</p>
    <h3>Qué mirar hoy</h3>
    <p style="background:#fffbeb; padding:10px; border-left:3px solid #f59e0b;">{que_mirar}</p>
    <h3>Veredicto</h3>
    <p style="font-style:italic; color:#555;">{veredicto}</p>
    <hr style="margin-top:30px; border:none; border-top:1px solid #eee;">
    <p style="font-size:12px; color:#999;">Resumen automático del podcast Primer Click — Diario Financiero · Pipeline Finanzas Chile</p>
</body>
</html>"""


def send_daily_email(report: dict) -> bool:
    user = os.environ.get("GMAIL_USER")
    pwd = os.environ.get("GMAIL_APP_PASSWORD")
    to = os.environ.get("AI_NEWS_RECIPIENT") or user
    if not (user and pwd and to):
        print("[finanzas-email] missing GMAIL_USER / GMAIL_APP_PASSWORD / AI_NEWS_RECIPIENT")
        return False

    fecha = report.get("fecha", "")
    titular = report.get("titular_del_dia", "")
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Finanzas CL {fecha} — {titular[:80]}"
    msg["From"] = user
    msg["To"] = to
    msg.attach(MIMEText(_render_html(report), "html", "utf-8"))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30) as s:
            s.login(user, pwd)
            s.sendmail(user, [to], msg.as_string())
        print(f"[finanzas-email] sent to {to}")
        return True
    except Exception as e:
        print(f"[finanzas-email] failed: {e}")
        return False
