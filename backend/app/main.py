from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import auth, demo
from app.config import settings
from app.db import Base, engine
from app.routers import collections, send

# Three small tables, so create_all on startup instead of a migration tool
Base.metadata.create_all(engine)

app = FastAPI(title="APIForge API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(collections.router)
app.include_router(send.router)
app.include_router(demo.router)


@app.get("/health")
def health() -> dict:
    return {"ok": True}
