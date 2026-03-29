from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import rs

app = FastAPI(title="Jerome Market Navigator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rs.router)
