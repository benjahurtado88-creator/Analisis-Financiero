"""
Actualiza precios en tiempo real en report.json y report-es.json
usando yfinance. Corre en ~30 segundos.
"""
import sys, io, json, os
from datetime import datetime
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import yfinance as yf

BASE = os.path.dirname(__file__)
REPORT_PATH    = os.path.join(BASE, "dashboard", "public", "data", "report.json")
REPORT_ES_PATH = os.path.join(BASE, "dashboard", "public", "data", "report-es.json")

# Mapa: símbolo del reporte → ticker yfinance
TICKER_MAP = {
    # Crypto
    "BTC":    "BTC-USD",
    "ETH":    "ETH-USD",
    "SOL":    "SOL-USD",
    "TAO":    "TAO-USD",
    "LINK":   "LINK-USD",
    "XRP":    "XRP-USD",
    "RENDER": "RNDR-USD",
    "BNB":    "BNB-USD",
    "ADA":    "ADA-USD",
    "AVAX":   "AVAX-USD",
    "DOGE":   "DOGE-USD",
    "DOT":    "DOT-USD",
    # Stocks
    "NVDA":   "NVDA",
    "AVGO":   "AVGO",
    "AMZN":   "AMZN",
    "AAPL":   "AAPL",
    "MSFT":   "MSFT",
    "GOOGL":  "GOOGL",
    "META":   "META",
    "DVN":    "DVN",
    "RKLB":   "RKLB",
    "RYTM":   "RYTM",
    "KO":     "KO",
    "JNJ":    "JNJ",
    "SPX":    "^GSPC",
    "IXIC":   "^IXIC",
    "DJI":    "^DJI",
    # Materials (ETF proxies — precio del ETF, no spot)
    "XAU":    "GLD",    # Gold ETF
    "CL":     "USO",    # Oil ETF
    "XAG":    "SLV",    # Silver ETF
    "HG":     "COPX",   # Copper ETF
    "NG":     "UNG",    # Natural Gas ETF
    "KC":     "JO",     # Coffee ETF
    "ZC":     "CORN",   # Corn ETF
    "GLD":    "GLD",
    "USO":    "USO",
    "SLV":    "SLV",
    "COPX":   "COPX",
    # Currencies (ticker=X retorna unidades de moneda por 1 USD, o pares directos)
    "DXY":      "DX-Y.NYB",
    "USD/MXN":  "MXN=X",      # MXN por USD (~17)
    "USD/JPY":  "JPY=X",      # JPY por USD (~149)
    "EUR/USD":  "EURUSD=X",   # USD por EUR (~1.15)
    "GBP/USD":  "GBPUSD=X",   # USD por GBP (~1.32)
    "USD/TRY":  "TRY=X",      # TRY por USD (~38)
    "AUD/USD":  "AUDUSD=X",   # USD por AUD (~0.69)
    "EUR/CLP":  "EURCLP=X",
    "USD/CLP":  "CLP=X",
    # Crypto adicionales
    "TAO":      "TAO22974-USD",  # Bittensor
    "RNDR":     "RNDR-USD",
}

def pct(new, old):
    if old and old != 0:
        return round((new - old) / abs(old) * 100, 2)
    return 0.0

def fmt_pct(v):
    return f"{v:+.2f}%"

def fmt_price(v, symbol=""):
    """Formatea precio según tipo de activo."""
    if v is None: return "N/D"
    if v >= 1000:
        return f"${v:,.2f}"
    elif v >= 1:
        return f"${v:,.4f}"
    else:
        return f"${v:.6f}"

def fmt_large(n):
    if not n: return "N/D"
    if n >= 1e12: return f"${n/1e12:.2f}T"
    if n >= 1e9:  return f"${n/1e9:.2f}B"
    if n >= 1e6:  return f"${n/1e6:.2f}M"
    return f"${n:.2f}"

def fetch_price_data(yf_ticker):
    """Descarga 2 años de historia y calcula cambios."""
    try:
        t = yf.Ticker(yf_ticker)
        h = t.history(period="2y")
        if h.empty or len(h) < 2:
            return None
        close = h['Close']
        vol   = h.get('Volume', None)

        precio = float(close.iloc[-1])
        c24h  = pct(close.iloc[-1], close.iloc[-2]) if len(close) > 1 else 0
        c7d   = pct(close.iloc[-1], close.iloc[-8]) if len(close) > 7 else 0
        c30d  = pct(close.iloc[-1], close.iloc[-22]) if len(close) > 21 else 0
        h52   = float(close.tail(252).max())
        l52   = float(close.tail(252).min())

        ano = datetime.now().year
        ytd_ = close[close.index.year == ano]
        ytd = pct(precio, float(ytd_.iloc[0])) if not ytd_.empty else 0

        # Volume
        vol24 = None
        if vol is not None and len(vol) > 0:
            vol24 = float(vol.iloc[-1]) * precio  # en USD

        # Market cap (solo acciones/crypto)
        mc = None
        try:
            info = t.info
            mc = info.get('marketCap')
        except:
            pass

        return {
            "precio":    round(precio, 4),
            "c24h":      c24h,
            "c7d":       c7d,
            "c30d":      c30d,
            "ytd":       ytd,
            "high_52w":  round(h52, 4),
            "low_52w":   round(l52, 4),
            "vol24_usd": vol24,
            "market_cap": mc,
        }
    except Exception as e:
        return None

