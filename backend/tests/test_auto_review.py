"""自动改稿（auto_review）开关测试 — 开/关分别影响 produce 输出。"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
import pytest_asyncio


pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture(autouse=True)
async def _isolate_config(tmp_path: Path, monkeypatch):
    cfg_file = tmp_path / "user_config.json"
    from app.routers import config as cfg_router
    from app.core import config as core_cfg

    monkeypatch.setattr(cfg_router, "CONFIG_PATH", cfg_file)
    monkeypatch.setattr(core_cfg, "_USER_CONFIG_PATH", cfg_file)
    yield


async def _make_and_approve(client) -> str:
    r = await client.post("/api/ideas", json={"idea_text": "测试点子"})
    iid = r.json()["id"]
    await client.post(f"/api/ideas/{iid}/gate1/approve")
    return iid


async def test_auto_review_off_keeps_original_content(client):
    iid = await _make_and_approve(client)
    r = await client.post(f"/api/ideas/{iid}/produce", json={"types": ["gzh"]})
    assert r.status_code == 200
    body = r.json()
    # auto_review 默认关 → 不应该出现「[改稿]」前缀，review_log 也是空
    assert "[改稿]" not in (body.get("content_gzh") or "")
    assert not body.get("review_log")


async def test_auto_review_on_rewrites_content_and_logs(client):
    # 开关打开
    await client.post(
        "/api/config",
        json={
            "provider": "deepseek",
            "api_key": "sk-x",
            "tavily_enabled": False,
            "auto_review": True,
        },
    )

    iid = await _make_and_approve(client)
    r = await client.post(f"/api/ideas/{iid}/produce", json={"types": ["gzh", "xhs"]})
    assert r.status_code == 200, r.text
    body = r.json()
    # 两条都应被「[改稿]」前缀重写
    assert body["content_gzh"].startswith("[改稿]")
    assert body["content_xhs"].startswith("[改稿]")
    log = body.get("review_log") or {}
    assert log.get("gzh", {}).get("changed") is True
    assert log.get("xhs", {}).get("changed") is True
    assert len(log["gzh"]["issues"]) >= 1
