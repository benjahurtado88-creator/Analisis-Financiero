# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

**Tododeia** is a Claude Code skill that orchestrates 6 AI agents to produce a bilingual (EN/ES) investment research report. The skill is invoked through Claude Code, runs parallel market research, and serves an interactive Next.js dashboard at `localhost:3420`.

**Investor profile (hardcoded — do not ask the user):**
- **65% Growth bucket**: x5–x10 targets, disruptive tech, crypto, small caps, AI, revenue growth >15% YoY
- **35% Dividend bucket**: payout <70%, positive FCF yield, growing dividend history
- Tag each pick [GROWTH 🚀] or [DIVIDENDO 💰]

## Commands

### Dashboard (Next.js)
```bash
cd dashboard
npm install
npm run dev -- -p 3420   # Run on the production port
npm run build
npm run lint
```

### Python Financial Analyzer
```bash
python analisis_maia.py TICKER [TICKER2 ...]   # e.g., python analisis_maia.py KO MSFT BTC
```

### Macro Context (VIX, yields, sector rotation)
```bash
python market_context.py   # outputs JSON with VIX, 10Y, DXY, S&P500, Nasdaq, sector ETFs
```

### Bulk Price Update (without re-running full analysis)
```bash
python update_report_prices.py   # updates current_price in report.json + report-es.json via yfinance
```

### Install the skill into Claude Code
```bash
curl -sL https://raw.githubusercontent.com/Hainrixz/maia-skill/main/install.sh | bash
```

## Architecture

### Skill Orchestration Flow

The entry point is `SKILL.md` (mirrored to `.claude/skills/investment-analysis/SKILL.md`). When triggered, the orchestrator:

1. **Sets risk profile = aggressive (65/35 strategy)** — does NOT ask the user
2. Reads agent prompts from `references/agent-prompts.md`
3. Loads historical accuracy data from `output/history/YYYY-MM-DD.json`
4. Runs `analisis_maia.py` for all known tickers (pre-loads hard data before spawning agents)
5. **Spawns 5 sector agents in parallel** (Crypto, Stocks, Startups, Currencies, Materials) — use Python data first, web searches only for what Python can't cover
6. **Spawns Strategy Agent** — receives all 5 sector outputs + risk profile + history → synthesizes macro view, cross-sector insights, top picks, and portfolio allocation
7. Merges all outputs into a single `REPORT_DATA` object
8. Saves to `output/history/YYYY-MM-DD.json` (keeps last 30)
9. Writes `dashboard/public/data/report.json` (English) and spawns a Translation Agent to write `report-es.json` (Spanish)
10. Starts Next.js dev server on port 3420 (or fallback Python HTTP server on port 8420 if Node.js is unavailable)

### Alternative: Gemini AI Report Generation

The dashboard also supports a one-click Gemini 2.0 Flash report generation via the API route `POST /api/generate-report`. This:
1. Runs `market_context.py` → fetches VIX, 10Y yield, DXY, sector rotation
2. Runs `analisis_maia.py` for 10 macro tickers (BTC, ETH, SOL, NVDA, AMZN, AVGO, MSFT, AAPL, GLD, KO)
3. Sends all data to Gemini with a structured prompt (sector instructions per selected sector)
4. Runs a critic/devil's advocate pass to catch biases and add warnings
5. Merges critic feedback into the final report and saves

Triggered from the dashboard header "Generar Reporte" button. Supports sector selection (crypto, stocks, startups, currencies, materials) and risk profile choice.

### Report Data Schema

The JSON written to `dashboard/public/data/report.json` drives the entire dashboard. Key top-level fields:

```
risk_profile, executive_summary, macro_environment,
portfolio_allocation (% per sector),
cross_sector_insights[], risk_adjusted_picks[],
historical_accuracy, warnings[], sectors.{crypto,stocks,startups,currencies,materials}
```

Each asset within a sector has 20+ fields including `current_price`, `recommendation`, `confidence`, `risk_score`, `social_buzz`, `key_news[]`. Startups assets also include `market_cap_b`, `revenue_growth_yoy`, `moat`, `valuation_vs_sector`.

