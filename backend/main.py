"""OmniPost — FastAPI backend entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from app.core.config import DEBUG
from app.core.database import init_db, async_session
from app.routers import ideas, config, library
from sqlalchemy import select, update
from app.models import ContentItem

logging.basicConfig(level=logging.INFO if DEBUG else logging.WARNING)
logger = logging.getLogger(__name__)


async def _recover_zombie_productions():
    """Recover items stuck in 'in_production' (e.g. process killed mid-LLM-call)."""
    try:
        async with async_session() as session:
            stmt = (
                update(ContentItem)
                .where(ContentItem.status == "in_production")
                .values(status="production_failed")
            )
            result = await session.execute(stmt)
            await session.commit()
            if result.rowcount:
                logger.warning(
                    f"Recovered {result.rowcount} zombie production(s) → production_failed"
                )
    except Exception:
        logger.exception("Zombie recovery failed (non-fatal)")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create DB tables, recover zombie productions. Shutdown: nothing yet."""
    logger.info("Creating database tables...")
    await init_db()
    await _recover_zombie_productions()
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
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc)},
    )


app.include_router(ideas.router)
app.include_router(config.router)
app.include_router(library.router)
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
