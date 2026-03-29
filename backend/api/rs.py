from fastapi import APIRouter
import yfinance as yf
import numpy as np
import json
import os

router = APIRouter(prefix="/api/rs", tags=["rs"])

NAMES_FILE = os.path.join(os.path.dirname(__file__), '..', 'ticker_names.json')


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


@router.get("")
def get_rs(tickers: str):
    symbols = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    if not symbols:
        return []

    all_symbols = list(set(symbols + ["SPY"]))

    # Fetch 3 months for richer candle charts; RS computed on last 25 sessions
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

    for ticker in symbols:
        try:
            if ticker not in closes.columns:
                continue
            prices = closes[ticker].dropna()
            if len(prices) < 10:
                continue

            spy_aligned = spy.loc[prices.index].dropna()
            prices = prices.loc[spy_aligned.index]

            # RS Ratio series (price / SPY)
            rs_ratio = prices / spy_aligned

            # Normalize to 100 at start of window
            rs_norm = (rs_ratio / rs_ratio.iloc[0]) * 100

            n = len(rs_norm)
            x = np.arange(n)

            # RS Slope over full window
            slope, _ = np.polyfit(x, rs_norm.values, 1)

            # 5d slope for bar color
            if n >= 5:
                slope_5d, _ = np.polyfit(x[-5:], rs_norm.values[-5:], 1)
            else:
                slope_5d = slope

            # RS Momentum — 10d ROC
            rs_mom = 0.0
            if len(rs_ratio) >= 11:
                rs_mom = float(((rs_ratio.iloc[-1] / rs_ratio.iloc[-11]) - 1) * 100)

            # Historical tail for RRG (last 5 days)
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

            # Build OHLC candles from the full 3-month window
            candles = []
            for ts in closes_all.index:
                try:
                    o = raw["Open"][ticker].loc[ts]
                    h = raw["High"][ticker].loc[ts]
                    l = raw["Low"][ticker].loc[ts]
                    c = raw["Close"][ticker].loc[ts]
                    if any(v != v for v in (o, h, l, c)):  # NaN check
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
            })
        except Exception:
            continue

    # Fetch names (cached)
    names = _fetch_names([r["ticker"] for r in results])
    for r in results:
        r["name"] = names.get(r["ticker"], r["ticker"])

    # Rank by rs_slope descending
    results.sort(key=lambda r: r["rs_slope"], reverse=True)
    for i, r in enumerate(results):
        r["rank"] = i + 1

    return results