### `analisis_maia.py` — Professional Analysis Output

The script produces a full JSON per ticker saved to `dashboard/public/data/ticker/{TICKER}.json`. Key sections:

- **`precio`** — current price, all % changes, RSI, MACD, SMAs (20/50/200), support/resistance, volume
- **`fundamentales`** — P/E, FCF yield, ROE, gross/net margins, D/E, interest coverage, EPS (via FinanceToolkit)
- **`info`** — market cap, sector, revenue/earnings growth, analyst consensus (target/low/high/rec/count), forward P/E, beta, EV/EBITDA
- **`fair_value`** — Fair Value P/E, Fair Value EV/EBITDA, safety margin, buy zones (aggressive/conservative)
- **`dcf`** — DCF (FCF-based) for growth stocks, DDM (Gordon Growth Model) for dividend stocks (yield >2%)
- **`escenarios`** — Bull/Base/Bear price targets (uses analyst consensus low/target/high as primary source)
- **`moat`** — 0–5 score: pricing power (gross >40%), ROE >20%, interest coverage >5x, margin trend, sector outperformance YTD
- **`riesgos`** — Structured risk matrix: valuation, financial, market (beta), dividend, technical, growth
- **`sentimiento`** — Finnhub social sentiment (score, buzz, % bullish/bearish Reddit+Twitter — stocks only)
- **`noticias_ticker`** — top 5 news pre-filtered by relevance score (Reuters=3pts, Bloomberg=3pts, etc.)
- **`veredicto` + `score`** — overall verdict (COMPRA FUERTE / COMPRA / MANTENER / VENDER) and 0–10 score

### Dashboard Data Flow

- `src/hooks/use-report-data.ts` — fetches `/api/report?lang=en` (live prices) instead of static file
- `src/app/api/report/route.ts` — reads report.json, refreshes all asset prices in parallel from Yahoo Finance v8 API (60s in-memory cache). Falls back to symbol as Yahoo ticker for unlisted/startup assets.
- `src/app/api/generate-report/route.ts` — Gemini 2.0 Flash report generation (SSE streaming)
- `src/hooks/use-language.tsx` — React context for EN/ES toggle
- `src/types/report.ts` — TypeScript interfaces for the full report schema (source of truth for data shapes)
- `src/lib/translations.ts` — 100+ UI strings in EN/ES (only UI chrome is translated; data comes pre-translated in separate JSON files)
- `src/app/page.tsx` — composes all report section components
- `src/app/ticker/[symbol]/` — individual ticker deep-dive pages
- `src/app/portfolio/` — portfolio tracker
- `src/app/analyze/` — search and analyze any ticker on demand

### Key Files

| File | Role |
|---|---|
| `SKILL.md` | Orchestrator instructions (10-step workflow) |
| `references/agent-prompts.md` | Detailed prompts for all 6 agents (Crypto, Stocks, Startups, Currencies, Materials, Strategy) |
| `analisis_maia.py` | Deep-dive Python analyzer (DCF, DDM, moat, scenarios, risk matrix, Finnhub) |
| `market_context.py` | Macro context fetcher (VIX, 10Y yield, DXY, S&P500, Nasdaq, sector rotation) |
| `update_report_prices.py` | Bulk price updater for report.json via yfinance |
| `dashboard/public/data/report.json` | Live English report data |
| `dashboard/public/data/report-es.json` | Live Spanish report data |
| `dashboard/public/data/ticker/{TICKER}.json` | Per-ticker deep analysis JSON (output of analisis_maia.py) |
| `dashboard/src/app/api/report/route.ts` | Live prices API — refreshes prices from Yahoo Finance v8 |
| `dashboard/src/app/api/generate-report/route.ts` | Gemini AI report generation with critic pass |
| `output/history/` | Historical reports for accuracy tracking |
| `assets/template.html` | Fallback report if Node.js unavailable |

## Data Stack — Regla de Prioridad (CRÍTICO)

**Claude siempre revisa primero si Python ya tiene el dato. Solo va a la web si no lo tiene.**

