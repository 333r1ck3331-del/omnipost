"""User config router — persist AI model preference and search settings."""

import asyncio
import json
import logging
import os
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Reuse the path from core.config so it stays in sync
from app.core.config import _USER_CONFIG_PATH as CONFIG_PATH


class UserConfig(BaseModel):
    provider: str = "deepseek"
    api_key: str = ""
    model: str = ""  # 空 = 用 provider 默认
    tavily_enabled: bool = True
    auto_review: bool = False  # 自动改稿（费 token）
    style_samples: str = ""    # 用户的风格样本（注入到 prompt）


class UserConfigPublic(BaseModel):
    """Safe-for-frontend view — never exposes the real API key."""
    provider: str
    api_key_set: bool
    api_key_hint: str = ""
    model: str = ""
    tavily_enabled: bool
    auto_review: bool = False
    style_samples: str = ""


router = APIRouter(prefix="/api/config", tags=["config"])


def load_config() -> UserConfig:
    """Load user config from JSON file. Returns defaults if file missing."""
    if not CONFIG_PATH.exists():
        return UserConfig()
    try:
        return UserConfig(**json.loads(CONFIG_PATH.read_text(encoding="utf-8")))
    except (json.JSONDecodeError, OSError) as e:
        logger.warning("Failed to load user config: %s", e)
        return UserConfig()


def save_config(cfg: UserConfig) -> None:
    """Save user config atomically to JSON file with restricted permissions."""
    tmp = CONFIG_PATH.with_suffix(".json.tmp")
    tmp.write_text(cfg.model_dump_json(indent=2), encoding="utf-8")
    try:
        os.chmod(tmp, 0o600)
    except OSError:
        pass
    tmp.replace(CONFIG_PATH)


def _build_public(cfg: UserConfig) -> UserConfigPublic:
    k = cfg.api_key or ""
    if len(k) >= 8:
        hint = k[:4] + "***" + k[-4:]
    elif k:
        hint = "***"
    else:
        hint = ""
    return UserConfigPublic(
        provider=cfg.provider,
        api_key_set=bool(k),
        api_key_hint=hint,
        model=cfg.model,
        tavily_enabled=cfg.tavily_enabled,
        auto_review=cfg.auto_review,
        style_samples=cfg.style_samples,
    )


@router.get("", response_model=UserConfigPublic)
async def get_config():
    return _build_public(load_config())


@router.post("", response_model=UserConfigPublic)
async def update_config(cfg: UserConfig):
    # Empty api_key means "don't change" — prevents frontend from
    # accidentally clearing the key when it only knows api_key_set/hint.
    if not cfg.api_key:
        cfg.api_key = load_config().api_key
    await asyncio.to_thread(save_config, cfg)
    from app.core.config import reload_config
    await asyncio.to_thread(reload_config)
    logger.info("Config updated: provider=%s, tavily=%s", cfg.provider, cfg.tavily_enabled)
    return _build_public(cfg)
