import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from financetoolkit import Toolkit
import yfinance as yf
import pandas as pd
import urllib.request
import re
import json
import math
import os
from datetime import datetime


def _sanitize(obj):
    """Reemplaza NaN/Infinity con None para producir JSON válido."""
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(v) for v in obj]
    return obj

def nv(val, default=0):
    """Convierte None → default para usar en f-strings con formato numérico."""
    return default if val is None else val

# CONFIGURACION — usa variables de entorno si están disponibles, fallback a hardcoded
import os
API_KEY         = os.environ.get("FINANCETOOLKIT_API_KEY", "87etVkEnSmcBXp2yDkeGyiAq1PQfWrNL")
FINNHUB_API_KEY = os.environ.get("FINNHUB_API_KEY",         "d75jnhhr01qk56kd0ui0d75jnhhr01qk56kd0uig")

# Tickers desde argumentos (multi-ticker soportado)
tickers_input = [t.upper() for t in sys.argv[1:]] if len(sys.argv) > 1 else ["KO"]

# Cripto conocidos — normalizamos a formato Yahoo Finance
CRYPTO_SYMBOLS = {
    "BTC": "BTC-USD", "ETH": "ETH-USD", "SOL": "SOL-USD", "BNB": "BNB-USD",
    "XRP": "XRP-USD", "ADA": "ADA-USD", "AVAX": "AVAX-USD", "DOT": "DOT-USD",
    "MATIC": "MATIC-USD", "LINK": "LINK-USD", "DOGE": "DOGE-USD", "PEPE": "PEPE-USD",
    "SUI": "SUI-USD", "INJ": "INJ-USD", "ARB": "ARB-USD", "OP": "OP-USD",
    "TON": "TON-USD", "NEAR": "NEAR-USD", "APT": "APT-USD", "SEI": "SEI-USD",
    "TAO": "TAO22974-USD", "RENDER": "RNDR-USD", "RNDR": "RNDR-USD",
}

# P/E benchmark por tipo de empresa (para Fair Value contextualizado)
PE_BENCHMARK = {
    "value":      20,   # utilidades, consumo básico, bancos
    "blend":      25,   # mercado general
    "growth":     35,   # tech crecimiento moderado
    "high_growth": 50,  # IA, SaaS hipercrecimiento
}

# ============================================================
# HELPERS
# ============================================================

def normalize_ticker(t):
    if "-USD" in t or ("-" in t and len(t) > 4):
        return t, True
    if t in CRYPTO_SYMBOLS:
        return CRYPTO_SYMBOLS[t], True
    return t, False

def safe(df):
    try:
        if isinstance(df, pd.DataFrame):
            if len(df.index) > 0 and isinstance(df.index[0], str):
                df = df.T
            col = df.iloc[:, 0].replace(0.0, float('nan')).dropna()
            return float(col.iloc[-1]) if not col.empty else 0.0
        else:
            series = df.replace(0.0, float('nan')).dropna()
            return float(series.iloc[-1]) if not series.empty else 0.0
    except:
        return 0.0

def safe_series(df):
    try:
        if isinstance(df, pd.DataFrame):
            if len(df.index) > 0 and isinstance(df.index[0], str):
                df = df.T
            return df.iloc[:, 0].dropna()
        return df.dropna()
    except:
        return pd.Series(dtype=float)

def tendencia(serie):
    try:
        ultimos = serie.tail(3).values
        if len(ultimos) < 2:
            return "N/D"
        delta = ultimos[-1] - ultimos[0]
        if delta > 0:   return f"MEJORANDO (+{delta:.2%})"
        elif delta < 0: return f"DETERIORANDO ({delta:.2%})"
        else:           return "ESTABLE"
    except:
        return "N/D"

def pct(new, old):
    try:
        if old and old != 0:
            return round((new - old) / abs(old) * 100, 2)
    except:
        pass
    return 0.0

def fmt_large(n):
    """Formatea números grandes: 1.2T, 345B, 12M"""
    try:
        n = float(n)
        if n >= 1e12:  return f"${n/1e12:.2f}T"
        if n >= 1e9:   return f"${n/1e9:.2f}B"
        if n >= 1e6:   return f"${n/1e6:.2f}M"
        return f"${n:.2f}"
    except:
        return "N/D"

# ============================================================
# SENTIMIENTO DE MERCADO — FINNHUB
# Usamos SOLO el endpoint de sentimiento: ya viene procesado
# (score, buzz, bullish %) — sin leer noticias individuales.
# Ahorra tokens vs pedirle a Claude que infiera sentimiento.
# ============================================================

def calcular_sentimiento_mercado(precios, info_extra, r, es_cripto):
    """
    Sentiment score basado en comportamiento real del mercado (sin APIs externas).
    Fuentes: momentum de precio, posición técnica, consenso analistas,
    short interest, insider activity — todo via yfinance.
    Score: -10 (muy bearish) a +10 (muy bullish).
    """
    score   = 0
    señales = []

    try:
        # 1. MOMENTUM DE PRECIO (RSI)
        rsi = precios.get('rsi', 50)
        if rsi < 30:
            score += 2
            señales.append({"factor": "RSI Sobreventa", "valor": f"{rsi:.0f}", "señal": "BULLISH", "peso": "+2", "desc": "Zona de sobreventa — históricamente señal de rebote"})
        elif rsi < 45:
            score += 1
            señales.append({"factor": "RSI Bajo", "valor": f"{rsi:.0f}", "señal": "BULLISH", "peso": "+1", "desc": "Por debajo de zona neutral — presión vendedora moderada"})
        elif rsi > 70:
            score -= 2
            señales.append({"factor": "RSI Sobrecompra", "valor": f"{rsi:.0f}", "señal": "BEARISH", "peso": "-2", "desc": "Zona de sobrecompra — riesgo de corrección"})
        elif rsi > 60:
            score -= 1
            señales.append({"factor": "RSI Alto", "valor": f"{rsi:.0f}", "señal": "NEUTRAL", "peso": "-1", "desc": "Momentum positivo pero acercándose a sobrecompra"})
        else:
            señales.append({"factor": "RSI Neutral", "valor": f"{rsi:.0f}", "señal": "NEUTRAL", "peso": "0", "desc": "Sin señal clara de momentum"})

        # 2. TENDENCIA SMA (señal institucional)
        tend = precios.get('tendencia_sma', 'MIXTA')
        if tend == "ALCISTA":
            score += 2
            señales.append({"factor": "Tendencia SMA", "valor": "ALCISTA", "señal": "BULLISH", "peso": "+2", "desc": "Precio sobre SMA50 y SMA200 — dinero institucional posicionado largo"})
        elif tend == "BAJISTA":
            score -= 2
            señales.append({"factor": "Tendencia SMA", "valor": "BAJISTA", "señal": "BEARISH", "peso": "-2", "desc": "Precio bajo SMA50 y SMA200 — presión vendedora institucional"})
        else:
            señales.append({"factor": "Tendencia SMA", "valor": "MIXTA", "señal": "NEUTRAL", "peso": "0", "desc": "Señales técnicas contradictorias"})

        # 3. MACD
        if precios.get('macd_bullish'):
            score += 1
            señales.append({"factor": "MACD", "valor": "Alcista", "señal": "BULLISH", "peso": "+1", "desc": "Cruce MACD alcista — momentum de corto plazo positivo"})
        else:
            score -= 1
            señales.append({"factor": "MACD", "valor": "Bajista", "señal": "BEARISH", "peso": "-1", "desc": "MACD por debajo de señal — momentum de corto plazo negativo"})

        # 4. CONSENSO ANALISTAS
        rec = info_extra.get('analyst_rec', '')
        n_analysts = info_extra.get('analyst_count', 0) or 0
        if rec in ('BUY', 'STRONG_BUY') and n_analysts >= 5:
            score += 2
            señales.append({"factor": "Analistas", "valor": f"{rec} ({n_analysts})", "señal": "BULLISH", "peso": "+2", "desc": f"{n_analysts} analistas recomiendan compra — consenso profesional positivo"})
        elif rec in ('SELL', 'STRONG_SELL') and n_analysts >= 5:
            score -= 2
            señales.append({"factor": "Analistas", "valor": f"{rec} ({n_analysts})", "señal": "BEARISH", "peso": "-2", "desc": f"{n_analysts} analistas recomiendan venta"})
        elif rec == 'HOLD':
            señales.append({"factor": "Analistas", "valor": f"HOLD ({n_analysts})", "señal": "NEUTRAL", "peso": "0", "desc": "Consenso neutral — sin catalizador claro según analistas"})

        # 5. SHORT INTEREST (solo acciones)
        if not es_cripto:
            short_ratio = info_extra.get('short_ratio', 0) or 0
            if short_ratio > 10:
                score -= 1
                señales.append({"factor": "Short Interest", "valor": f"{short_ratio:.1f}d", "señal": "BEARISH", "peso": "-1", "desc": f"Short ratio {short_ratio:.1f} días — presión bajista significativa de cortos"})
            elif short_ratio > 0:
                señales.append({"factor": "Short Interest", "valor": f"{short_ratio:.1f}d", "señal": "NEUTRAL", "peso": "0", "desc": "Short interest moderado — sin alarma"})

        # 6. PRECIO vs 52 SEMANAS
        precio_act = precios.get('precio_actual', 0)
        high_52    = precios.get('high_52w', 0)
        low_52     = precios.get('low_52w', 0)
        if high_52 > low_52 and precio_act > 0:
            pos_52 = (precio_act - low_52) / (high_52 - low_52) * 100
            if pos_52 >= 80:
                score -= 1
                señales.append({"factor": "Posición 52s", "valor": f"{pos_52:.0f}%", "señal": "BEARISH", "peso": "-1", "desc": "Cerca del máximo anual — poco margen al alza sin nuevo catalizador"})
            elif pos_52 <= 20:
                score += 1
                señales.append({"factor": "Posición 52s", "valor": f"{pos_52:.0f}%", "señal": "BULLISH", "peso": "+1", "desc": "Cerca del mínimo anual — posible valor en zona baja histórica"})
            else:
                señales.append({"factor": "Posición 52s", "valor": f"{pos_52:.0f}%", "señal": "NEUTRAL", "peso": "0", "desc": "En zona media del rango anual"})

        # Score final
        score = max(-10, min(10, score))
        if score >= 4:     label = "MUY BULLISH"
        elif score >= 2:   label = "BULLISH"
        elif score >= -1:  label = "NEUTRAL"
        elif score >= -3:  label = "BEARISH"
        else:              label = "MUY BEARISH"

        return {
            "fuente":   "Análisis cuantitativo (precio + técnico + analistas)",
            "score":    score,
            "max":      10,
            "label":    label,
            "señales":  señales,
        }

    except Exception as e:
        return {"_error": str(e)}


