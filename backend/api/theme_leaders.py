import os
import json
from datetime import date
from fastapi import APIRouter, HTTPException
import yfinance as yf
import numpy as np

router = APIRouter(prefix="/api/theme", tags=["theme"])

CACHE_FILE = os.path.join(os.path.dirname(__file__), '..', 'theme_leaders_cache.json')


def _load_cache() -> dict:
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE) as f:
            return json.load(f)
    return {}


def _save_cache(cache: dict):
    with open(CACHE_FILE, 'w') as f:
        json.dump(cache, f)


def _ema(series: np.ndarray, n: int) -> float:
    if len(series) < n:
        return float(np.nan)
    alpha = 2 / (n + 1)
    ema_val = float(series[0])
    for v in series[1:]:
        ema_val = alpha * v + (1 - alpha) * ema_val
    return ema_val


def _atr(highs: np.ndarray, lows: np.ndarray, closes: np.ndarray, n: int = 14) -> float:
    """Compute average true range."""
    if len(closes) < n + 1:
        return float(np.nan)
    trs = []
    for i in range(1, len(closes)):
        tr = max(
            highs[i] - lows[i],
            abs(highs[i] - closes[i - 1]),
            abs(lows[i] - closes[i - 1]),
        )
        trs.append(tr)
    return float(np.mean(trs[-n:]))


def _compute_stock_rs(stock_ticker: str, spy_closes: np.ndarray) -> dict | None:
    """Compute RS metrics for a stock vs SPY."""
    try:
        stock = yf.Ticker(stock_ticker)
        hist = stock.history(period="3mo", interval="1d", auto_adjust=True)
        if hist.empty or len(hist) < 10:
            return None

        closes = hist["Close"].values
        highs = hist["High"].values
        lows = hist["Low"].values
        volumes = hist["Volume"].values
        close_dates = hist.index

        # Align with SPY window — build a date->price map from SPY
        spy_map: dict[str, float] = {}
        for i, d in enumerate(close_dates):
            if i < len(spy_closes):
                spy_map[d.strftime("%Y-%m-%d")] = float(spy_closes[i])

        # Get aligned arrays
        aligned_spy = []
        aligned_stock = []
        for d, c in zip(close_dates, closes):
            ds = d.strftime("%Y-%m-%d")
            if ds in spy_map:
                aligned_spy.append(spy_map[ds])
                aligned_stock.append(float(c))

        if len(aligned_stock) < 10:
            return None

        stock_arr = np.array(aligned_stock)
        spy_arr = np.array(aligned_spy[:len(stock_arr)])

        rs_ratio = stock_arr / spy_arr
        rs_norm = (rs_ratio / rs_ratio[0]) * 100
        n = len(rs_norm)
        x = np.arange(n)
        slope, _ = np.polyfit(x, rs_norm, 1)

        # EMAs
        ema8 = _ema(closes, 8)
        ema21 = _ema(closes, 21)
        ema50 = _ema(closes, 50) if len(closes) >= 50 else None

        current_close = closes[-1]

        # 52-week high
        high52w = float(np.max(closes[-252:])) if len(closes) >= 252 else float(np.max(closes))
        pct_from_high = ((current_close / high52w) - 1) * 100

        # ATR contraction: 5d ATR / 20d ATR
        atr5 = _atr(highs[-6:], lows[-6:], closes[-6:], 5)
        atr20 = _atr(highs[-21:], lows[-21:], closes[-21:], 20) if len(closes) >= 21 else atr5
        atr_contraction = atr5 / atr20 if atr20 else 1.0

        # Volume dry-up: 5d avg vol / 50d avg vol
        vol5 = float(np.mean(volumes[-5:]))
        vol50 = float(np.mean(volumes[-50:])) if len(volumes) >= 50 else vol5
        vol_ratio = vol5 / vol50 if vol50 else 1.0

        # OHLCV for chart
        ohlcv = []
        for ts in hist.index:
            try:
                o = float(hist["Open"].loc[ts])
                h = float(hist["High"].loc[ts])
                l = float(hist["Low"].loc[ts])
                c = float(hist["Close"].loc[ts])
                v = int(hist["Volume"].loc[ts])
                ohlcv.append({"time": ts.strftime("%Y-%m-%d"), "open": round(o, 2), "high": round(h, 2), "low": round(l, 2), "close": round(c, 2), "volume": v})
            except Exception:
                continue

        # 1-week and 1-month performance
        n = len(closes)
        pct_1w = round(((current_close / float(closes[-6])) - 1) * 100, 2) if n >= 6 else None
        pct_1m = round(((current_close / float(closes[-22])) - 1) * 100, 2) if n >= 22 else None

        return {
            "ticker": stock_ticker,
            "rs_slope": round(float(slope), 4),
            "above_ema8": bool(current_close > ema8) if ema8 else False,
            "above_ema21": bool(current_close > ema21) if ema21 else False,
            "above_ema50": bool(current_close > ema50) if ema50 else None,
            "pct_from_high": round(pct_from_high, 2),
            "atr_contraction": round(float(atr_contraction), 3),
            "vol_ratio": round(float(vol_ratio), 3),
            "price": round(float(current_close), 2),
            "ema8": round(float(ema8), 2) if ema8 else None,
            "ema21": round(float(ema21), 2) if ema21 else None,
            "ema50": round(float(ema50), 2) if ema50 else None,
            "high52w": round(high52w, 2),
            "pct_1w": pct_1w,
            "pct_1m": pct_1m,
            "ohlcv": ohlcv,
        }
    except Exception:
        return None


