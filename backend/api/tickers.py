import json
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

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


@router.post("/groups")
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


@router.delete("/groups/{name}")
def delete_group(name: str):
    groups = _load()
    if name not in groups:
        raise HTTPException(404, "Group not found")
    del groups[name]
    _save(groups)
    return groups


@router.post("/groups/{name}/tickers")
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


@router.delete("/groups/{name}/tickers/{ticker}")
def remove_ticker(name: str, ticker: str):
    groups = _load()
    if name not in groups:
        raise HTTPException(404, "Group not found")
    ticker = ticker.upper()
    groups[name] = [t for t in groups[name] if t != ticker]
    _save(groups)
    return groups
