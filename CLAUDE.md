# Jerome Market Navigator — Claude Context

## What this is
A standalone market relative strength (RS) dashboard.
Tracks ETF rotation, RS rankings vs SPY, RRG scatter, and AI market briefings via Claude.
No IB connection — purely analytical, no order placement.

## Tech Stack
- **Frontend:** React 19 + TypeScript + Vite + TailwindCSS + Zustand + Axios + framer-motion
- **Backend:** FastAPI + Uvicorn + yfinance + httpx
- **Charts:** lightweight-charts v5 (candlestick + area + line series)
- **Hover cards:** @radix-ui/react-hover-card
- **AI:** Claude Haiku (`claude-haiku-4-5-20251001`) via backend proxy

## Running the app

### Backend
```bash
cd jerome-market-navigator/backend
source .venv/bin/activate
uvicorn main:app --reload --port 8001
# Runs on http://localhost:8001
```

### Frontend
```bash
cd jerome-market-navigator/frontend
npm run dev
# Runs on http://localhost:5173 — proxies /api to localhost:8001
```

## Project structure
```
jerome-market-navigator/
├── frontend/src/
│   ├── App.tsx                  # Root layout: Header + RSDashboard
│   ├── store.ts                 # Zustand: selectedTicker, watchlist
│   ├── api.ts                   # fetchRS, fetchGroups, fetchHoldings, fetchCandles
│   ├── types.ts                 # WatchlistRow, MarketData, Sizing
│   ├── components/
│   │   └── Header.tsx           # "Jerome Market Navigator" branding only
│   └── pages/
│       └── RSDashboard.tsx      # Main page — all RS logic lives here
├── backend/
│   ├── main.py                  # FastAPI app, CORS for :5173
│   ├── tickers.json             # Default group/ticker lists (57 ETFs)
│   ├── ticker_names.json        # Display names for tickers
│   ├── etf_holdings.json        # Holdings cache (auto-generated, 24h TTL)
│   └── api/
│       ├── rs.py                # GET /api/rs — RS data + candles (yfinance)
│       ├── holdings.py          # GET /api/holdings — top 10 ETF holdings (cached)
│       ├── tickers.py           # GET/POST/DELETE /api/tickers — group management
│       └── claude.py            # POST /api/claude — Anthropic API proxy
```

## Key components in RSDashboard.tsx
| Component | Description |
|-----------|-------------|
| `CandleChart` | lightweight-charts candlestick, 3-month daily OHLCV |
| `NormalizedChart` | Base-100 comparison chart (holding vs ETF benchmark) |
| `RSHistogram` | 25-bar inline SVG RS momentum histogram |
| `HoldingBadge` | Holding ticker badge with HoverCard candlestick popup |
| `TickerCard` | ETF card: ticker/price header + CandleChart + RS strip + badges |
| `RRGChart` | SVG scatter: RS Strength (X) vs RS Momentum (Y), 4 quadrants |
| `HoldingsPanel` | Drill-down panel showing top holdings with NormalizedChart hover |
| `AIMarketSummary` | Daily AI briefing — Claude Haiku, web search, localStorage cache |
| `AuditModal` | Claude coverage audit with one-click add to group |

## RS calculation (backend/api/rs.py)
- Fetches 40 days of daily OHLCV via yfinance, trims to 25 clean sessions
- RS Ratio = `price / SPY_price` (not RSI)
- RS Norm = ratio normalized to 100 at window start
- RS Slope = linear regression slope over 25d window (primary rank metric)
- RS Momentum = 10d rate of change of RS ratio
- Returns `candles` (3-month OHLCV) alongside RS metrics for chart rendering

## RRG quadrants
| Quadrant | Condition |
|----------|-----------|
| Leading   | rs_strength ≥ 100 AND rs_momentum ≥ 0 |
| Weakening | rs_strength ≥ 100 AND rs_momentum < 0  |
| Improving | rs_strength < 100  AND rs_momentum ≥ 0 |
| Lagging   | rs_strength < 100  AND rs_momentum < 0  |

## AI Market Summary (AIMarketSummary component)
- Cached in `localStorage` key `jmn_ai_summary` with daily date check (`en-CA` locale for YYYY-MM-DD)
- Only calls API once per day — `callApi(rows, force=false)` checks cache first
- Force refresh available via button
- Uses `web_search_20250305` tool in the Anthropic request
- Strips HTML tags (`<cite>`, etc.) from Claude response before parsing JSON
- Extracts JSON robustly: `raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)`
- Callout types: `STRONG | WEAK | WATCH | RISK | IMPROVING`

## API key
- Stored in `backend/.env` as `ANTHROPIC_API_KEY`
- Never call Anthropic directly from the browser — always proxy through `/api/claude`

## Ticker groups
- Default group "Sector ETFs" — 57 ETFs defined in `backend/tickers.json`
- User can create custom groups and add/remove tickers
- Holdings cached 24h in `backend/etf_holdings.json` (gitignored)

## Clicking a ticker
- Sets `selectedTicker` in Zustand store
- Opens TradingView chart for that ticker in a new tab
- Copies ticker to clipboard

## Deployment
- **Frontend:** GitHub Pages — auto-deploys via `.github/workflows/deploy.yml` on push to `main`
  - Live at `https://jeromefong9424.github.io/jerome_market_navigator/`
  - GitHub secret `VITE_API_URL` = `http://195.201.130.210/api`
- **Backend:** Hetzner VPS `195.201.130.210`
  - SSH: `ssh jerome@195.201.130.210`
  - App dir: `/opt/jerome-market-navigator/backend`
  - systemd service: `jmn-api` (uvicorn on port 8001)
  - nginx reverse proxy: `/api/` → `127.0.0.1:8001`
  - `.env` on server holds `ANTHROPIC_API_KEY`
- **Deploy config files:** `deploy/` directory (systemd service, nginx config, setup script)
