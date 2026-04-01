import json
import os
import time
import yfinance as yf
from fastapi import APIRouter

router = APIRouter(prefix="/api/holdings", tags=["holdings"])

CACHE_FILE = os.path.join(os.path.dirname(__file__), '..', 'etf_holdings.json')
CACHE_TTL = 86400  # 1 day in seconds


def _load_cache() -> dict:
    if not os.path.exists(CACHE_FILE):
        return {}
    with open(CACHE_FILE) as f:
        return json.load(f)


def _save_cache(cache: dict):
    with open(CACHE_FILE, 'w') as f:
        json.dump(cache, f, indent=2)


@router.get("")
def get_holdings(tickers: str, top_n: int = 10):
    """Return top N holdings for each ETF ticker. Cached for 1 day."""
    symbols = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    cache = _load_cache()
    now = time.time()
    result = {}
    dirty = False

    for sym in symbols:
        entry = cache.get(sym)
        # Re-fetch if cache is fresh but has fewer holdings than requested
        if entry and now - entry.get("ts", 0) < CACHE_TTL and len(entry.get("holdings", [])) >= top_n:
            result[sym] = entry["holdings"][:top_n]
            continue
        try:
            df = yf.Ticker(sym).funds_data.top_holdings
            holdings = df.index.tolist()[:top_n]
            if holdings:
                cache[sym] = {"holdings": holdings, "ts": now}
                result[sym] = holdings
                dirty = True
        except Exception:
            result[sym] = []

    if dirty:
        _save_cache(cache)

    return result
