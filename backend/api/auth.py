import os
from fastapi import Header, HTTPException


def require_api_key(x_api_key: str = Header(alias="X-API-Key", default="")):
    """Dependency that rejects requests without a valid API key."""
    expected = os.environ.get("JMN_API_KEY", "")
    if not expected or x_api_key != expected:
        raise HTTPException(status_code=403, detail="Forbidden")