def update_asset(asset):
    sym = asset.get("symbol", "")
    yf_ticker = TICKER_MAP.get(sym)
    if not yf_ticker:
        print(f"  [SKIP] {sym} — sin ticker mapeado")
        return asset

    print(f"  Actualizando {sym} ({yf_ticker})...", end=" ", flush=True)
    data = fetch_price_data(yf_ticker)
    if not data:
        print("ERROR — sin datos")
        return asset

    precio = data["precio"]
    asset["current_price"] = precio
    asset["change_24h"]    = fmt_pct(data["c24h"])
    asset["change_7d"]     = fmt_pct(data["c7d"])
    asset["change_30d"]    = fmt_pct(data["c30d"])
    asset["ytd_change"]    = fmt_pct(data["ytd"])
    asset["week_52_high"]  = data["high_52w"]
    asset["week_52_low"]   = data["low_52w"]

    if data.get("vol24_usd"):
        asset["volume_24h"] = fmt_large(data["vol24_usd"])
    if data.get("market_cap"):
        asset["market_cap"] = data["market_cap"]

    print(f"${precio:,.2f}  ({data['c24h']:+.2f}% 24h | {data['ytd']:+.2f}% YTD)")
    return asset


# ---- MAIN ----
if not os.path.exists(REPORT_PATH):
    print(f"ERROR: No se encontró {REPORT_PATH}")
    sys.exit(1)

with open(REPORT_PATH, encoding="utf-8") as f:
    report = json.load(f)

print(f"\nActualizando precios del report.json (generado: {report.get('generated_at', '?')})\n")

total_ok = 0
total_err = 0

for sector_name, sector_data in report.get("sectors", {}).items():
    print(f"\n[{sector_name.upper()}]")
    updated_assets = []
    for asset in sector_data.get("assets", []):
        sym = asset.get("symbol", "")
        yf_ticker = TICKER_MAP.get(sym)
        if yf_ticker:
            updated = update_asset(asset)
            updated_assets.append(updated)
            total_ok += 1
        else:
            print(f"  [SKIP] {sym} — sin ticker yfinance")
            updated_assets.append(asset)
            total_err += 1
    sector_data["assets"] = updated_assets

# Actualizar timestamp
report["generated_at"] = datetime.now().isoformat()
report["_prices_updated"] = datetime.now().isoformat()
report["_update_note"] = "Precios actualizados en tiempo real por update_report_prices.py"

# Guardar
with open(REPORT_PATH, "w", encoding="utf-8") as f:
    json.dump(report, f, indent=2, ensure_ascii=False, default=str)
print(f"\n✓ report.json guardado ({total_ok} activos actualizados, {total_err} sin mapa)")

# Actualizar report-es.json si existe (misma estructura, solo traduce textos)
if os.path.exists(REPORT_ES_PATH):
    with open(REPORT_ES_PATH, encoding="utf-8") as f:
        report_es = json.load(f)

    for sector_name, sector_data in report.get("sectors", {}).items():
        if sector_name in report_es.get("sectors", {}):
            en_assets = sector_data.get("assets", [])
            es_assets = report_es["sectors"][sector_name].get("assets", [])
            for i, en_asset in enumerate(en_assets):
                if i < len(es_assets):
                    sym = en_asset.get("symbol")
                    for field in ["current_price","change_24h","change_7d","change_30d",
                                  "ytd_change","week_52_high","week_52_low","volume_24h","market_cap"]:
                        if field in en_asset:
                            es_assets[i][field] = en_asset[field]

    report_es["generated_at"] = report["generated_at"]
    report_es["_prices_updated"] = report["_prices_updated"]
    with open(REPORT_ES_PATH, "w", encoding="utf-8") as f:
        json.dump(report_es, f, indent=2, ensure_ascii=False, default=str)
    print(f"✓ report-es.json actualizado también")

print("\nRecarga el dashboard para ver los precios frescos.\n")
