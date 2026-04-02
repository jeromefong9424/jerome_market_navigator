import json
import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import yfinance as yf
from .auth import require_api_key

router = APIRouter(prefix="/api/tickers", tags=["tickers"])

TICKERS_FILE = os.path.join(os.path.dirname(__file__), '..', 'tickers.json')

DEFAULT_GROUPS = {
    "Sector ETFs": ["XLI", "XLK", "XLU", "XLRE", "XLY", "XLV", "XLB", "SMH", "XLE", "XLF", "XLP"],
    "AI Plays": ["NVDA", "MSFT", "META", "GOOGL", "AMZN", "AMD", "TSLA"],
}


def _load() -> dict:
    if not os.path.exists(TICKERS_FILE):
        _save(DEFAULT_GROUPS)
        return DEFAULT_GROUPS
    with open(TICKERS_FILE) as f:
        return json.load(f)


def _save(groups: dict):
    with open(TICKERS_FILE, 'w') as f:
        json.dump(groups, f, indent=2)


class GroupCreate(BaseModel):
    name: str


class TickerAdd(BaseModel):
    ticker: str


@router.get("")
def get_groups():
    return _load()


@router.post("/groups", dependencies=[Depends(require_api_key)])
def create_group(body: GroupCreate):
    groups = _load()
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Group name required")
    if name in groups:
        raise HTTPException(400, "Group already exists")
    groups[name] = []
    _save(groups)
    return groups


@router.delete("/groups/{name}", dependencies=[Depends(require_api_key)])
def delete_group(name: str):
    groups = _load()
    if name not in groups:
        raise HTTPException(404, "Group not found")
    del groups[name]
    _save(groups)
    return groups


@router.post("/groups/{name}/tickers", dependencies=[Depends(require_api_key)])
def add_ticker(name: str, body: TickerAdd):
    groups = _load()
    if name not in groups:
        raise HTTPException(404, "Group not found")
    ticker = body.ticker.strip().upper()
    if not ticker:
        raise HTTPException(400, "Ticker required")
    if ticker not in groups[name]:
        groups[name].append(ticker)
        _save(groups)
    return groups


@router.delete("/groups/{name}/tickers/{ticker}", dependencies=[Depends(require_api_key)])
def remove_ticker(name: str, ticker: str):
    groups = _load()
    if name not in groups:
        raise HTTPException(404, "Group not found")
    ticker = ticker.upper()
    groups[name] = [t for t in groups[name] if t != ticker]
    _save(groups)
    return groups


class ScanHoldingsRequest(BaseModel):
    group: str
    top_n: int = 5


@router.post("/scan-holdings", dependencies=[Depends(require_api_key)])
def scan_holdings(body: ScanHoldingsRequest):
    """For each ETF in the group, fetch top N holdings and save as a new group."""
    groups = _load()
    if body.group not in groups:
        raise HTTPException(404, "Group not found")

    etfs = groups[body.group]
    created = []

    for etf in etfs:
        try:
            holdings_df = yf.Ticker(etf).funds_data.top_holdings
            symbols = holdings_df.index.tolist()[:body.top_n]
            if not symbols:
                continue
            group_name = f"{etf} Holdings"
            groups[group_name] = [s.upper() for s in symbols]
            created.append(group_name)
        except Exception:
            continue

    if not created:
        raise HTTPException(400, "No holdings found — tickers may not be ETFs")

    _save(groups)
    return {"created": created, "groups": groups}