# ============================================================
# DATOS EXTERNOS PARA CRYPTO — sin key, APIs públicas gratuitas
# ============================================================

def fetch_fear_greed() -> dict:
    """
    Fear & Greed Index de crypto — alternative.me, API gratuita sin key.
    Escala 0-100: 0-25=Extreme Fear, 26-45=Fear, 46-55=Neutral,
    56-75=Greed, 76-100=Extreme Greed.
    """
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
    except Exception as e:
        return {"_error": str(e)}


def fetch_crypto_social(symbol_yf: str) -> dict:
    """
    Datos sociales de CoinGecko — API gratuita sin key.
    symbol_yf: "BTC-USD" → mapea a ID CoinGecko ("bitcoin")
    Retorna: sentiment_bullish_pct, watchlist_users, market_cap_rank
    """
    COINGECKO_IDS = {
        "BTC": "bitcoin",  "ETH": "ethereum",  "SOL": "solana",
        "BNB": "binancecoin", "XRP": "ripple",  "ADA": "cardano",
        "AVAX": "avalanche-2", "DOT": "polkadot", "MATIC": "matic-network",
        "LINK": "chainlink", "DOGE": "dogecoin",  "SUI": "sui",
        "INJ": "injective-protocol", "NEAR": "near", "APT": "aptos",
        "RNDR": "render-token", "TON": "the-open-network",
    }
    symbol = symbol_yf.replace("-USD", "").split("-")[0].upper()
    coin_id = COINGECKO_IDS.get(symbol)
    if not coin_id:
        return {"_error": f"No CoinGecko ID for {symbol}"}
    try:
        url = f"https://api.coingecko.com/api/v3/coins/{coin_id}?localization=false&tickers=false&market_data=false&community_data=true&developer_data=false"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read())
        return {
            "sentiment_bullish_pct": data.get("sentiment_votes_up_percentage"),
            "sentiment_bearish_pct": data.get("sentiment_votes_down_percentage"),
            "watchlist_users":       data.get("watchlist_portfolio_users"),
            "market_cap_rank":       data.get("market_cap_rank"),
        }
    except Exception as e:
        return {"_error": str(e)}


# ============================================================
# NOTICIAS — FILTRO PYTHON PROPIO
# Puntúa noticias por relevancia (keywords + fuente confiable)
# y entrega solo el top N a Claude → menos tokens, más calidad.
# ============================================================

# Keywords por peso de impacto financiero
NEWS_KEYWORDS = {
    # Alto impacto (3 pts)
    "earnings":      3, "revenue":   3, "guidance":   3, "beat":       3,
    "miss":          3, "merger":    3, "acquisition":3, "buyout":     3,
    "fed":           3, "rate":      3, "inflation":  3, "recession":  3,
    "bankruptcy":    3, "default":   3, "sec":        3, "fraud":      3,
    "dividend":      3, "buyback":   3, "ipo":        3,
    # Medio impacto (2 pts)
    "forecast":      2, "outlook":   2, "upgrade":    2, "downgrade":  2,
    "analyst":       2, "target":    2, "profit":     2, "loss":       2,
    "growth":        2, "layoff":    2, "hired":      2, "ceo":        2,
    "deal":          2, "contract":  2, "partnership":2, "launch":     2,
    "ai":            2, "chip":      2, "cloud":      2, "tariff":     2,
    # Bajo impacto (1 pt)
    "market":        1, "stock":     1, "shares":     1, "investor":   1,
    "quarter":       1, "annual":    1, "sales":      1, "supply":     1,
}

# Fuentes de mayor confiabilidad (bonus pts)
FUENTES_CONFIABLES = {
    "Reuters":       3, "Bloomberg":  3, "Wall Street Journal": 3,
    "Financial Times":3, "CNBC":      2, "MarketWatch":  2,
    "Barron's":      2, "Barrons.com":2, "Seeking Alpha":2,
    "The Motley Fool":1, "Motley Fool":1, "Benzinga":    1,
    "24/7 Wall St.": 1, "Simply Wall St.": 1, "Investing.com": 1,
}

def puntuar_noticia(titulo, resumen, fuente):
    """Calcula score de relevancia financiera de una noticia."""
    texto  = (titulo + " " + resumen).lower()
    score  = 0
    for kw, pts in NEWS_KEYWORDS.items():
        if kw in texto:
            score += pts
    score += FUENTES_CONFIABLES.get(fuente, 0)
    return score

# Keywords para detectar si la noticia es positiva o negativa para el activo
NEWS_BULLISH_KW = {
    "beat", "beats", "record", "surge", "surges", "rally", "rallies", "upgrade",
    "upgrades", "upgraded", "buyback", "buy back", "outperform", "approval",
    "approved", "approves", "partnership", "deal", "merger", "acquisition",
    "dividend increase", "raised guidance", "raises guidance", "strong earnings",
    "profit rises", "revenue beats", "strong results", "positive", "breakout",
    "all-time high", "new high", "bullish", "buy", "overweight", "growth",
    "expansion", "investment", "launch", "launches", "wins contract",
}
NEWS_BEARISH_KW = {
    "miss", "misses", "missed", "downgrade", "downgrades", "downgraded",
    "bankruptcy", "bankrupt", "default", "fraud", "investigation", "recall",
    "layoff", "layoffs", "job cuts", "cuts jobs", "loss", "losses", "decline",
    "declining", "warning", "concern", "risk", "sell", "underperform",
    "underweight", "disappoints", "disappointing", "weak results", "guidance cut",
    "lowers guidance", "below expectations", "miss estimates", "short seller",
    "probe", "subpoena", "lawsuit", "penalty", "fine", "crash", "plunge",
    "plunges", "sell-off", "selloff", "bearish", "recession", "inflation spike",
}

def detectar_sentimiento_noticia(titulo, resumen):
    """Clasifica si una noticia es bullish, bearish o neutral para el activo."""
    texto = (titulo + " " + resumen).lower()
    bull = sum(1 for kw in NEWS_BULLISH_KW if kw in texto)
    bear = sum(1 for kw in NEWS_BEARISH_KW if kw in texto)
    if bull > bear:
        return "bullish"
    elif bear > bull:
        return "bearish"
    return "neutral"

def obtener_noticias_ticker(ticker_yf, max_news=10, top_n=5):
    """
    Obtiene noticias del ticker via yfinance, las puntúa por relevancia
    financiera y retorna solo el top_n más relevantes como dicts con
    title, url, source, date y sentiment.
    """
    candidatas = []
    try:
        t   = yf.Ticker(ticker_yf)
        raw = t.news or []
        for n in raw[:max_news]:
            content = n.get('content', {})
            titulo  = content.get('title', '')
            resumen = content.get('summary', '')[:200]
            fecha   = content.get('pubDate', '')[:10]
            fuente  = content.get('provider', {}).get('displayName', '')
            # Intentar obtener URL desde múltiples ubicaciones posibles
            url_art = (
                content.get('canonicalUrl', {}).get('url', '') or
                content.get('clickThroughUrl', {}).get('url', '') or
                n.get('link', '') or
                ''
            )
            if not titulo:
                continue
            score = puntuar_noticia(titulo, resumen, fuente)
            sentimiento = detectar_sentimiento_noticia(titulo, resumen)
            candidatas.append((score, fecha, fuente, titulo, resumen, url_art, sentimiento))

        candidatas.sort(key=lambda x: x[0], reverse=True)

        noticias = []
        for score, fecha, fuente, titulo, resumen, url_art, sentimiento in candidatas[:top_n]:
            noticias.append({
                "title":     titulo,
                "url":       url_art,
                "source":    fuente,
                "date":      fecha,
                "sentiment": sentimiento,
            })
        return noticias
    except:
        return []


