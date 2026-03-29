from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import rs, tickers, holdings

app = FastAPI(title="Jerome Market Navigator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:5174",
        "https://jeromefong9424.github.io",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rs.router)
app.include_router(tickers.router)
app.include_router(holdings.router)