| Dato | Fuente Python | ¿Ir a la web? |
|------|--------------|---------------|
| Precio actual, cambios 24h/7d/30d/YTD | yfinance | ❌ Nunca |
| RSI, MACD, SMAs, soporte/resistencia | yfinance (calculado) | ❌ Nunca |
| P/E, FCF, ROE, márgenes, deuda, EPS | FinanceToolkit | ❌ Nunca |
| Revenue growth, earnings growth, market cap, beta, EV/EBITDA | yfinance `.info` | ❌ Nunca |
| Consenso analistas (target, low, high, rec, # analistas) | yfinance `.info` → `info.analyst_*` | ❌ Nunca |
| Sentimiento social (score, buzz, % bullish/bearish Reddit+Twitter) | Finnhub sentiment API | ❌ Nunca (solo acciones) |
| Noticias del ticker (top 5 filtradas por relevancia) | yfinance + filtro Python | ❌ Nunca |
| Noticias macro (top 4 filtradas) | RSS MarketWatch + filtro Python | ❌ Nunca |
| DCF / DDM / Fair Value / Moat / Escenarios / Risk matrix | analisis_maia.py | ❌ Nunca |
| Catalizadores específicos del día ("¿por qué sube hoy?") | — | ✅ Buscar (stocks + crypto) |
| Sentimiento social de crypto (Twitter/Reddit) | — | ✅ Buscar (Finnhub no cubre crypto) |
| Moat validation para startups | — | ✅ Buscar (confirmar ventaja competitiva) |
| Spot prices de commodities (gold $/oz, oil $/barrel) | — | ✅ Buscar (ETF price ≠ spot) |
| Supply/demand y contexto macro geopolítico | — | ✅ Buscar |
| Contexto de divisas y política de bancos centrales | — | ✅ Buscar |

### Cómo usar el script

```bash
# Un ticker
python analisis_maia.py MSFT

# Múltiples (genera tabla comparativa)
python analisis_maia.py MSFT AAPL NVDA

# Cripto (detecta automáticamente)
python analisis_maia.py BTC ETH SOL

# Startups / small caps (funciona igual)
python analisis_maia.py PLTR HOOD RKLB
```

El script guarda el JSON completo en `dashboard/public/data/ticker/{TICKER}.json` y en `output/history/`. Los agentes deben leer ese JSON antes de hacer cualquier búsqueda web.

### Stack técnico

- **yfinance** → precios históricos, cambios, SMAs, RSI, MACD, market cap, analyst consensus
- **FinanceToolkit** → ratios fundamentales anuales (P/E, FCF yield, ROE, márgenes, deuda, EPS)
- **Finnhub** → sentimiento social procesado (score, buzz, % bullish/bearish por Reddit y Twitter/X). Solo el endpoint de sentimiento — no noticias — porque ya viene calculado, ahorrando tokens
- **Filtro Python propio** → puntúa noticias por keywords financieros (fed, earnings, merger, etc.) y por fuente confiable (Reuters=3pts, Bloomberg=3pts...). Entrega solo el top 5-10 más relevantes a Claude
- **Gemini 2.0 Flash** → generación de reporte AI desde el dashboard (main pass + critic pass)

### Bilingual Strategy

- **UI strings**: controlled by `translations.ts`, selected via language context
- **Report content**: two separate JSON files generated at analysis time — the Translation Agent rewrites all text fields into Spanish while keeping numbers, tickers, and prices unchanged
- Language selection shown at first load via `LanguagePicker` modal

## Important Rules for Claude

1. **Never ask for risk profile** — it's always aggressive (65% Growth / 35% Dividend)
2. **Never re-search data that Python already has** — run `analisis_maia.py` first, then only web-search for catalysts, moat validation, spot prices, and macro/currency context
3. **Always tag picks** with [GROWTH 🚀] or [DIVIDENDO 💰]
4. **Startups sector is permanent** — always include it alongside crypto, stocks, currencies, materials
5. **Live prices**: the dashboard auto-refreshes prices via `/api/report` on each page load — no need to manually update report.json for price accuracy