def obtener_noticias_macro(max_news=6, top_n=4):
    """
    Obtiene noticias macro del RSS de MarketWatch, las puntúa
    y retorna solo las top_n más relevantes como dicts con title, url y sentiment.
    """
    candidatas = []
    try:
        import html as html_mod
        feed_url = 'https://feeds.marketwatch.com/marketwatch/topstories/'
        req = urllib.request.Request(feed_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=8) as r:
            content = r.read().decode('utf-8', errors='ignore')

        items = re.findall(r'<item>(.*?)</item>', content, re.DOTALL)
        for item in items[:max_news]:
            titulo_m  = re.search(r'<title><!\[CDATA\[(.*?)\]\]></title>|<title>(.*?)</title>', item)
            desc_m    = re.search(r'<description><!\[CDATA\[(.*?)\]\]></description>', item, re.DOTALL)
            link_m    = re.search(r'<link>(.*?)</link>|<link\s+href=["\']([^"\']+)["\']', item, re.DOTALL)
            titulo    = html_mod.unescape((titulo_m.group(1) or titulo_m.group(2) or '').strip()) if titulo_m else ''
            descripcion = html_mod.unescape(desc_m.group(1)[:200]).strip() if desc_m else ''
            descripcion = re.sub(r'<[^>]+>', '', descripcion)
            url_art   = (link_m.group(1) or link_m.group(2) or '').strip() if link_m else ''
            if titulo and len(titulo) > 10:
                score = puntuar_noticia(titulo, descripcion, "MarketWatch")
                sentimiento = detectar_sentimiento_noticia(titulo, descripcion)
                candidatas.append((score, titulo, url_art, sentimiento))

        candidatas.sort(key=lambda x: x[0], reverse=True)
        return [
            {"title": t, "url": u, "source": "MarketWatch", "sentiment": s}
            for _, t, u, s in candidatas[:top_n]
        ]
    except:
        return []

# ============================================================
# PRECIOS + TECNICO (yfinance)
# ============================================================

def obtener_precios_yfinance(ticker_yf):
    datos = {}
    try:
        t  = yf.Ticker(ticker_yf)
        h  = t.history(period="2y")  # 2 años para SMA 200 más estable
        if h.empty:
            return datos
        close = h['Close']
        vol   = h['Volume']

        precio_actual = float(close.iloc[-1])
        datos['precio_actual']  = round(precio_actual, 4)
        datos['cambio_24h']     = pct(close.iloc[-1], close.iloc[-2])  if len(close) > 1  else 0
        datos['cambio_7d']      = pct(close.iloc[-1], close.iloc[-8])  if len(close) > 7  else 0  # iloc[-1]=hoy, [-8]=7 días atrás
        datos['cambio_30d']     = pct(close.iloc[-1], close.iloc[-22]) if len(close) > 21 else 0
        datos['high_52w']       = round(float(close.tail(252).max()), 4)
        datos['low_52w']        = round(float(close.tail(252).min()), 4)
        datos['vol_hoy']        = int(vol.iloc[-1])
        datos['vol_20d_avg']    = int(vol.tail(20).mean())
        datos['vol_relativo']   = round(datos['vol_hoy'] / datos['vol_20d_avg'], 2) if datos['vol_20d_avg'] > 0 else 1.0

        # YTD
        anio_actual   = datetime.now().year
        close_ytd     = close[close.index.year == anio_actual]
        precio_inicio = float(close_ytd.iloc[0]) if not close_ytd.empty else float(close.iloc[-252])
        datos['cambio_ytd'] = pct(precio_actual, precio_inicio)

        # SMAs
        datos['sma_20']  = round(float(close.tail(20).mean()), 4)
        datos['sma_50']  = round(float(close.tail(50).mean()), 4)
        datos['sma_200'] = round(float(close.tail(200).mean()), 4) if len(close) >= 200 else 0
        datos['soporte']     = round(float(close.tail(60).min()), 4)
        datos['resistencia'] = round(float(close.tail(60).max()), 4)

        # Tendencia SMA
        s50, s200 = datos['sma_50'], datos['sma_200']
        if precio_actual > s50 > s200 > 0:   datos['tendencia_sma'] = "ALCISTA"
        elif precio_actual < s50 < s200:      datos['tendencia_sma'] = "BAJISTA"
        else:                                 datos['tendencia_sma'] = "MIXTA"

        # RSI (14 periodos)
        delta = close.diff()
        gain  = delta.clip(lower=0).rolling(14).mean()
        loss  = (-delta.clip(upper=0)).rolling(14).mean()
        rs    = gain / loss.replace(0, float('nan'))
        rsi_s = 100 - (100 / (1 + rs))
        datos['rsi'] = round(float(rsi_s.iloc[-1]), 2) if not rsi_s.empty else 50.0

        # MACD (12, 26, 9)
        ema12 = close.ewm(span=12, adjust=False).mean()
        ema26 = close.ewm(span=26, adjust=False).mean()
        macd_line   = ema12 - ema26
        signal_line = macd_line.ewm(span=9, adjust=False).mean()
        datos['macd_line']    = round(float(macd_line.iloc[-1]), 4)
        datos['macd_signal']  = round(float(signal_line.iloc[-1]), 4)
        datos['macd_bullish'] = bool(datos['macd_line'] > datos['macd_signal'])

    except Exception as e:
        datos['_error_precio'] = str(e)
    return datos

# Mapeo sector key -> ETF del sector (S&P SPDR)
SECTOR_ETF = {
    'technology':             'XLK',
    'financial-services':     'XLF',
    'healthcare':             'XLV',
    'consumer-cyclical':      'XLY',
    'consumer-defensive':     'XLP',
    'energy':                 'XLE',
    'industrials':            'XLI',
    'utilities':              'XLU',
    'real-estate':            'XLRE',
    'basic-materials':        'XLB',
    'communication-services': 'XLC',
}

def safe_get(info, campo, tipo=None, default=None):
    """
    Extrae un campo de yfinance .info con validación estricta.
    Regla de oro: si el dato no existe o es inválido, retorna default (None).
    NUNCA retorna un valor inventado o por defecto engañoso.
    """
    val = info.get(campo)
    if val is None:
        return default
    if tipo == 'positive_float':
        try:
            v = float(val)
            return v if v > 0 else default
        except:
            return default
    if tipo == 'float':
        try:
            return float(val)
        except:
            return default
    if tipo == 'int':
        try:
            return int(val)
        except:
            return default
    if tipo == 'str':
        v = str(val).strip()
        return v if v and v.lower() not in ('none', 'n/a', '') else default
    if tipo == 'timestamp':
        try:
            v = int(val)
            if v > 0:
                return datetime.fromtimestamp(v).strftime('%Y-%m-%d')
            return default
        except:
            return default
    return val


def obtener_info_yfinance(ticker_yf, es_cripto):
    """
    Extrae metadata de yfinance .info con validación estricta.
    Cada campo usa safe_get — si no existe o es inválido, queda en None.
    """
    info_extra = {}
    try:
        t    = yf.Ticker(ticker_yf)
        info = t.info

        if not es_cripto:
            info_extra['market_cap']      = safe_get(info, 'marketCap',               'positive_float')
            info_extra['sector']          = safe_get(info, 'sector',                  'str')
            info_extra['sector_key']      = safe_get(info, 'sectorKey',               'str')
            info_extra['industria']       = safe_get(info, 'industry',                'str')
            info_extra['analyst_target']  = safe_get(info, 'targetMeanPrice',         'positive_float')
            info_extra['analyst_low']     = safe_get(info, 'targetLowPrice',          'positive_float')
            info_extra['analyst_high']    = safe_get(info, 'targetHighPrice',         'positive_float')
            info_extra['analyst_rec']     = safe_get(info, 'recommendationKey',       'str')
            if info_extra['analyst_rec']:
                info_extra['analyst_rec'] = info_extra['analyst_rec'].upper()
            info_extra['analyst_count']   = safe_get(info, 'numberOfAnalystOpinions', 'int')
            info_extra['revenue_growth']  = safe_get(info, 'revenueGrowth',           'float')
            info_extra['earnings_growth'] = safe_get(info, 'earningsGrowth',          'float')
            info_extra['ev']              = safe_get(info, 'enterpriseValue',         'positive_float')
            info_extra['ev_ebitda']       = safe_get(info, 'enterpriseToEbitda',      'positive_float')
            info_extra['beta']            = safe_get(info, 'beta',                    'float')
            info_extra['forward_eps']     = safe_get(info, 'forwardEps',              'float')
            info_extra['forward_pe']      = safe_get(info, 'forwardPE',               'positive_float')
            info_extra['short_ratio']     = safe_get(info, 'shortRatio',              'float')
        else:
            info_extra['market_cap']  = safe_get(info, 'marketCap',         'positive_float')
            info_extra['circulating'] = safe_get(info, 'circulatingSupply', 'positive_float')
    except Exception as e:
        info_extra['_error_info'] = str(e)
    return info_extra


