"""Pytest fixtures: isolated SQLite, mocked LLM/search, ASGI client.

Each test session uses a throw-away SQLite file so we never touch the
production DB. LLM and Tavily calls are stubbed so tests run offline in
under a second.
"""

from __future__ import annotations

import os
import sys
import pathlib

# Point DATABASE_URL at a fresh test file BEFORE the app modules import config.
_BACKEND_DIR = pathlib.Path(__file__).resolve().parent.parent
_TEST_DB_PATH = _BACKEND_DIR / "test_omnipost.db"
if _TEST_DB_PATH.exists():
    _TEST_DB_PATH.unlink()
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_TEST_DB_PATH}"
os.environ["TAVILY_ENABLED"] = "false"  # never hit network from tests

sys.path.insert(0, str(_BACKEND_DIR))

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from app.core.database import init_db, engine
from app.services import agents as agents_module
import main as main_module


# ── Fakes ─────────────────────────────────────────────────────────────

async def _fake_value_judge(idea: str) -> dict:
    return {
        "score": 78,
        "details": {"overall": 78, "verdict": "ok"},
        "token_usage": {"prompt_tokens": 1, "completion_tokens": 1},
        "latency_ms": 1,
        "search_used": False,
    }


async def _fake_production(idea: str, selected_types=None, brief: str = "", scene: str | None = None) -> dict:
    selected_types = selected_types or ["gzh"]
    out = {
        "content_gzh": None,
        "content_xhs": None,
        "content_video_script": None,
        "content_bilibili": None,
        "title_suggestions": ["标题A", "标题B", "标题C"],
        "image_plans": None,
        "video_storyboard": None,
        "production_raw": {"_fake": True},
    }
    payload = {
        "gzh": ("content_gzh", f"[gzh]{idea}"),
        "xhs": ("content_xhs", f"[xhs]{idea}"),
        "video": ("content_video_script", f"[video]{idea}"),
        "bilibili": ("content_bilibili", f"[bilibili]{idea}"),
    }
    for t in selected_types:
        field, val = payload[t]
        out[field] = val
    return out


async def _fake_distribution(idea: str, **kwargs) -> dict:
    return {"strategy": {"summary": "fake distribution", "platforms": []}}


async def _fake_title_optimization(idea: str, existing=None) -> dict:
    return {"titles": ["新标题1", "新标题2", "新标题3"]}


async def _fake_review(platform_label: str, draft: str, idea: str = "", scene: str | None = None) -> dict:
    """Reviewer 永远把草稿前面拼一段「[改稿] 」并报 1 个挑刺。"""
    rewritten = f"[改稿]{draft}"
    return {
        "issues": [{"quote": draft[:10], "problem": "AI 腔太重"}],
        "rewritten": rewritten,
        "changed": True,
        "token_usage": {"prompt_tokens": 1, "completion_tokens": 1},
        "error": None,
    }


# ── Session-scoped setup ──────────────────────────────────────────────

@pytest_asyncio.fixture(scope="session", autouse=True)
async def _setup_db():
    """Create tables once before the test session, drop the engine after."""
    await init_db()
    yield
    await engine.dispose()


@pytest.fixture(autouse=True)
def _mock_llm(monkeypatch):
    """Patch BOTH the services module AND the router-bound aliases.

    The router does `from app.services.agents import run_value_judge`,
    so the name `app.routers.ideas.run_value_judge` is bound at import
    time and must be patched separately.
    """
    monkeypatch.setattr(agents_module, "run_value_judge", _fake_value_judge)
    monkeypatch.setattr(agents_module, "run_content_production", _fake_production)
    monkeypatch.setattr(agents_module, "run_distribution_strategy", _fake_distribution)
    monkeypatch.setattr(agents_module, "run_title_optimization", _fake_title_optimization)
    monkeypatch.setattr(agents_module, "run_content_review", _fake_review)

    from app.services import idea_workflow as wf
    monkeypatch.setattr(wf, "run_value_judge", _fake_value_judge)
    monkeypatch.setattr(wf, "run_content_production", _fake_production)
    monkeypatch.setattr(wf, "run_distribution_strategy", _fake_distribution)
    monkeypatch.setattr(wf, "run_title_optimization", _fake_title_optimization)
    monkeypatch.setattr(wf, "run_content_review", _fake_review)


@pytest_asyncio.fixture
async def client():
    """Async HTTP client wired to the ASGI app — no real network."""
    transport = ASGITransport(app=main_module.app)
    async with AsyncClient(transport=transport, base_url="http://test", timeout=30) as c:
        yield c
