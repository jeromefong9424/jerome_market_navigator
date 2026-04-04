import os
import json
from datetime import date
from fastapi import APIRouter
import httpx

router = APIRouter(prefix="/api/theme-map", tags=["theme-map"])

CACHE_FILE = os.path.join(os.path.dirname(__file__), '..', 'theme_map_cache.json')


def _load_cache() -> dict:
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE) as f:
            return json.load(f)
    return {}


def _save_cache(data: dict):
    with open(CACHE_FILE, 'w') as f:
        json.dump(data, f, indent=2)


@router.get("")
def get_theme_map():
    cache = _load_cache()
    today_str = date.today().isoformat()

    # Cache valid for 7 days
    if cache.get("date") == today_str:
        return cache

    # If we have a recent cache (within 7 days), serve it
    cached_date = cache.get("date", "")
    if cached_date:
        try:
            cached = date.fromisoformat(cached_date)
            today = date.today()
            if (today - cached).days < 7:
                return cache
        except Exception:
            pass

    # Build the prompt
    today_str = date.today().isoformat()
    prompt = f"""You are a macro theme analyst for a US equity momentum swing trader.

Today's date: {today_str}

Search the web for current market-moving events, strongest performing sectors,
major policy or geopolitical developments, and commodity moves.

Identify the top 5 active demand drivers creating institutional money flows right now.

For each demand driver, map the supply chain branches — the categories of stocks
that benefit from this demand. For each branch, list 3-5 specific tickers that are
leaders or potential leaders. Rate each branch status.

Also identify branches where a standard sector ETF does not exist
(e.g., optical networking, drones, tanker shipping, GLP-1).

The trader tracks these ETFs: XLK, XLE, XLF, XLV, XLI, XLY, XLP, XLU, XLB, XLRE,
XOP, ITA, XHB, ITB, XRT, IBB, SMH, GDX, GDXJ, GLD, SLV, COPX, REMX, MOO, PHO,
JETS, XBI, FCG, AIQ, DTCR, CLOU, WCLD, ARKW, BOTZ, HUMN, UFO, ARKX, SHLD, CIBR,
HACK, URNM, NLR, GRID, ICLN, LIT, DRIV, PAVE, FINX, IBIT, BKCH, ARKG, ARKK, ARKQ

For each branch, note whether any of these ETFs provide coverage. If not, flag it
as a coverage gap.

Output ONLY valid JSON, no markdown, no preamble:
{{
  "date": "YYYY-MM-DD",
  "themes": [
    {{
      "id": "theme_id_matching_themeGroups_config",
      "demand_driver": "Short title",
      "catalyst": "2-3 sentence explanation",
      "branches": [
        {{
          "name": "Branch name",
          "status": "running | setting_up | early | extended | correcting",
          "tickers": ["SYM1", "SYM2", "SYM3"],
          "mapped_etf": "XLE or null if no ETF covers this",
          "note": "1 sentence context"
        }}
      ]
    }}
  ],
  "briefing": {{
    "regime": "2-3 sentences on market posture",
    "hottest": "Top 3 themes and why, 2-3 sentences each",
    "gaps": "What is hot that the trader's ETF list cannot see",
    "avoid": "What not to trade right now and why"
  }}
}}"""

    try:
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        if not api_key:
            if cache:
                return cache
            return {"date": today_str, "themes": [], "briefing": {"regime": "No API key configured.", "hottest": "", "gaps": "", "avoid": ""}}

        payload = {
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 4096,
            "tools": [{"name": "web_search_20250305", "type": "web_search_20250305"}],
            "messages": [{"role": "user", "content": prompt}],
        }

        with httpx.Client(timeout=90.0) as client:
            res = client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json=payload,
            )

        if res.status_code != 200:
            if cache:
                return cache
            return {"date": today_str, "themes": [], "briefing": {"regime": f"AI API error {res.status_code}.", "hottest": "", "gaps": "", "avoid": ""}}

        response_data = res.json()
        raw = ""
        for block in response_data.get("content", []):
            if block.get("type") == "text":
                raw += block["text"]

        if not raw:
            if cache:
                return cache
            return {"date": today_str, "themes": [], "briefing": {"regime": "Empty response from AI.", "hottest": "", "gaps": "", "avoid": ""}}

        # Parse JSON robustly
        start = raw.index('{')
        end = raw.rindex('}') + 1
        data = json.loads(raw[start:end])
        data["date"] = today_str
        _save_cache(data)
        return data

    except Exception:
        # If AI call fails, return cached data if available
        if cache:
            return cache
        return {
            "date": today_str,
            "themes": [],
            "briefing": {
                "regime": "Unable to fetch AI briefing. Check API key or network connection.",
                "hottest": "",
                "gaps": "",
                "avoid": ""
            }
        }