def obtener_eventos_calendario(ticker_yf, info, es_cripto):
    """
    Extrae eventos futuros concretos desde yfinance.calendar y .info.
    Regla de oro: solo se reporta lo que yfinance confirma explícitamente.
    Si un campo no existe o no es una fecha válida → None, no se muestra.
    """
    if es_cripto:
        return {}

    eventos = {}
    try:
        t   = yf.Ticker(ticker_yf)
        cal = t.calendar  # dict con fechas reales

        # Earnings próximo
        earnings_dates = cal.get('Earnings Date', [])
        if earnings_dates:
            # Puede ser lista — tomamos el primero que sea futuro
            hoy = datetime.now().date()
            futuros = [d for d in earnings_dates if hasattr(d, 'year') and d >= hoy]
            if futuros:
                eventos['earnings_fecha']   = str(futuros[0])
                eventos['earnings_eps_est'] = cal.get('Earnings Average')   # EPS estimado
                eventos['earnings_eps_low'] = cal.get('Earnings Low')
                eventos['earnings_eps_high']= cal.get('Earnings High')
                eventos['earnings_rev_est'] = cal.get('Revenue Average')
                # Validar que sean números reales
                for k in ['earnings_eps_est', 'earnings_eps_low', 'earnings_eps_high', 'earnings_rev_est']:
                    try:
                        if eventos.get(k) is not None:
                            eventos[k] = round(float(eventos[k]), 4)
                    except:
                        eventos[k] = None

        # Dividendo
        ex_div = cal.get('Ex-Dividend Date')
        div_pay = cal.get('Dividend Date')
        if ex_div and hasattr(ex_div, 'year'):
            eventos['ex_dividendo'] = str(ex_div)
        if div_pay and hasattr(div_pay, 'year'):
            eventos['pago_dividendo'] = str(div_pay)

    except Exception as e:
        eventos['_error_calendario'] = str(e)

    # Forward P/E y EPS estimado (complemento del calendario)
    try:
        fwd_eps = safe_get(info, 'forwardEps', 'float')
        fwd_pe  = safe_get(info, 'forwardPE',  'positive_float')
        if fwd_eps is not None: eventos['forward_eps'] = fwd_eps
        if fwd_pe  is not None: eventos['forward_pe']  = round(fwd_pe, 2)
    except:
        pass

    return eventos


def obtener_contexto_sectorial(ticker_yf, info_extra, es_cripto):
    """
    Compara el rendimiento YTD del ticker vs su ETF de sector.
    Regla de oro: si no existe mapeo de ETF o falla la descarga, retorna {}
    en vez de datos inventados o aproximados.
    """
    if es_cripto:
        return {}

    sector_key = info_extra.get('sector_key')
    if not sector_key:
        return {}

    etf_ticker = SECTOR_ETF.get(sector_key)
    if not etf_ticker:
        return {}  # Sector sin ETF mapeado — no inventamos

    try:
        etf = yf.Ticker(etf_ticker)
        h   = etf.history(period="1y")
        if h.empty or len(h) < 5:
            return {}

        close = h['Close']
        anio  = datetime.now().year
        ytd_  = close[close.index.year == anio]

        if ytd_.empty:
            return {}

        precio_etf = round(float(close.iloc[-1]), 2)
        ytd_etf    = round((float(close.iloc[-1]) - float(ytd_.iloc[0])) / abs(float(ytd_.iloc[0])) * 100, 2)

        return {
            'etf_ticker':  etf_ticker,
            'etf_precio':  precio_etf,
            'etf_ytd':     ytd_etf,
            'sector_nombre': info_extra.get('sector', sector_key),
        }
    except:
        return {}  # Falla silenciosa — mejor N/A que dato inventado

# ============================================================
# FAIR VALUE CONTEXTUALIZADO POR TIPO DE EMPRESA
# ============================================================

def calcular_fair_value(r, info_extra, precio_actual):
    """
    Fair Value adaptado al perfil de crecimiento de la empresa.
    Evita dar valores absurdos para growth stocks como MSFT/NVDA.
    """
    pe = r.get('pe', 0)
    rev_growth = info_extra.get('revenue_growth', 0) * 100  # a porcentaje

    # Determinar tipo de empresa por crecimiento de revenue
    if rev_growth > 30:
        tipo = "high_growth"
        pe_benchmark = PE_BENCHMARK["high_growth"]
        nota = "P/E benchmark x50 (hipercrecimiento)"
    elif rev_growth > 15:
        tipo = "growth"
        pe_benchmark = PE_BENCHMARK["growth"]
        nota = "P/E benchmark x35 (growth)"
    elif rev_growth > 5:
        tipo = "blend"
        pe_benchmark = PE_BENCHMARK["blend"]
        nota = "P/E benchmark x25 (blend)"
    else:
        tipo = "value"
        pe_benchmark = PE_BENCHMARK["value"]
        nota = "P/E benchmark x20 (valor/dividendo)"

    fair_value_pe = (pe_benchmark / pe) * precio_actual if pe > 0 else 0

    # EV/EBITDA como segunda opinion (si disponible)
    ev_ebitda    = info_extra.get('ev_ebitda', 0)
    fair_ev      = 0
    ev_ebitda_bench = {"value": 10, "blend": 15, "growth": 20, "high_growth": 30}
    if ev_ebitda > 0:
        fv_ratio  = ev_ebitda_bench[tipo] / ev_ebitda
        fair_ev   = round(precio_actual * fv_ratio, 2)

    # Graham Number — solo para value stocks con EPS y BVPS positivos
    graham = 0.0

    return {
        "tipo_empresa":  tipo,
        "pe_benchmark":  pe_benchmark,
        "fair_value_pe": round(fair_value_pe, 2),
        "fair_ev":       fair_ev,
        "nota":          nota,
        "graham":        graham,
    }

# ============================================================
# DCF — VALORACION POR FLUJO DE CAJA DESCONTADO
# ============================================================

def calcular_dcf(r, info_extra, precios):
    """
    Valuation por flujos descontados.
    - Empresas con yield > 2%: DDM (Dividend Discount Model) — más apropiado para dividend stocks.
    - El resto: FCF-DCF de 10 años + valor terminal.
    WACC ajustado por beta. Retorna {} si faltan datos.
    """
    try:
        fcf_yield = r.get('fcf_yield', 0)
        div_yield = r.get('yield', 0)
        precio    = precios.get('precio_actual', 0)
        beta      = info_extra.get('beta') or 1.0
        rev_g     = info_extra.get('revenue_growth') or 0.03
        earn_g    = info_extra.get('earnings_growth') or rev_g

        if precio <= 0:
            return {}

        risk_free  = 0.042
        eq_premium = 0.05
        wacc       = max(0.07, min(risk_free + beta * eq_premium, 0.15))
        terminal_g = 0.03

        # ---- DDM para empresas con dividendo relevante ----
        if div_yield >= 0.02 and precio > 0:
            div_anual = precio * div_yield
            div_g = max(min(earn_g, 0.07), 0.01)
            ke    = wacc
            # Sensibilidad: calcular DDM con spread mínimo 2% para evitar explosión
            def _ddm(d, g, k):
                return round(d * (1 + g) / max(k - g, 0.02), 2)
            if ke > div_g:
                ddm_base = _ddm(div_anual, div_g, ke)
                # Rango de sensibilidad: ke ±1% (cambio de tasas)
                ddm_bear = _ddm(div_anual, div_g, ke + 0.01)
                ddm_bull = _ddm(div_anual, div_g, max(ke - 0.01, div_g + 0.02))
                return {
                    "metodo":      "DDM (Dividend Discount Model)",
                    "base":         ddm_base,
                    "bear":         ddm_bear,
                    "bull":         ddm_bull,
                    "base_upside":  round((ddm_base - precio) / precio * 100, 1),
                    "bear_upside":  round((ddm_bear - precio) / precio * 100, 1),
                    "bull_upside":  round((ddm_bull - precio) / precio * 100, 1),
                    "wacc":         round(ke * 100, 1),
                    "div_g":        round(div_g * 100, 1),
                    "div_anual":    round(div_anual, 2),
                    "sensibilidad": "Bear=tasas +1% | Bull=tasas -1%",
                }

        # ---- FCF-DCF para acciones growth/blend ----
        if fcf_yield <= 0.001:
            return {}

        fcf_ps = precio * fcf_yield

        scenarios = {
            "bear": max(rev_g * 0.40, 0.0),
            "base": max(min(rev_g * 0.70, 0.20), 0.02),
            "bull": max(min(rev_g, 0.25), 0.04),
        }

        dcf_values = {"metodo": "FCF-DCF (Flujo de Caja Descontado)"}
        for name, g in scenarios.items():
            pv = 0.0
            fcf_t = fcf_ps
            for t in range(1, 11):
                fcf_t *= (1 + g)
                pv += fcf_t / (1 + wacc) ** t
            tv    = fcf_t * (1 + terminal_g) / (wacc - terminal_g)
            pv_tv = tv / (1 + wacc) ** 10
            dcf_values[name] = round(pv + pv_tv, 2)

        for k in ("bear", "base", "bull"):
            dcf_values[f"{k}_upside"] = round((dcf_values[k] - precio) / precio * 100, 1)

        dcf_values['wacc']      = round(wacc * 100, 1)
        dcf_values['terminal_g']= round(terminal_g * 100, 1)
        dcf_values['fcf_ps']    = round(fcf_ps, 2)
        return dcf_values
    except Exception as e:
        return {"_error_dcf": str(e)}