@router.get("/{theme_id}/leaders")
def get_theme_leaders(theme_id: str):
    cache = _load_cache()
    today = date.today().isoformat()

    # Check cache
    if cache.get(theme_id, {}).get("date") == today:
        return cache[theme_id]

    # Load theme config
    config_path = os.path.join(os.path.dirname(__file__), '..', 'theme_groups_backend.json')
    if not os.path.exists(config_path):
        raise HTTPException(404, "Theme config not found")

    with open(config_path) as f:
        config = json.load(f)

    theme = None
    for t in config.get("themes", []):
        if t["id"] == theme_id:
            theme = t
            break

    if not theme:
        raise HTTPException(404, f"Theme '{theme_id}' not found")

    etfs = theme.get("etfs", [])
    gap_tickers: list[str] = []
    gap_map: dict[str, str] = {}  # ticker -> "No ETF" badge source

    for gap in theme.get("coverageGaps", []):
        for leader in gap.get("leaders", []):
            if leader not in gap_tickers:
                gap_tickers.append(leader)
                gap_map[leader] = gap.get("branch", "")

    # Get SPY data for RS computation
    spy_raw = yf.download("SPY", period="3mo", interval="1d", auto_adjust=True, progress=False)
    spy_closes = spy_raw["Close"].dropna().iloc[:, 0].values

    all_tickers: list[str] = list(etfs)
    seen: set[str] = set()

    # Fetch holdings from ETFs
    for etf in etfs:
        try:
            holdings = yf.Ticker(etf).funds_data.top_holdings
            top10 = holdings.index.tolist()[:10]
            for t in top10:
                if t not in seen:
                    seen.add(t)
                    all_tickers.append(t)
        except Exception:
            continue

    # Add gap leaders
    for t in gap_tickers:
        if t not in seen:
            seen.add(t)
            all_tickers.append(t)

    # Compute RS for each stock
    results = []
    for ticker in all_tickers:
        if ticker == "SPY":
            continue
        r = _compute_stock_rs(ticker, spy_closes)
        if r:
            r["is_gap"] = ticker in gap_map
            r["gap_branch"] = gap_map.get(ticker, "")
            results.append(r)

    # Sort by RS slope
    results.sort(key=lambda x: x["rs_slope"], reverse=True)
    top10 = results[:10]

    # Add rank
    for i, r in enumerate(top10):
        r["rank"] = i + 1

    response = {
        "date": today,
        "theme_id": theme_id,
        "theme_name": theme["name"],
        "leaders": top10,
    }

    # Cache
    cache[theme_id] = response
    _save_cache(cache)

    return response