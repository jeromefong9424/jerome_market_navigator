from fastapi import APIRouter
import yfinance as yf
import numpy as np
import json
import os
from datetime import date

router = APIRouter(prefix="/api/rs", tags=["rs"])

NAMES_FILE = os.path.join(os.path.dirname(__file__), '..', 'ticker_names.json')
CACHE_FILE = os.path.join(os.path.dirname(__file__), '..', 'rs_cache.json')


def _load_names() -> dict:
    if os.path.exists(NAMES_FILE):
        with open(NAMES_FILE) as f:
            return json.load(f)
    return {}


def _save_names(cache: dict):
    with open(NAMES_FILE, 'w') as f:
        json.dump(cache, f, indent=2)


def _fetch_names(symbols: list[str]) -> dict:
    cache = _load_names()
    missing = [s for s in symbols if s not in cache]
    if missing:
        for sym in missing:
            try:
                info = yf.Ticker(sym).info
                name = info.get('shortName') or info.get('longName') or sym
                cache[sym] = name
            except Exception:
                cache[sym] = sym
        _save_names(cache)
    return cache


# ─── RS cache: results cached to disk, refresh only on demand ───────────────
def _load_rs_cache() -> dict:
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE) as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            # Corrupt cache — treat as empty, will rebuild on next write
            return {"date": "", "data": {}}
    return {"date": "", "data": {}}


def _save_rs_cache(cache: dict):
    # Atomic write: serialize to string first, then write + rename
    # Prevents corruption when concurrent requests write the cache
    tmp = CACHE_FILE + '.tmp'
    data = json.dumps(cache)
    with open(tmp, 'w') as f:
        f.write(data)
    os.replace(tmp, CACHE_FILE)


