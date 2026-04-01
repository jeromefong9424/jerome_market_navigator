from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import rs, tickers, holdings, claude, info

app = FastAPI(title="Jerome Market Navigator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "https://jeromefong9424.github.io",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rs.router)
app.include_router(tickers.router)
app.include_router(holdings.router)
app.include_router(claude.router)
app.include_router(info.router)
