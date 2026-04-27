"""
market_context.py — Contexto macro en ~15 segundos.
Fetches: VIX, 10Y yield, DXY, sector rotation, fear/greed proxy + noticias RSS.
Usado por generate-report y refresh-macro para dar a la IA contexto real del mercado HOY.
"""
import sys, io, json, urllib.request, xml.etree.ElementTree as ET
import concurrent.futures
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime as _parse_date
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

# ── NEWS FEEDS ───────────────────────────────────────────────────────────────
NEWS_FEEDS = [
    ("Reuters Business",  "https://feeds.reuters.com/reuters/businessNews"),
    ("MarketWatch",       "https://feeds.marketwatch.com/marketwatch/topstories/"),
    ("CNBC Business",     "https://www.cnbc.com/id/10001147/device/rss/rss.html"),
    ("Yahoo Finance",     "https://finance.yahoo.com/rss/topfinstories"),
]

FINANCE_KW = [
    "fed","rate","inflation","tariff","war","iran","china","russia","ukraine","trade",
    "recession","gdp","employment","jobs","oil","opec","energy","crypto","bitcoin",
    "nvidia","ai","artificial intelligence","earnings","market","stock","economy",
    "trump","yield","bond","dollar","gold","silver","copper","tech","semiconductor",
    "rally","crash","correction","rally","crisis","sanctions","geopoliti",
]

def _score(title: str) -> int:
    t = title.lower()
    return sum(1 for kw in FINANCE_KW if kw in t)

def _fetch_single_feed(source: str, url: str, max_items: int, cutoff: datetime) -> list:
    items = []
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=8) as r:
            content = r.read()
        root = ET.fromstring(content)
        channel = root.find("channel") or root
        for item in (channel.findall("item") or [])[:max_items]:
            title = (item.findtext("title") or "").strip()
            link  = (item.findtext("link")  or "").strip()
            pub   = (item.findtext("pubDate") or "").strip()
            if not title:
                continue
            # Filtro de fecha (48h)
            try:
                if _parse_date(pub).astimezone(timezone.utc) < cutoff:
                    continue
            except Exception:
                pass  # no se puede parsear la fecha → incluir igual
            items.append({
                "score":  _score(title),
                "title":  title,
                "url":    link,
                "source": source,
                "date":   pub[:16] if pub else "",
            })
    except Exception:
        pass
    return items

def fetch_fear_greed() -> dict:
    """Fear & Greed Index de crypto — alternative.me, API gratuita sin key."""
    try:
        req = urllib.request.Request(
            "https://api.alternative.me/fng/?limit=1",
            headers={"User-Agent": "Mozilla/5.0"}
        )
        with urllib.request.urlopen(req, timeout=8) as r:
            data = json.loads(r.read())
        entry = data["data"][0]
        return {
            "value":          int(entry["value"]),
            "classification": entry["value_classification"],
        }
    except Exception:
        return {}


def fetch_news(max_per_feed: int = 6, top_n: int = 10) -> list:
    """Obtiene noticias financieras relevantes de múltiples RSS, en paralelo."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
    candidates = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
        futures = {
            ex.submit(_fetch_single_feed, src, url, max_per_feed, cutoff): src
            for src, url in NEWS_FEEDS
        }
        for f in concurrent.futures.as_completed(futures, timeout=12):
            try:
                candidates.extend(f.result())
            except Exception:
                pass
    candidates.sort(key=lambda x: x["score"], reverse=True)
    return [
        {"title": c["title"], "url": c["url"], "source": c["source"], "date": c["date"]}
        for c in candidates[:top_n]
    ]


# ── PRICE DATA ───────────────────────────────────────────────────────────────

def pct(a, b):
    try:
        return round((float(a) - float(b)) / abs(float(b)) * 100, 2)
    except:
        return None

def fetch_price(ticker_sym):
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


# ── MAIN ─────────────────────────────────────────────────────────────────────

ctx = {"generated_at": datetime.now().isoformat(), "macro": {}, "sectors": {}, "insights": [], "news": []}

# 1. Macro indicators (precio)
for sym, name in MACRO_TICKERS.items():
    d = fetch_price(sym)
    if d:
        ctx["macro"][name] = d

# 2. Sector rotation (1W performance ranking)
sector_perf = []
for sym, name in SECTOR_ETFS.items():
    d = fetch_price(sym)
    if d and d["w1"] is not None:
        ctx["sectors"][name] = d
        sector_perf.append((name, d["w1"]))

# 3. Insights automáticos de precio
sector_perf.sort(key=lambda x: x[1], reverse=True)
if sector_perf:
    top3    = [f"{n} ({p:+.1f}%)" for n, p in sector_perf[:3]]
    bottom3 = [f"{n} ({p:+.1f}%)" for n, p in sector_perf[-3:]]
    ctx["insights"].append(f"Sector rotation 1W — LIDERANDO: {', '.join(top3)}")
    ctx["insights"].append(f"Sector rotation 1W — REZAGADOS: {', '.join(bottom3)}")

vix_data = ctx["macro"].get("VIX (Fear Index)")
if vix_data:
    vix = vix_data["price"]
    if vix > 30:
        ctx["insights"].append(f"VIX={vix:.1f} — PÁNICO extremo. Históricamente zona de compra contrarian.")
    elif vix > 20:
        ctx["insights"].append(f"VIX={vix:.1f} — Miedo elevado. Volatilidad alta, oportunidades en activos sólidos.")
    elif vix < 14:
        ctx["insights"].append(f"VIX={vix:.1f} — Complacencia. Mercado no descontando riesgos. Cautela.")
    else:
        ctx["insights"].append(f"VIX={vix:.1f} — Volatilidad normal. Mercado en zona equilibrada.")

tnx_data = ctx["macro"].get("10Y Treasury Yield")
if tnx_data:
    yield_val = tnx_data["price"]
    yield_w   = tnx_data.get("w1", 0) or 0
    direction = "SUBIENDO" if yield_w > 0.5 else "BAJANDO" if yield_w < -0.5 else "ESTABLE"
    ctx["insights"].append(f"10Y Treasury={yield_val:.2f}% ({direction} {yield_w:+.1f}% 1W) — {'Presión sobre growth stocks.' if yield_val > 4.5 else 'Favorable para equities.' if yield_val < 3.5 else 'Nivel neutro.'}")

# 4. Fear & Greed Index (crypto sentiment)
fg = fetch_fear_greed()
if fg:
    ctx["fear_greed"] = fg
    level = fg["value"]
    label = fg["classification"]
    if level <= 25:
        ctx["insights"].append(f"Fear & Greed Crypto={level}/100 ({label}) — PÁNICO extremo. Históricamente zona de compra contrarian en BTC/ETH.")
    elif level <= 45:
        ctx["insights"].append(f"Fear & Greed Crypto={level}/100 ({label}) — Miedo en mercado crypto. Posible oportunidad si los técnicos acompañan.")
    elif level >= 75:
        ctx["insights"].append(f"Fear & Greed Crypto={level}/100 ({label}) — Codicia extrema. Riesgo de corrección en crypto, reducir posiciones especulativas.")
    else:
        ctx["insights"].append(f"Fear & Greed Crypto={level}/100 ({label}) — Sentimiento neutral/moderado en mercado crypto.")

# 5. Noticias RSS (en paralelo con lo anterior)
ctx["news"] = fetch_news()

print(json.dumps(ctx, ensure_ascii=False, indent=2))
