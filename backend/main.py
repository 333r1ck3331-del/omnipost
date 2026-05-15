"""OmniPost — FastAPI backend entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import DEBUG
from app.core.database import init_db
from app.routers import ideas

logging.basicConfig(level=logging.INFO if DEBUG else logging.WARNING)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create DB tables. Shutdown: nothing yet."""
    logger.info("Creating database tables...")
    await init_db()
    logger.info("OmniPost backend ready.")
    yield


app = FastAPI(
    title="OmniPost",
    description="全平台 AI 内容运营系统 — 后端 API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ideas.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
