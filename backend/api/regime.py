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

    # Serve stale cache on any error
    try:
        tickers = ["SPY", "QQQ", "IWM", "IBIT"]
        raw = yf.download(tickers, period="1y", interval="1d", auto_adjust=True, progress=False)

        if raw.empty:
            raise ValueError("yfinance returned empty data")

        closes = raw["Close"].dropna()
        if closes.empty or "SPY" not in closes.columns:
            raise ValueError("SPY not in price data")

        # Flatten to 1D — yf.download returns (n, 1) DataFrame
        def flat(col: str) -> np.ndarray:
            vals = closes[col].values
            return vals.flatten() if vals.ndim > 1 else vals

        spy_arr = flat("SPY")
        qqq_arr = flat("QQQ")
        spy_close = float(spy_arr[-1])
        qqq_close = float(qqq_arr[-1])
        ibit_arr = flat("IBIT")
        ibit_close = float(ibit_arr[-1])

        spy_ema8 = ema(spy_arr, 8)
        qqq_ema8 = ema(qqq_arr, 8)
        spy_dist = ((spy_close / spy_ema8) - 1) * 100 if spy_ema8 and not np.isnan(spy_ema8) else 0
        qqq_dist = ((qqq_close / qqq_ema8) - 1) * 100 if qqq_ema8 and not np.isnan(qqq_ema8) else 0

        ibit_sma50 = sma(ibit_arr, 50)
        ibit_dist = ((ibit_close / ibit_sma50) - 1) * 100 if ibit_sma50 and not np.isnan(ibit_sma50) else 0

        spy_52w_high = float(np.nanmax(spy_arr[-252:])) if len(spy_arr) >= 252 else float(np.nanmax(spy_arr))
        qqq_52w_high = float(np.nanmax(qqq_arr[-252:])) if len(qqq_arr) >= 252 else float(np.nanmax(qqq_arr))
        spy_from_high = ((spy_close / spy_52w_high) - 1) * 100
        qqq_from_high = ((qqq_close / qqq_52w_high) - 1) * 100

        current_year = date.today().year
        ytd_start_spy = None
        ytd_start_qqq = None
        for i, idx in enumerate(closes.index):
            if idx.year == current_year:
                ytd_start_spy = float(flat("SPY")[i])
                ytd_start_qqq = float(flat("QQQ")[i])
                break
        spy_ytd = ((spy_close / ytd_start_spy) - 1) * 100 if ytd_start_spy else 0
        qqq_ytd = ((qqq_close / ytd_start_qqq) - 1) * 100 if ytd_start_qqq else 0

        n = len(spy_arr)
        spy_1w = ((spy_close / float(spy_arr[-6])) - 1) * 100 if n >= 6 else 0
        qqq_1w = ((qqq_close / float(qqq_arr[-6])) - 1) * 100 if n >= 6 else 0
        spy_1m = ((spy_close / float(spy_arr[-22])) - 1) * 100 if n >= 22 else 0
        qqq_1m = ((qqq_close / float(qqq_arr[-22])) - 1) * 100 if n >= 22 else 0

        iwm_arr = flat("IWM")
        iwm_20d = float(np.nanmean(iwm_arr[-20:])) if len(iwm_arr) >= 20 else float(np.nanmean(iwm_arr))
        qqq_20d_mean = float(np.nanmean(qqq_arr[-20:])) if len(qqq_arr) >= 20 else float(np.nanmean(qqq_arr))
        iwm_qqq_ratio = iwm_20d / qqq_20d_mean if qqq_20d_mean else 1
        iwm_qqq_ratio_5d = float(np.nanmean(iwm_arr[-25:-20])) / (float(np.nanmean(qqq_arr[-25:-20])) if len(qqq_arr) >= 25 else 1) if len(iwm_arr) >= 25 else iwm_qqq_ratio
        ratio_change = iwm_qqq_ratio / iwm_qqq_ratio_5d - 1 if iwm_qqq_ratio_5d else 0

        spy_above = bool(spy_close > spy_ema8) if spy_ema8 and not np.isnan(spy_ema8) else False
        qqq_above = bool(qqq_close > qqq_ema8) if qqq_ema8 and not np.isnan(qqq_ema8) else False

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
                "close": round(spy_close, 2), "ema8": round(spy_ema8, 2) if spy_ema8 and not np.isnan(spy_ema8) else 0,
                "distance_pct": round(spy_dist, 2), "above": spy_above,
                "52w_high": round(spy_52w_high, 2), "from_high_pct": round(spy_from_high, 2),
                "ytd_pct": round(spy_ytd, 2), "pct_1w": round(spy_1w, 2), "pct_1m": round(spy_1m, 2),
            },
            "qqq": {
                "close": round(qqq_close, 2), "ema8": round(qqq_ema8, 2) if qqq_ema8 and not np.isnan(qqq_ema8) else 0,
                "distance_pct": round(qqq_dist, 2), "above": qqq_above,
                "52w_high": round(qqq_52w_high, 2), "from_high_pct": round(qqq_from_high, 2),
                "ytd_pct": round(qqq_ytd, 2), "pct_1w": round(qqq_1w, 2), "pct_1m": round(qqq_1m, 2),
            },
            "iwm_qqq": {
                "ratio": round(float(iwm_qqq_ratio), 4),
                "ratio_5d_change": round(float(ratio_change) * 100, 2),
                "risk_on": bool(ratio_change > 0),
            },
            "ibit": {
                "close": round(float(ibit_close), 2),
                "sma50": round(float(ibit_sma50), 2) if ibit_sma50 and not np.isnan(ibit_sma50) else 0,
                "distance_pct": round(float(ibit_dist), 2),
                "above": bool(ibit_close > ibit_sma50) if ibit_sma50 and not np.isnan(ibit_sma50) else False,
            },
            "regime": regime, "label": label,
        }

        _save_cache(result)
        return result

    except Exception as e:
        # Fall back to stale cache on any error
        stale = _load_cache()
        if stale.get("date") and stale.get("regime"):
            stale["_error"] = f"Falling back to cache ({e})"
            return stale
        # Last-resort static response
        return {
            "date": today, "regime": "yellow", "label": "Data unavailable",
            "spy": {"close": 0, "ema8": 0, "distance_pct": 0, "above": False, "52w_high": 0, "from_high_pct": 0, "ytd_pct": 0, "pct_1w": 0, "pct_1m": 0},
            "qqq": {"close": 0, "ema8": 0, "distance_pct": 0, "above": False, "52w_high": 0, "from_high_pct": 0, "ytd_pct": 0, "pct_1w": 0, "pct_1m": 0},
            "iwm_qqq": {"ratio": 1, "ratio_5d_change": 0, "risk_on": True},
            "ibit": {"close": 0, "sma50": 0, "distance_pct": 0, "above": False},
        }