def _compute_rs(symbols_to_fetch: list[str], cache: dict) -> list[dict]:
    """Fetch from yfinance and compute RS metrics for the given symbols."""
    all_symbols = list(set(symbols_to_fetch + ["SPY"]))

    raw = yf.download(
        all_symbols,
        period="3mo",
        interval="1d",
        auto_adjust=True,
        progress=False,
    )

    if raw.empty:
        return []

    closes_all = raw["Close"].dropna(how="all")
    closes = closes_all.tail(25)

    if "SPY" not in closes.columns:
        return []

    spy = closes["SPY"].dropna()
    results = []

    for ticker in symbols_to_fetch:
        try:
            if ticker not in closes.columns:
                continue
            prices = closes[ticker].dropna()
            if len(prices) < 10:
                continue

            spy_aligned = spy.loc[prices.index].dropna()
            prices = prices.loc[spy_aligned.index]

            rs_ratio = prices / spy_aligned
            rs_norm = (rs_ratio / rs_ratio.iloc[0]) * 100

            n = len(rs_norm)
            x = np.arange(n)

            slope, _ = np.polyfit(x, rs_norm.values, 1)

            if n >= 5:
                slope_5d, _ = np.polyfit(x[-5:], rs_norm.values[-5:], 1)
            else:
                slope_5d = slope

            rs_mom = 0.0
            if len(rs_ratio) >= 11:
                rs_mom = float(((rs_ratio.iloc[-1] / rs_ratio.iloc[-11]) - 1) * 100)

            tail = []
            for i in range(max(-5, -n), 0):
                idx = i
                if len(rs_ratio) + idx >= 11:
                    mom = float(((rs_ratio.iloc[idx] / rs_ratio.iloc[idx - 10]) - 1) * 100)
                else:
                    mom = 0.0
                tail.append({
                    "rs_strength": round(float(rs_norm.iloc[idx]), 2),
                    "rs_momentum": round(mom, 2),
                })

            candles = []
            for ts in closes_all.index:
                try:
                    o = raw["Open"][ticker].loc[ts]
                    h = raw["High"][ticker].loc[ts]
                    l = raw["Low"][ticker].loc[ts]
                    c = raw["Close"][ticker].loc[ts]
                    if any(v != v for v in (o, h, l, c)):
                        continue
                    candles.append({
                        "time":  ts.strftime("%Y-%m-%d"),
                        "open":  round(float(o), 2),
                        "high":  round(float(h), 2),
                        "low":   round(float(l), 2),
                        "close": round(float(c), 2),
                    })
                except (KeyError, TypeError):
                    continue

            # Performance metrics from full 3mo window
            all_prices = closes_all[ticker].dropna()
            n_all = len(all_prices)
            current_close = float(all_prices.iloc[-1])
            pct_1w = round(((current_close / float(all_prices.iloc[-6])) - 1) * 100, 2) if n_all >= 6 else None
            pct_1m = round(((current_close / float(all_prices.iloc[-22])) - 1) * 100, 2) if n_all >= 22 else None
            high52w = float(all_prices.iloc[-252:].max()) if n_all >= 252 else float(all_prices.max())
            from_high_pct = round(((current_close / high52w) - 1) * 100, 2)
            current_year = date.today().year
            ytd_start = None
            for i, idx in enumerate(all_prices.index):
                if idx.year == current_year:
                    ytd_start = float(all_prices.iloc[i])
                    break
            ytd_pct = round(((current_close / ytd_start) - 1) * 100, 2) if ytd_start else None

            results.append({
                "ticker":      ticker,
                "price":       round(float(prices.iloc[-1]), 2),
                "rs_slope":    round(float(slope), 4),
                "slope_5d":    round(float(slope_5d), 4),
                "rs_norm":     [round(float(v), 2) for v in rs_norm.values],
                "rs_strength": round(float(rs_norm.iloc[-1]), 2),
                "rs_momentum": round(rs_mom, 2),
                "tail":        tail,
                "candles":     candles,
                "pct_1w":      pct_1w,
                "pct_1m":      pct_1m,
                "ytd_pct":     ytd_pct,
                "from_high_pct": from_high_pct,
            })
        except Exception:
            continue

    names = _fetch_names([r["ticker"] for r in results])
    for r in results:
        r["name"] = names.get(r["ticker"], r["ticker"])

    # Save into cache
    today = date.today().isoformat()
    cache["date"] = today
    for r in results:
        cache["data"][r["ticker"]] = r
    _save_rs_cache(cache)

    return results


def _rank_and_return(symbols: list[str], cache: dict) -> list[dict]:
    """Pick requested tickers from cache, rank, and return."""
    results = [cache["data"][s] for s in symbols if s in cache["data"]]
    results.sort(key=lambda r: r["rs_slope"], reverse=True)
    for i, r in enumerate(results):
        r["rank"] = i + 1
    return results


@router.get("")
def get_rs(tickers: str, refresh: bool = False):
    symbols = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    if not symbols:
        return []

    cache = _load_rs_cache()
    today = date.today().isoformat()
    has_cache = cache["data"] and any(s in cache["data"] for s in symbols)

    # Force refresh — fetch everything fresh
    if refresh:
        cache = {"date": today, "data": {}}
        _compute_rs(symbols, cache)
        return _rank_and_return(symbols, cache)

    # Cache is from today — serve it, fetch only missing tickers
    if cache["date"] == today and has_cache:
        miss = [s for s in symbols if s not in cache["data"]]
        if miss:
            _compute_rs(miss, cache)
            cache = _load_rs_cache()  # reload after save
        return _rank_and_return(symbols, cache)

    # Cache exists but is stale — return stale data immediately for known tickers
    # New tickers with no cache at all will need a fresh fetch
    if has_cache:
        miss = [s for s in symbols if s not in cache["data"]]
        if miss:
            _compute_rs(miss, cache)
            cache = _load_rs_cache()
        return _rank_and_return(symbols, cache)

    # No cache at all — must fetch
    cache = {"date": today, "data": {}}
    _compute_rs(symbols, cache)
    return _rank_and_return(symbols, cache)
