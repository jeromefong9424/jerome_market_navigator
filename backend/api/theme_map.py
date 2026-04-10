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


FALLBACK_DATA = {
    "date": "2026-04-05",
    "themes": [
        {
            "id": "oil_gas",
            "demand_driver": "Energy sector rotation",
            "catalyst": "Tactical energy allocation as macro uncertainty persists. Oil equities compressing with improving supply discipline.",
            "branches": [
                {"name": "Major Integrated", "status": "running", "tickers": ["XOM", "CVX", "COP"], "mapped_etf": "XLE", "note": "Cap-weighted majors leading the energy trade."},
                {"name": "Oil Services", "status": "setting_up", "tickers": ["SLB", "HAL", "BKR", "NOV"], "mapped_etf": None, "note": "Picking up as capex cycle revives."},
                {"name": "Tanker / Shipping", "status": "early", "tickers": ["FRO", "STNG", "INSW"], "mapped_etf": None, "note": "VLCC rates strengthening on seasonal demand."},
            ]
        },
        {
            "id": "ai_datacenter",
            "demand_driver": "AI infrastructure buildout",
            "catalyst": "Hyperscaler capex accelerating. Power demand for data centers at multi-year highs.",
            "branches": [
                {"name": "Optical / Networking", "status": "running", "tickers": ["AAOI", "GLW", "FSLY", "LITE", "CIEN"], "mapped_etf": None, "note": "Bandwidth demand driving optical spend."},
                {"name": "Cooling / Infra", "status": "setting_up", "tickers": ["VRT", "GNRC"], "mapped_etf": None, "note": "AI cluster cooling infrastructure demand."},
                {"name": "Memory / Storage", "status": "running", "tickers": ["MU", "WDC", "SNDK"], "mapped_etf": None, "note": "HBM and NAND demand from AI servers."},
            ]
        },
        {
            "id": "nuclear_uranium",
            "demand_driver": "Nuclear power renaissance",
            "catalyst": "AI data center power demand driving nuclear PPAs. SMR regulatory tailwinds.",
            "branches": [
                {"name": "Uranium Miners", "status": "running", "tickers": ["CCJ", "UROY", "DNN"], "mapped_etf": "URNM", "note": "U3O8 spot price trending higher."},
                {"name": "Nuclear Utilities", "status": "running", "tickers": ["VST", "CEG", "NRG"], "mapped_etf": "NLR", "note": "Power consumers locking in long-term nuclear contracts."},
            ]
        },
        {
            "id": "semis",
            "demand_driver": "AI chip cycle",
            "catalyst": "Custom ASIC ramp. CoWoS packaging bottleneck easing. AI accelerator demand insatiable.",
            "branches": [
                {"name": "Semiconductor Equipment", "status": "running", "tickers": ["ASML", "LRCX", "AMAT"], "mapped_etf": "SMH", "note": "Leading edge logic equipment strongest."},
            ]
        },
        {
            "id": "cyber",
            "demand_driver": "Endpoint security + AI threats",
            "catalyst": "Ransomware incidents rising. AI-generated phishing accelerating security spend.",
            "branches": [
                {"name": "Cyber Security", "status": "running", "tickers": ["CRWD", "PANW", "ZS"], "mapped_etf": "CIBR", "note": "Cloud-native security platforms gaining share."},
            ]
        },
    ],
    "briefing": {
        "regime": "Market in a digest phase. Leadership rotating from broad tech into selective themes. Watch for trend-confirmation breaks.",
        "hottest": "1) AI Data Center: power infra + networking 2) Nuclear/Uranium: SMR regulatory catalyst + data center demand 3) Energy: oil services recovering as capex cycle turns",
        "gaps": "Optical networking (AAOI, LITE), tanker shipping (FRO, STNG), GLP-1 supply chain (LLY, NOVO) — no ETF coverage for these high-beta movers",
        "avoid": "Broad emerging market exposure. Rising rate headwinds. Rate-sensitive REITs under pressure."
    }
}


@router.get("")
def get_theme_map():
    cache = _load_cache()
    today_str = date.today().isoformat()

    # Serve freshest cache (always save it)
    if cache.get("date"):
        cached_date = cache.get("date", "")
        try:
            cached_ts = date.fromisoformat(cached_date)
            today = date.today()
            if (today - cached_ts).days < 1:
                cache["_source"] = "cache"
                return cache
        except Exception:
            pass

    # Build the prompt
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
          "mapped_etf": "XLE or null",
          "note": "1 sentence context"
        }}
      ]
    }}
  ],
  "briefing": {{
    "regime": "2-3 sentences on market posture",
    "hottest": "Top 3 themes and why",
    "gaps": "What is hot that the ETF list cannot see",
    "avoid": "What not to trade right now and why"
  }}
}}"""

    try:
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        if not api_key:
            result = FALLBACK_DATA.copy()
            result["date"] = today_str
            result["_source"] = "fallback"
            _save_cache(result)
            return result

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
            result = FALLBACK_DATA.copy()
            result["date"] = today_str
            result["_source"] = "fallback"
            _save_cache(result)
            return result

        response_data = res.json()
        raw = ""
        for block in response_data.get("content", []):
            if block.get("type") == "text":
                raw += block["text"]

        if not raw:
            result = FALLBACK_DATA.copy()
            result["date"] = today_str
            result["_source"] = "fallback"
            _save_cache(result)
            return result

        start = raw.index('{')
        end = raw.rindex('}') + 1
        data = json.loads(raw[start:end])
        data["date"] = today_str
        data["_source"] = "live"
        _save_cache(data)
        return data

    except Exception:
        result = FALLBACK_DATA.copy()
        result["date"] = today_str
        result["_source"] = "fallback"
        _save_cache(result)
        return result