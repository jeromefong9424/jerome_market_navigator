import os
import json
from datetime import date
from fastapi import APIRouter
import yfinance as yf
import numpy as np

router = APIRouter(prefix="/api/regime", tags=["regime"])

CACHE_FILE = os.path.join(os.path.dirname(__file__), '..', 'regime_cache.json')


def ema(series: np.ndarray, n: int) -> float:
    """Compute N-day EMA from a numpy array of closes."""
    if len(series) < n:
        return float(np.nan)
    alpha = 2 / (n + 1)
    ema_val = float(series[0])
    for v in series[1:]:
        ema_val = alpha * v + (1 - alpha) * ema_val
    return ema_val


def sma(series: np.ndarray, n: int) -> float:
    """Compute N-day SMA."""
    if len(series) < n:
        return float(np.nan)
    return float(np.mean(series[-n:]))


def _load_cache() -> dict:
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE) as f:
            return json.load(f)
    return {"date": "", "regime": None, "data": None}


def _save_cache(cache: dict):
    with open(CACHE_FILE, 'w') as f:
        json.dump(cache, f)


@router.get("")
def get_regime():
    cache = _load_cache()
    today = date.today().isoformat()

    # Serve stale cache for rest of day
    if cache.get("date") == today and cache.get("regime"):
        return cache

    tickers = ["SPY", "QQQ", "IWM", "IBIT"]
    raw = yf.download(tickers, period="1y", interval="1d", auto_adjust=True, progress=False)

    closes = raw["Close"].dropna()

    spy_close = float(closes["SPY"].iloc[-1])
    qqq_close = float(closes["QQQ"].iloc[-1])
    ibit_close = float(closes["IBIT"].iloc[-1])

    # 8-day EMA for SPY and QQQ
    spy_arr = closes["SPY"].values
    qqq_arr = closes["QQQ"].values
    spy_ema8 = ema(spy_arr, 8)
    qqq_ema8 = ema(qqq_arr, 8)
    spy_dist = ((spy_close / spy_ema8) - 1) * 100 if spy_ema8 else 0
    qqq_dist = ((qqq_close / qqq_ema8) - 1) * 100 if qqq_ema8 else 0

    # 50-day SMA for IBIT
    ibit_arr = closes["IBIT"].values
    ibit_sma50 = sma(ibit_arr, 50)
    ibit_dist = ((ibit_close / ibit_sma50) - 1) * 100 if ibit_sma50 else 0

    # 52-week high
    spy_52w_high = float(closes["SPY"].iloc[-252:].max()) if len(closes) >= 252 else float(closes["SPY"].max())
    qqq_52w_high = float(closes["QQQ"].iloc[-252:].max()) if len(closes) >= 252 else float(closes["QQQ"].max())
    spy_from_high = ((spy_close / spy_52w_high) - 1) * 100
    qqq_from_high = ((qqq_close / qqq_52w_high) - 1) * 100

    # YTD start (first trading day of year)
    current_year = date.today().year
    ytd_start_spy = None
    ytd_start_qqq = None
    for i, idx in enumerate(closes.index):
        if idx.year == current_year:
            ytd_start_spy = float(closes["SPY"].iloc[i])
            ytd_start_qqq = float(closes["QQQ"].iloc[i])
            break
    spy_ytd = ((spy_close / ytd_start_spy) - 1) * 100 if ytd_start_spy else 0
    qqq_ytd = ((qqq_close / ytd_start_qqq) - 1) * 100 if ytd_start_qqq else 0

    # 1-week performance (5 trading days)
    n = len(closes)
    spy_1w = ((spy_close / float(closes["SPY"].iloc[-6])) - 1) * 100 if n >= 6 else 0
    qqq_1w = ((qqq_close / float(closes["QQQ"].iloc[-6])) - 1) * 100 if n >= 6 else 0

    # 1-month performance (~21 trading days)
    spy_1m = ((spy_close / float(closes["SPY"].iloc[-22])) - 1) * 100 if n >= 22 else 0
    qqq_1m = ((qqq_close / float(closes["QQQ"].iloc[-22])) - 1) * 100 if n >= 22 else 0

    # IWM / QQQ 20-day ratio
    if len(closes) >= 20:
        iwm_20d = closes["IWM"].iloc[-20:].mean()
        qqq_20d = closes["QQQ"].iloc[-20:].mean()
        iwm_qqq_ratio = iwm_20d / qqq_20d if qqq_20d else 1
        if len(closes) >= 25:
            iwm_25d = closes["IWM"].iloc[-25:].mean()
            qqq_25d = closes["QQQ"].iloc[-25:].mean()
            iwm_qqq_ratio_5d = iwm_25d / qqq_25d if qqq_25d else 1
        else:
            iwm_qqq_ratio_5d = iwm_qqq_ratio
        ratio_change = iwm_qqq_ratio / iwm_qqq_ratio_5d - 1 if iwm_qqq_ratio_5d else 0
    else:
        iwm_qqq_ratio = 1.0
        ratio_change = 0.0

    # Regime determination
    spy_above = bool(spy_close > spy_ema8)
    qqq_above = bool(qqq_close > qqq_ema8)

    if spy_above and qqq_above:
        regime = "green"
        label = "Full size longs permitted"
    elif not spy_above and not qqq_above:
        regime = "red"
        label = "Cash mode for growth longs"
    else:
        regime = "yellow"
        label = "Half size, selective entries"

    result = {
        "date": today,
        "spy": {
            "close": round(spy_close, 2),
            "ema8": round(spy_ema8, 2),
            "distance_pct": round(spy_dist, 2),
            "above": spy_above,
            "52w_high": round(spy_52w_high, 2),
            "from_high_pct": round(spy_from_high, 2),
            "ytd_pct": round(spy_ytd, 2),
            "pct_1w": round(spy_1w, 2),
            "pct_1m": round(spy_1m, 2),
        },
        "qqq": {
            "close": round(qqq_close, 2),
            "ema8": round(qqq_ema8, 2),
            "distance_pct": round(qqq_dist, 2),
            "above": qqq_above,
            "52w_high": round(qqq_52w_high, 2),
            "from_high_pct": round(qqq_from_high, 2),
            "ytd_pct": round(qqq_ytd, 2),
            "pct_1w": round(qqq_1w, 2),
            "pct_1m": round(qqq_1m, 2),
        },
        "iwm_qqq": {
            "ratio": round(float(iwm_qqq_ratio), 4),
            "ratio_5d_change": round(float(ratio_change) * 100, 2),
            "risk_on": bool(ratio_change > 0),
        },
        "ibit": {
            "close": round(float(ibit_close), 2),
            "sma50": round(float(ibit_sma50), 2),
            "distance_pct": round(float(ibit_dist), 2),
            "above": bool(ibit_close > ibit_sma50),
        },
        "regime": regime,
        "label": label,
    }

    _save_cache({"date": today, **result})
    return result