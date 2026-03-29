from fastapi import APIRouter
import yfinance as yf
import numpy as np

router = APIRouter(prefix="/api/rs", tags=["rs"])


@router.get("")
def get_rs(tickers: str):
    symbols = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    if not symbols:
        return []

    all_symbols = list(set(symbols + ["SPY"]))

    # Fetch 40 days to guarantee 25 clean trading sessions
    raw = yf.download(
        all_symbols,
        period="40d",
        interval="1d",
        auto_adjust=True,
        progress=False,
    )

    if raw.empty:
        return []

    closes = raw["Close"].dropna(how="all").tail(25)

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

            results.append({
                "ticker":      ticker,
                "price":       round(float(prices.iloc[-1]), 2),
                "rs_slope":    round(float(slope), 4),
                "slope_5d":    round(float(slope_5d), 4),
                "rs_norm":     [round(float(v), 2) for v in rs_norm.values],
                "rs_strength": round(float(rs_norm.iloc[-1]), 2),
                "rs_momentum": round(rs_mom, 2),
                "tail":        tail,
            })
        except Exception:
            continue

    # Rank by rs_slope descending
    results.sort(key=lambda r: r["rs_slope"], reverse=True)
    for i, r in enumerate(results):
        r["rank"] = i + 1

    return results