# ============================================================
# ESCENARIOS DE PRECIO (BULL / BASE / BEAR)
# ============================================================

def calcular_escenarios(r, info_extra, precios, eventos, fv):
    """
    Objetivos de precio a 12m usando consenso analistas (primero) o Fair Value (fallback).
    Bear = analyst_low | Base = analyst_target | Bull = analyst_high
    """
    try:
        precio    = precios.get('precio_actual', 0)
        al_target = info_extra.get('analyst_target', 0) or 0
        al_low    = info_extra.get('analyst_low', 0) or 0
        al_high   = info_extra.get('analyst_high', 0) or 0
        fvpe      = fv.get('fair_value_pe', 0)
        soporte   = precios.get('soporte', 0)
        resist    = precios.get('resistencia', 0)

        if precio <= 0:
            return {}

        esc = {}

        # BASE
        if al_target > 0:
            esc['base'], esc['base_fuente'] = round(al_target, 2), "Consenso analistas (target medio)"
        elif fvpe > 0:
            esc['base'], esc['base_fuente'] = fvpe, "Fair Value P/E"

        # BEAR
        if al_low > 0:
            esc['bear'], esc['bear_fuente'] = round(al_low, 2), "Target mínimo analistas"
        elif soporte > 0:
            esc['bear'], esc['bear_fuente'] = round(soporte, 2), "Soporte técnico 60d"

        # BULL
        if al_high > 0:
            esc['bull'], esc['bull_fuente'] = round(al_high, 2), "Target máximo analistas"
        elif resist > 0:
            esc['bull'], esc['bull_fuente'] = round(resist * 1.05, 2), "Resistencia técnica +5%"

        for k in ('bear', 'base', 'bull'):
            if esc.get(k, 0) > 0:
                esc[f"{k}_upside"] = round((esc[k] - precio) / precio * 100, 1)

        return esc
    except Exception as e:
        return {"_error_escenarios": str(e)}


# ============================================================
# MOAT SCORE (FOSO COMPETITIVO)
# ============================================================

def calcular_moat(r, info_extra, t_margin, t_roe, sector_ctx, precios):
    """
    Cuantifica la ventaja competitiva (0–5) usando datos duros del script.
    Cada criterio tiene un umbral objetivo y una descripción clara.
    """
    score_moat = 0
    factores   = []

    # 1. Pricing power — margen bruto > 40%
    gross = r.get('gross', 0)
    if gross > 0.40:
        score_moat += 1
        factores.append(f"[+] Margen bruto {gross:.0%} > 40% — pricing power")
    elif gross > 0:
        factores.append(f"[-] Margen bruto {gross:.0%} — sin ventaja clara de precio")

    # 2. Retorno eficiente del capital — ROE > 20%
    roe = r.get('roe', 0)
    if roe > 0.20:
        score_moat += 1
        factores.append(f"[+] ROE {roe:.0%} > 20% — eficiencia de capital superior")
    elif roe > 0.10:
        factores.append(f"[~] ROE {roe:.0%} — adecuado pero no diferenciador")
    else:
        factores.append(f"[-] ROE bajo ({roe:.0%})")

    # 3. Solidez financiera — cobertura > 5x
    int_cov = r.get('int_cov', 0)
    if int_cov > 5:
        score_moat += 1
        factores.append(f"[+] Cobertura intereses {int_cov:.1f}x — fortaleza de balance")
    elif int_cov > 2:
        factores.append(f"[~] Cobertura intereses {int_cov:.1f}x — adecuada")
    elif int_cov > 0:
        factores.append(f"[-] Cobertura intereses {int_cov:.1f}x — riesgo financiero")

    # 4. Márgenes en expansión
    if "MEJORANDO" in t_margin:
        score_moat += 1
        factores.append(f"[+] Margen neto en tendencia CRECIENTE — ventaja creciente")
    elif "DETERIORANDO" in t_margin:
        factores.append(f"[-] Margen neto DETERIORANDO — presión competitiva")
    else:
        factores.append(f"[~] Margen neto estable")

    # 5. Supera al sector (ejecución)
    acc_ytd = precios.get('cambio_ytd', None)
    etf_ytd = sector_ctx.get('etf_ytd', None)
    if acc_ytd is not None and etf_ytd is not None:
        diff = acc_ytd - etf_ytd
        if diff > 0:
            score_moat += 1
            factores.append(f"[+] Supera sector YTD en {diff:+.1f}% — ejecución superior")
        else:
            factores.append(f"[-] Retrasado vs sector YTD en {diff:+.1f}%")

    if score_moat >= 5:   nivel = "FOSO ANCHO"
    elif score_moat >= 3: nivel = "FOSO MODERADO"
    elif score_moat >= 1: nivel = "FOSO ESTRECHO"
    else:                 nivel = "SIN FOSO CLARO"

    return {"score": score_moat, "max": 5, "nivel": nivel, "factores": factores}


# ============================================================
# MAPA DE RIESGOS CUANTIFICADO
# ============================================================

def evaluar_riesgos(r, info_extra, precios, fv):
    """
    Lista estructurada de riesgos derivados de datos duros del script.
    Cada riesgo: tipo, nivel (HIGH/MEDIUM/LOW), descripción con valores concretos.
    """
    riesgos = []

    # 1. Riesgo de valoración
    precio = precios.get('precio_actual', 0)
    fvpe   = fv.get('fair_value_pe', 0)
    if fvpe > 0 and precio > 0:
        premium = (precio - fvpe) / fvpe * 100
        if premium > 30:
            riesgos.append({"tipo": "VALORACION", "nivel": "HIGH",
                "desc": f"Precio {premium:+.0f}% sobre Fair Value P/E (${fvpe:,.0f}) — riesgo de corrección"})
        elif premium > 10:
            riesgos.append({"tipo": "VALORACION", "nivel": "MEDIUM",
                "desc": f"Precio {premium:+.0f}% sobre Fair Value P/E — premium elevado, exige ejecución perfecta"})
        elif premium < -15:
            riesgos.append({"tipo": "VALORACION", "nivel": "LOW",
                "desc": f"Precio {abs(premium):.0f}% bajo Fair Value — descuento ofrece margen de seguridad"})

    # 2. Riesgo financiero (deuda)
    de      = r.get('de', 0)
    int_cov = r.get('int_cov', 0)
    if de > 3.0:
        riesgos.append({"tipo": "FINANCIERO", "nivel": "HIGH",
            "desc": f"Deuda/Equity {de:.1f}x muy elevada — sensible a suba de tasas"})
    elif de > 1.5:
        riesgos.append({"tipo": "FINANCIERO", "nivel": "MEDIUM",
            "desc": f"Deuda/Equity {de:.1f}x moderada — monitorear refinanciamiento"})
    if 0 < int_cov < 2.5:
        riesgos.append({"tipo": "LIQUIDEZ", "nivel": "HIGH",
            "desc": f"Cobertura de intereses {int_cov:.1f}x — margen estrecho ante estrés de flujo"})

    # 3. Riesgo de mercado (beta)
    beta = info_extra.get('beta')
    if beta is not None:
        if beta > 1.8:
            riesgos.append({"tipo": "MERCADO", "nivel": "HIGH",
                "desc": f"Beta {beta:.2f} — amplifica caídas del mercado significativamente"})
        elif beta > 1.3:
            riesgos.append({"tipo": "MERCADO", "nivel": "MEDIUM",
                "desc": f"Beta {beta:.2f} — más volátil que el S&P 500"})

    # 4. Riesgo de dividendo (solo si paga dividendo)
    if r.get('yield', 0) > 0:
        payout = r.get('payout', 0)
        fcf_y  = r.get('fcf_yield', 0)
        if payout > 0.80:
            riesgos.append({"tipo": "DIVIDENDO", "nivel": "HIGH",
                "desc": f"Payout {payout:.0%} — dividendo consume casi todo el flujo libre"})
        elif payout > 0.60 and fcf_y < 0.03:
            riesgos.append({"tipo": "DIVIDENDO", "nivel": "MEDIUM",
                "desc": f"Payout {payout:.0%} con FCF Yield bajo ({fcf_y:.1%}) — dividendo bajo presión"})

    # 5. Riesgo técnico
    rsi_v = precios.get('rsi', 50)
    if rsi_v > 70:
        riesgos.append({"tipo": "TECNICO", "nivel": "MEDIUM",
            "desc": f"RSI {rsi_v:.0f} — sobrecompra técnica, posible consolidación o pullback"})
    if precios.get('tendencia_sma') == "BAJISTA":
        riesgos.append({"tipo": "TECNICO", "nivel": "MEDIUM",
            "desc": "Precio bajo SMA 50 y SMA 200 — tendencia bajista activa, momentum negativo"})

    # 6. Riesgo de crecimiento
    earn_g = info_extra.get('earnings_growth')
    if earn_g is not None and earn_g < -0.10:
        riesgos.append({"tipo": "CRECIMIENTO", "nivel": "HIGH",
            "desc": f"Earnings YoY {earn_g*100:+.0f}% — contracción de ganancias, cuestionable valoración actual"})
    elif earn_g is not None and earn_g < 0:
        riesgos.append({"tipo": "CRECIMIENTO", "nivel": "MEDIUM",
            "desc": f"Earnings YoY {earn_g*100:+.0f}% — ganancias en retroceso leve"})

    return riesgos


