import os
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/claude", tags=["claude"])

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"


@router.post("")
async def proxy_claude(payload: dict[str, Any]):
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured on server")

    async with httpx.AsyncClient(timeout=90.0) as client:
        res = await client.post(
            ANTHROPIC_URL,
            headers={
                "x-api-key":         api_key,
                "anthropic-version": "2023-06-01",
                "content-type":      "application/json",
            },
            json=payload,
        )

    if res.status_code != 200:
        raise HTTPException(status_code=res.status_code, detail=res.text)

    return res.json()
