import yfinance as yf
from fastapi import APIRouter

router = APIRouter(prefix="/api/info", tags=["info"])

# In-memory cache — lives for the process lifetime (plenty for a local terminal)
_cache: dict[str, dict] = {}


def _truncate(text: str, sentences: int = 2) -> str:
    """Keep the first N sentences of a long summary."""
    parts = text.replace("  ", " ").split(". ")
    return ". ".join(parts[:sentences]).strip() + ("." if len(parts) > sentences else "")


@router.get("")
def get_info(ticker: str):
    """Return a short company description, sector, and industry for a ticker."""
    t = ticker.strip().upper()
    if t in _cache:
        return _cache[t]

    try:
        info = yf.Ticker(t).info
        result = {
            "ticker":   t,
            "name":     info.get("longName") or info.get("shortName") or t,
            "sector":   info.get("sector") or info.get("categoryName") or "",
            "industry": info.get("industry") or "",
            "summary":  _truncate(info.get("longBusinessSummary") or "", 2),
        }
    except Exception:
        result = {"ticker": t, "name": t, "sector": "", "industry": "", "summary": ""}

    _cache[t] = result
    return result
