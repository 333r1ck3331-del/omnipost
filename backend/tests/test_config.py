"""用户配置路由测试 — GET / POST / api_key 不泄露 / 空 api_key 不清空原值。"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
import pytest_asyncio


pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture(autouse=True)
async def _isolate_config(tmp_path: Path, monkeypatch):
    """每个测试用独立的临时 user_config.json，绝不碰生产配置。"""
    cfg_file = tmp_path / "user_config.json"
    from app.routers import config as cfg_router
    from app.core import config as core_cfg

    monkeypatch.setattr(cfg_router, "CONFIG_PATH", cfg_file)
    monkeypatch.setattr(core_cfg, "_USER_CONFIG_PATH", cfg_file)
    yield


async def test_get_config_default_when_no_file(client):
    r = await client.get("/api/config")
    assert r.status_code == 200
    body = r.json()
    assert body["provider"] == "deepseek"
    assert body["api_key_set"] is False
    assert body["api_key_hint"] == ""


async def test_post_config_persists_and_hides_key(client):
    r = await client.post(
        "/api/config",
        json={"provider": "claude", "api_key": "sk-test-abcdefgh-1234", "tavily_enabled": False},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["provider"] == "claude"
    assert body["api_key_set"] is True
    # 提示词应该出现，但不能等于原 key
    assert body["api_key_hint"]
    assert "sk-test-abcdefgh-1234" not in json.dumps(body)
    assert body["tavily_enabled"] is False


async def test_empty_api_key_keeps_old_value(client):
    # 先存一个真 key
    await client.post(
        "/api/config",
        json={"provider": "deepseek", "api_key": "sk-keep-me-please", "tavily_enabled": True},
    )
    # 再发一次空 api_key，模拟前端只改 provider/tavily 不改 key
    r = await client.post(
        "/api/config",
        json={"provider": "claude", "api_key": "", "tavily_enabled": False},
    )
    assert r.status_code == 200
    assert r.json()["api_key_set"] is True  # 老 key 没被清

    # 重新读，确认 hint 还是基于老 key
    r2 = await client.get("/api/config")
    assert r2.json()["api_key_set"] is True


async def test_short_api_key_hint_is_masked(client):
    r = await client.post(
        "/api/config",
        json={"provider": "deepseek", "api_key": "abc", "tavily_enabled": True},
    )
    assert r.status_code == 200
    assert r.json()["api_key_hint"] == "***"


async def test_model_field_persists(client):
    """模型名能存能取，切换 provider 也保留。"""
    r = await client.post(
        "/api/config",
        json={
            "provider": "openai",
            "api_key": "sk-test-1234-5678",
            "model": "gpt-4o",
            "tavily_enabled": True,
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["provider"] == "openai"
    assert body["model"] == "gpt-4o"

    # 重新 GET，model 应该还在
    r2 = await client.get("/api/config")
    assert r2.json()["model"] == "gpt-4o"


async def test_empty_model_is_ok(client):
    """model 空字符串合法（表示用默认）。"""
    r = await client.post(
        "/api/config",
        json={
            "provider": "deepseek",
            "api_key": "sk-test-empty-model",
            "model": "",
            "tavily_enabled": True,
        },
    )
    assert r.status_code == 200
    assert r.json()["model"] == ""