# ============================================================
# GUARDAR HISTORICO JSON
# ============================================================

def guardar_historico(ticker, datos_completos):
    base = os.path.dirname(__file__)

    # 1. Guardar en output/history/
    try:
        historia_dir = os.path.join(base, "output", "history")
        os.makedirs(historia_dir, exist_ok=True)
        fecha    = datetime.now().strftime("%Y-%m-%d")
        filename = os.path.join(historia_dir, f"analisis_{fecha}_{ticker}.json")
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(_sanitize(datos_completos), f, indent=2, ensure_ascii=False)
        print(f"  Guardado en: output/history/analisis_{fecha}_{ticker}.json", file=sys.stderr)

        # Limpiar archivos viejos del mismo ticker (mantener los últimos 30)
        archivos = sorted([
            f for f in os.listdir(historia_dir)
            if f.startswith("analisis_") and f.endswith(f"_{ticker}.json")
        ])
        for viejo in archivos[:-30]:
            os.remove(os.path.join(historia_dir, viejo))
    except Exception as e:
        print(f"  [Historial] No se pudo guardar: {e}", file=sys.stderr)

    # 2. Guardar en dashboard/public/data/ticker/ para el dashboard Next.js
    try:
        ticker_dir = os.path.join(base, "dashboard", "public", "data", "ticker")
        os.makedirs(ticker_dir, exist_ok=True)
        dashboard_file = os.path.join(ticker_dir, f"{ticker.upper()}.json")
        with open(dashboard_file, "w", encoding="utf-8") as f:
            json.dump(_sanitize(datos_completos), f, indent=2, ensure_ascii=False)
        print(f"  Dashboard: dashboard/public/data/ticker/{ticker.upper()}.json", file=sys.stderr)
    except Exception as e:
        print(f"  [Dashboard] No se pudo guardar: {e}", file=sys.stderr)

# ============================================================
# ANALIZAR UN SOLO TICKER
# ============================================================

