"""
market_context.py — Contexto macro en ~15 segundos.
Fetches: VIX, 10Y yield, DXY, sector rotation, fear/greed proxy.
Usado por generate-report para dar a Gemini contexto real del mercado HOY.
"""
import sys, io, json
from datetime import datetime
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import yfinance as yf

MACRO_TICKERS = {
    "^VIX":      "VIX (Fear Index)",
    "^TNX":      "10Y Treasury Yield",
    "DX-Y.NYB":  "Dollar Index (DXY)",
    "^GSPC":     "S&P 500",
    "^IXIC":     "Nasdaq",
    "GLD":       "Gold ETF",
    "BTC-USD":   "Bitcoin",
}

SECTOR_ETFS = {
    "XLK":  "Technology",
    "XLF":  "Financials",
    "XLV":  "Healthcare",
    "XLE":  "Energy",
    "XLY":  "Consumer Cyclical",
    "XLP":  "Consumer Defensive",
    "XLI":  "Industrials",
    "XLC":  "Communication",
    "XLB":  "Materials",
    "XLRE": "Real Estate",
}

def pct(a, b):
    try:
        return round((float(a) - float(b)) / abs(float(b)) * 100, 2)
    except:
        return None

def fetch(ticker_sym):
    try:
        t = yf.Ticker(ticker_sym)
        h = t.history(period="1mo")
        if h.empty: return None
        close = h["Close"]
        price = float(close.iloc[-1])
        d1  = pct(close.iloc[-1], close.iloc[-2]) if len(close) > 1 else None
        w1  = pct(close.iloc[-1], close.iloc[-6]) if len(close) > 5 else None
        m1  = pct(close.iloc[-1], close.iloc[0])
        return {"price": round(price, 4), "d1": d1, "w1": w1, "m1": m1}
    except:
        return None

ctx = {"generated_at": datetime.now().isoformat(), "macro": {}, "sectors": {}, "insights": []}

# 1. Macro indicators
for sym, name in MACRO_TICKERS.items():
    d = fetch(sym)
    if d:
        ctx["macro"][name] = d

# 2. Sector rotation (1W performance ranking)
sector_perf = []
for sym, name in SECTOR_ETFS.items():
    d = fetch(sym)
    if d and d["w1"] is not None:
        ctx["sectors"][name] = d
        sector_perf.append((name, d["w1"]))

# 3. Insights automáticos
sector_perf.sort(key=lambda x: x[1], reverse=True)
if sector_perf:
    top3    = [f"{n} ({p:+.1f}%)" for n, p in sector_perf[:3]]
    bottom3 = [f"{n} ({p:+.1f}%)" for n, p in sector_perf[-3:]]
    ctx["insights"].append(f"Sector rotation 1W — LIDERANDO: {', '.join(top3)}")
    ctx["insights"].append(f"Sector rotation 1W — REZAGADOS: {', '.join(bottom3)}")

# VIX interpretation
vix_data = ctx["macro"].get("VIX (Fear Index)")
if vix_data:
    vix = vix_data["price"]
    if vix > 30:
        ctx["insights"].append(f"VIX={vix:.1f} — PÁNICO extremo. Históricamente zona de compra contrarian.")
    elif vix > 20:
        ctx["insights"].append(f"VIX={vix:.1f} — Miedo elevado. Volatilidad alta, oportunidades en activos sólidos.")
    elif vix < 14:
        ctx["insights"].append(f"VIX={vix:.1f} — Complacencia. Mercado no está descontando riesgos. Cautela.")
    else:
        ctx["insights"].append(f"VIX={vix:.1f} — Volatilidad normal. Mercado en zona equilibrada.")

# 10Y yield interpretation
tnx_data = ctx["macro"].get("10Y Treasury Yield")
if tnx_data:
    yield_val = tnx_data["price"]
    yield_w   = tnx_data.get("w1", 0) or 0
    direction = "SUBIENDO" if yield_w > 0.5 else "BAJANDO" if yield_w < -0.5 else "ESTABLE"
    ctx["insights"].append(f"10Y Treasury={yield_val:.2f}% ({direction} {yield_w:+.1f}% 1W) — {'Presión sobre growth stocks y valuaciones.' if yield_val > 4.5 else 'Favorable para equities y growth.' if yield_val < 3.5 else 'Nivel neutro para mercados.'}")

print(json.dumps(ctx, ensure_ascii=False, indent=2))