def analizar(ticker_input):
    ticker_yf, es_cripto = normalize_ticker(ticker_input)
    ticker_ft = ticker_input.replace("-USD", "")

    print(f"\n{'='*60}")
    print(f"  INFORME EXPERTO: {ticker_input}")
    if es_cripto:
        print(f"  Tipo: CRIPTO / DIGITAL ASSET")
    print(f"  Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"{'='*60}\n")

    print("Obteniendo datos...", file=sys.stderr)

    noticias_ticker = obtener_noticias_ticker(ticker_yf)
    noticias_macro  = obtener_noticias_macro()
    precios         = obtener_precios_yfinance(ticker_yf)
    info_extra      = obtener_info_yfinance(ticker_yf, es_cripto)
    sentimiento     = calcular_sentimiento_mercado(precios, info_extra, {}, es_cripto)
    eventos         = obtener_eventos_calendario(ticker_yf, info_extra, es_cripto)
    sector_ctx      = obtener_contexto_sectorial(ticker_yf, info_extra, es_cripto)

    # Datos externos para cripto (APIs públicas sin key)
    if es_cripto and not sentimiento.get('_error'):
        print("Obteniendo Fear & Greed y datos sociales...", file=sys.stderr)
        fg = fetch_fear_greed()
        if not fg.get('_error'):
            sentimiento['fear_greed'] = fg
        social = fetch_crypto_social(ticker_yf)
        if not social.get('_error'):
            sentimiento['social_cripto'] = social

    r = {}
    t_margin = t_roe = t_eps = "N/A"
    fv = {}
    dcf = {}
    escenarios = {}
    moat = {}
    riesgos_list = []
    div_sostenible = "N/A"
    score = 0
    veredicto = "VER NOTICIAS Y TECNICO"

    # ---- FUNDAMENTALES (solo acciones) ----
    if not es_cripto:
        try:
            print("Calculando fundamentales (FinanceToolkit)...", file=sys.stderr)
            compania = Toolkit([ticker_ft], api_key=API_KEY, start_date="2020-01-01")

            precios_df   = compania.get_historical_data()
            div_yield    = compania.ratios.get_dividend_yield()
            payout       = compania.ratios.get_dividend_payout_ratio()
            pe_ratio     = compania.ratios.get_price_to_earnings_ratio()
            pb_ratio     = compania.ratios.get_price_to_book_ratio()
            pfcf         = compania.ratios.get_price_to_free_cash_flow_ratio()
            fcf_yield    = compania.ratios.get_free_cash_flow_yield()
            net_margin   = compania.ratios.get_net_profit_margin()
            gross_margin = compania.ratios.get_gross_margin()
            roe          = compania.ratios.get_return_on_equity()
            debt_equity  = compania.ratios.get_debt_to_equity_ratio()
            interest_cov = compania.ratios.get_interest_coverage_ratio()
            eps_ratio    = compania.ratios.get_earnings_per_share()

            # Dividend yield TTM real
            try:
                divs_hist     = precios_df[("Dividends", ticker_ft)].tail(252)
                div_ttm       = float(divs_hist.sum())
                div_yield_ttm = div_ttm / precios.get('precio_actual', 1) if precios.get('precio_actual', 0) > 0 else 0.0
            except:
                div_yield_ttm = safe(div_yield)

            r = {
                "yield":     div_yield_ttm,
                "payout":    safe(payout),
                "pe":        safe(pe_ratio),
                "pb":        safe(pb_ratio),
                "pfcf":      safe(pfcf),
                "fcf_yield": safe(fcf_yield),
                "margin":    safe(net_margin),
                "gross":     safe(gross_margin),
                "roe":       safe(roe),
                "de":        safe(debt_equity),
                "int_cov":   safe(interest_cov),
                "eps":       safe(eps_ratio),
            }

            t_margin = tendencia(safe_series(net_margin))
            t_roe    = tendencia(safe_series(roe))
            t_eps    = tendencia(safe_series(eps_ratio))

            # Graham Number solo para value/blend
            try:
                bvps     = compania.ratios.get_book_value_per_share()
                bvps_val = safe(bvps)
                graham   = (22.5 * abs(r["eps"]) * abs(bvps_val)) ** 0.5 if r["eps"] > 0 and bvps_val > 0 else 0
                r["graham"] = round(graham, 2)
            except:
                r["graham"] = 0.0

            div_sostenible = (
                "SOLIDO"   if r["payout"] < 0.70 and r["fcf_yield"] > 0.04 else
                "RIESGO"   if r["payout"] > 0.80 else "MODERADO"
            )

            fv           = calcular_fair_value(r, info_extra, precios.get('precio_actual', 0))
            dcf          = calcular_dcf(r, info_extra, precios)
            escenarios   = calcular_escenarios(r, info_extra, precios, eventos, fv)
            moat         = calcular_moat(r, info_extra, t_margin, t_roe, sector_ctx, precios)
            riesgos_list = evaluar_riesgos(r, info_extra, precios, fv)

            # SCORE (ajustado por tipo empresa)
            rsi_val = precios.get('rsi', 50)
            if rsi_val < 50:    score += 1
            if rsi_val < 35:    score += 1  # bonus sobreventa
            if r["fcf_yield"] > 0.03:  score += 1
            if r["roe"] > 0.15:        score += 1
            if r["de"] < 2.0:          score += 1
            if r["margin"] > 0.10:     score += 1
            precio_actual = precios.get('precio_actual', 0)
            if fv.get('fair_value_pe', 0) > 0 and precio_actual < fv['fair_value_pe']: score += 1

            if score >= 6:   veredicto = "COMPRA FUERTE"
            elif score >= 4: veredicto = "COMPRA"
            elif score >= 2: veredicto = "MANTENER / ESPERAR"
            else:            veredicto = "EVITAR"

        except Exception as e:
            print(f"[FinanceToolkit] {e}", file=sys.stderr)

    # ---- SCORE CRIPTO (solo tecnico) ----
    if es_cripto and precios:
        rsi_val = precios.get('rsi', 50)
        if rsi_val < 35:    score += 2
        elif rsi_val < 50:  score += 1
        elif rsi_val > 70:  score -= 1
        if precios.get('tendencia_sma') == "ALCISTA":   score += 2
        elif precios.get('tendencia_sma') == "BAJISTA":  score -= 1
        if precios.get('macd_bullish'):                  score += 1
        c30 = precios.get('cambio_30d', 0)
        if c30 > 20:    score += 2
        elif c30 > 5:   score += 1
        elif c30 < -20: score -= 1
        score = max(0, min(score, 7))
        if score >= 5:   veredicto = "MOMENTUM FUERTE"
        elif score >= 3: veredicto = "NEUTRAL / VIGILAR"
        else:            veredicto = "PRECAUCION"

    # ============================================================
    # IMPRIMIR REPORTE
    # ============================================================

    p   = precios
    inf = info_extra
    rsi_v = p.get('rsi', 0)

    if rsi_v < 30:   senal_rsi = "SOBREVENTA — Posible oportunidad"
    elif rsi_v > 70: senal_rsi = "SOBRECOMPRA — Precaucion"
    elif rsi_v < 45: senal_rsi = "Zona baja, neutral"
    elif rsi_v > 55: senal_rsi = "Zona alta, neutral"
    else:            senal_rsi = "NEUTRAL"

    macd_cruz = "ALCISTA (MACD > Signal)" if p.get('macd_bullish') else "BAJISTA (MACD < Signal)"

    print(f"VEREDICTO: {veredicto}  (Score {score}/7)")
    if not es_cripto and inf.get('sector'):
        print(f"Sector: {inf.get('sector')} | {inf.get('industria')}")
    if inf.get('market_cap'):
        print(f"Market Cap: {fmt_large(inf['market_cap'])}")
    print()

    # PRECIO
    print(f"-- PRECIO --------------------------------------------")
    print(f"  Actual          :  ${p.get('precio_actual', 0):,.4f}")
    print(f"  Cambio 24h      :  {p.get('cambio_24h', 0):+.2f}%")
    print(f"  Cambio 7d       :  {p.get('cambio_7d', 0):+.2f}%")
    print(f"  Cambio 30d      :  {p.get('cambio_30d', 0):+.2f}%")
    print(f"  Cambio YTD      :  {p.get('cambio_ytd', 0):+.2f}%")
    print(f"  Max 52 sem      :  ${p.get('high_52w', 0):,.4f}")
    print(f"  Min 52 sem      :  ${p.get('low_52w', 0):,.4f}")
    vol_rel = p.get('vol_relativo', 1.0)
    vol_nota = " *** VOLUMEN ANORMAL" if vol_rel > 2.0 else (" (alto)" if vol_rel > 1.5 else ("(bajo)" if vol_rel < 0.5 else ""))
    print(f"  Volumen hoy     :  {p.get('vol_hoy', 0):,.0f}  ({vol_rel:.1f}x promedio){vol_nota}")

    # TECNICO
    print(f"\n-- TECNICO -------------------------------------------")
    print(f"  RSI (14d)       :  {rsi_v:.1f}  -> {senal_rsi}")
    print(f"  MACD            :  {macd_cruz}")
    print(f"  Tendencia SMA   :  {p.get('tendencia_sma', 'N/D')}")
    if p.get('sma_20'):  print(f"  SMA 20          :  ${p['sma_20']:,.4f}")
    if p.get('sma_50'):  print(f"  SMA 50          :  ${p['sma_50']:,.4f}")
    if p.get('sma_200'): print(f"  SMA 200         :  ${p['sma_200']:,.4f}")
    print(f"  Soporte (60d)   :  ${p.get('soporte', 0):,.4f}")
    print(f"  Resistencia     :  ${p.get('resistencia', 0):,.4f}")

    # FUNDAMENTALES (solo acciones)
    if not es_cripto and r:
        # Zona de compra contextualizada
        print(f"\n-- ZONA DE COMPRA ({fv.get('tipo_empresa','').upper()}) -------------------------")
        fvpe = fv.get('fair_value_pe', 0)
        fvev = fv.get('fair_ev', 0)
        soporte = p.get('soporte', 0)
        zona_min = min(soporte, fvpe * 0.95) if fvpe > 0 else soporte * 0.97
        zona_max = soporte * 1.03
        if zona_min > 0:
            print(f"  Entrada ideal   :  ${zona_min:,.2f} -- ${zona_max:,.2f}")
        if fvpe > 0:
            print(f"  Fair Value P/E  :  ${fvpe:,.2f}  ({fv.get('nota','')})")
        if fvev > 0:
            print(f"  Fair Value EV   :  ${fvev:,.2f}  (EV/EBITDA benchmark)")
        if r.get('graham', 0) > 0 and fv.get('tipo_empresa') in ('value', 'blend'):
            print(f"  Graham Number   :  ${r['graham']:,.2f}  (valor intrinseco conservador)")

        # Analyst consensus
        if inf.get('analyst_target', 0) > 0:
            upside = pct(inf['analyst_target'], p.get('precio_actual', 1))
            print(f"\n-- CONSENSO ANALISTAS --------------------------------")
            print(f"  Target precio   :  ${inf['analyst_target']:,.2f}  ({upside:+.1f}% upside)")
            print(f"  Rango           :  ${inf.get('analyst_low',0):,.2f} — ${inf.get('analyst_high',0):,.2f}")
            print(f"  Recomendacion   :  {inf.get('analyst_rec','N/D')}  ({inf.get('analyst_count',0)} analistas)")

        print(f"\n-- VALORACION ----------------------------------------")
        print(f"  P/E Ratio       :  {nv(r.get('pe')):.1f}x  (benchmark sector: {fv.get('pe_benchmark',25)}x)")
        print(f"  P/B Ratio       :  {nv(r.get('pb')):.1f}x")
        print(f"  P/FCF           :  {nv(r.get('pfcf')):.1f}x")
        print(f"  EV/EBITDA       :  {nv(inf.get('ev_ebitda')):.1f}x")
        print(f"  FCF Yield       :  {nv(r.get('fcf_yield')):.2%}")
        if inf.get('beta') is not None:
            print(f"  Beta            :  {inf['beta']:.2f}  ({'alta volatilidad' if inf['beta'] > 1.5 else 'baja volatilidad' if inf['beta'] < 0.8 else 'volatilidad normal'})")

        print(f"\n-- CRECIMIENTO ---------------------------------------")
        rev_g = nv(inf.get('revenue_growth')) * 100
        earn_g = nv(inf.get('earnings_growth')) * 100
        print(f"  Revenue YoY     :  {rev_g:+.1f}%")
        print(f"  Earnings YoY    :  {earn_g:+.1f}%")
        print(f"  EPS             :  ${nv(r.get('eps')):.2f}   {t_eps}")

        print(f"\n-- CALIDAD DEL NEGOCIO -------------------------------")
        print(f"  Margen Bruto    :  {nv(r.get('gross')):.1%}   {t_margin}")
        print(f"  Margen Neto     :  {nv(r.get('margin')):.1%}")
        print(f"  ROE             :  {nv(r.get('roe')):.1%}   {t_roe}")

        print(f"\n-- SOLIDEZ FINANCIERA --------------------------------")
        print(f"  Deuda/Equity    :  {nv(r.get('de')):.2f}x")
        print(f"  Cobertura Int.  :  {nv(r.get('int_cov')):.1f}x")

        # FOSO COMPETITIVO (Moat)
        if moat:
            print(f"\n-- FOSO COMPETITIVO ({moat['score']}/{moat['max']}) — {moat['nivel']} --------")
            for f in moat.get('factores', []):
                print(f"  {f}")

        # ESCENARIOS DE PRECIO (Bull / Base / Bear)
        if escenarios and not escenarios.get('_error_escenarios'):
            print(f"\n-- ESCENARIOS 12 MESES ------------------------------")
            precio_actual_esc = p.get('precio_actual', 0)
            if escenarios.get('bear', 0) > 0:
                u = escenarios.get('bear_upside', 0)
                print(f"  Bear            :  ${escenarios['bear']:>8,.2f}  ({u:+.1f}%)  — {escenarios.get('bear_fuente','')}")
            if escenarios.get('base', 0) > 0:
                u = escenarios.get('base_upside', 0)
                print(f"  Base            :  ${escenarios['base']:>8,.2f}  ({u:+.1f}%)  — {escenarios.get('base_fuente','')}")
            if escenarios.get('bull', 0) > 0:
                u = escenarios.get('bull_upside', 0)
                print(f"  Bull            :  ${escenarios['bull']:>8,.2f}  ({u:+.1f}%)  — {escenarios.get('bull_fuente','')}")

        # VALUACION DCF / DDM
        if dcf and not dcf.get('_error_dcf'):
            metodo = dcf.get('metodo', 'DCF')
            wacc_d = dcf.get('wacc', 10)
            if 'div_g' in dcf:  # DDM
                print(f"\n-- VALUACION {metodo} (Ke {wacc_d:.1f}% | g dividendo {dcf['div_g']:.1f}%) --")
                print(f"  Dividendo anual :  ${dcf.get('div_anual', 0):,.2f}/accion")
            else:  # FCF-DCF
                print(f"\n-- VALUACION {metodo} (WACC {wacc_d:.1f}% | g terminal {dcf.get('terminal_g',3):.1f}%) --")
                print(f"  FCF/accion      :  ${dcf.get('fcf_ps', 0):,.2f}")
            if dcf.get('bear', 0) > 0:
                print(f"  Valor Bear      :  ${dcf['bear']:>8,.2f}  ({dcf.get('bear_upside',0):+.1f}%)")
            if dcf.get('base', 0) > 0:
                print(f"  Valor Base      :  ${dcf['base']:>8,.2f}  ({dcf.get('base_upside',0):+.1f}%)")
            if dcf.get('bull', 0) > 0:
                print(f"  Valor Bull      :  ${dcf['bull']:>8,.2f}  ({dcf.get('bull_upside',0):+.1f}%)")
            if dcf.get('sensibilidad'):
                print(f"  ({dcf['sensibilidad']})")
            elif 'div_g' not in dcf:
                print(f"  (Bear=40% crecim. | Base=70% | Bull=100% del crecimiento actual)")

        # MAPA DE RIESGOS
        if riesgos_list:
            nivel_orden = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
            riesgos_ordenados = sorted(riesgos_list, key=lambda x: nivel_orden.get(x['nivel'], 3))
            print(f"\n-- MAPA DE RIESGOS ----------------------------------")
            for rg in riesgos_ordenados:
                emoji = "!! " if rg['nivel'] == "HIGH" else "!  " if rg['nivel'] == "MEDIUM" else "   "
                print(f"  {emoji}[{rg['nivel']:<6}] {rg['tipo']:<12}: {rg['desc']}")

        if r.get('yield', 0) > 0:
            print(f"\n-- DIVIDENDOS ----------------------------------------")
            print(f"  Yield           :  {r.get('yield', 0):.2%}")
            print(f"  Payout Ratio    :  {r.get('payout', 0):.1%}")
            print(f"  Sostenibilidad  :  {div_sostenible}")

    # Cripto extra
    if es_cripto and inf.get('market_cap'):
        print(f"\n-- CRIPTO DATOS --------------------------------------")
        print(f"  Market Cap      :  {fmt_large(inf['market_cap'])}")
        if inf.get('circulating'):
            print(f"  Supply circ.    :  {inf['circulating']:,.0f}")

    # EVENTOS FUTUROS (calendario)
    if eventos and not eventos.get('_error_calendario'):
        print(f"\n-- EVENTOS PROXIMOS ----------------------------------")
        if eventos.get('earnings_fecha'):
            print(f"  Earnings        :  {eventos['earnings_fecha']}")
            if eventos.get('earnings_eps_est') is not None:
                low  = f"${eventos['earnings_eps_low']:.2f}" if eventos.get('earnings_eps_low') is not None else "N/A"
                high = f"${eventos['earnings_eps_high']:.2f}" if eventos.get('earnings_eps_high') is not None else "N/A"
                print(f"  EPS estimado    :  ${eventos['earnings_eps_est']:.2f}  (rango: {low} — {high})")
            if eventos.get('earnings_rev_est') is not None:
                print(f"  Revenue est.    :  {fmt_large(eventos['earnings_rev_est'])}")
        if eventos.get('ex_dividendo'):
            print(f"  Ex-Dividendo    :  {eventos['ex_dividendo']}")
        if eventos.get('pago_dividendo'):
            print(f"  Pago dividendo  :  {eventos['pago_dividendo']}")
        if eventos.get('forward_pe') is not None:
            fwd_label = ""
            if eventos.get('forward_eps') is not None and precios.get('precio_actual'):
                fwd_label = f"  (EPS fwd: ${eventos['forward_eps']:.2f})"
            print(f"  Forward P/E     :  {eventos['forward_pe']:.1f}x{fwd_label}")

    # CONTEXTO SECTORIAL (vs ETF del sector)
    if sector_ctx:
        acc_ytd = precios.get('cambio_ytd', None)
        etf_ytd = sector_ctx.get('etf_ytd')
        print(f"\n-- CONTEXTO SECTORIAL --------------------------------")
        print(f"  Sector          :  {sector_ctx.get('sector_nombre', 'N/D')}")
        print(f"  ETF sector      :  {sector_ctx.get('etf_ticker')}  @ ${sector_ctx.get('etf_precio'):,.2f}")
        if etf_ytd is not None:
            print(f"  ETF YTD         :  {etf_ytd:+.2f}%")
        if acc_ytd is not None and etf_ytd is not None:
            diff = round(acc_ytd - etf_ytd, 2)
            label = "SUPERA al sector" if diff > 0 else "POR DEBAJO del sector"
            print(f"  {ticker_input} vs sector  :  {diff:+.2f}%  ({label})")

    # SENTIMIENTO DE MERCADO
    if sentimiento and not sentimiento.get('_error'):
        print(f"\n-- SENTIMIENTO DE MERCADO ----------------------------")
        print(f"  Score           :  {sentimiento.get('score', 0)}/10  [{sentimiento.get('label', 'N/D')}]")
        print(f"  Fuente          :  {sentimiento.get('fuente', 'N/D')}")
        for s in sentimiento.get('señales', []):
            print(f"  {s.get('factor',''):20s}  {s.get('señal',''):12s}  {s.get('peso',''):4s}  {s.get('desc','')}")

    # NOTICIAS
    if noticias_ticker:
        print(f"\n-- NOTICIAS: {ticker_input} {'(CRIPTO)' if es_cripto else '(ACCION)'} -------------------------")
        for n in noticias_ticker:
            if isinstance(n, dict):
                sen = n.get('sentiment','?').upper()
                print(f"  [{sen}] [{n.get('date','')}] {n.get('source','')}: {n.get('title','')}  → {n.get('url','') or 'sin URL'}")
            else:
                print(f"  * {n}")

    if noticias_macro:
        print(f"\n-- NOTICIAS MACRO ------------------------------------")
        for n in noticias_macro:
            if isinstance(n, dict):
                sen = n.get('sentiment','?').upper()
                print(f"  [{sen}] {n.get('source','')}: {n.get('title','')}  → {n.get('url','') or 'sin URL'}")
            else:
                print(f"  * {n}")

    print(f"\n{'='*60}\n")

    # ---- GUARDAR HISTORICO JSON ----
    datos_json = {
        "ticker":       ticker_input,
        "fecha":        datetime.now().isoformat(),
        "es_cripto":    es_cripto,
        "veredicto":    veredicto,
        "score":        score,
        "precio":       precios,
        "info":         {k: v for k, v in info_extra.items()},
        "fundamentales": r if not es_cripto else {},
        "fair_value":   fv if not es_cripto else {},
        "dcf":          dcf if not es_cripto else {},
        "escenarios":   escenarios if not es_cripto else {},
        "moat":         moat if not es_cripto else {},
        "riesgos":      riesgos_list if not es_cripto else [],
        "eventos":         eventos,
        "sector_contexto": sector_ctx,
        "sentimiento":     sentimiento,
        "noticias_ticker": noticias_ticker,
        "noticias_macro":  noticias_macro,
    }
    guardar_historico(ticker_input, datos_json)

    return datos_json


# ============================================================
# ENTRY POINT — soporta múltiples tickers
# ============================================================

resultados = []
for ticker_input in tickers_input:
    resultado = analizar(ticker_input)
    resultados.append(resultado)

# Si se analizaron múltiples, mostrar tabla resumen
if len(resultados) > 1:
    print(f"\n{'='*60}")
    print(f"  RESUMEN COMPARATIVO")
    print(f"{'='*60}")
    print(f"  {'TICKER':<10} {'PRECIO':>10} {'YTD':>8} {'RSI':>6} {'SCORE':>7}  VEREDICTO")
    print(f"  {'-'*55}")
    for d in resultados:
        p   = d.get('precio', {})
        tkr = d['ticker']
        pre = f"${p.get('precio_actual',0):,.2f}"
        ytd = f"{p.get('cambio_ytd',0):+.1f}%"
        rsi = f"{p.get('rsi',0):.0f}"
        sc  = f"{d['score']}/7"
        ver = d['veredicto']
        print(f"  {tkr:<10} {pre:>10} {ytd:>8} {rsi:>6} {sc:>7}  {ver}")
    print(f"{'='*60}\n")
