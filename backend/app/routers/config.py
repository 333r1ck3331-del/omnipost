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
    tavily_enabled: bool = True


class UserConfigPublic(BaseModel):
    """Safe-for-frontend view — never exposes the real API key."""
    provider: str
    api_key_set: bool
    api_key_hint: str = ""
    tavily_enabled: bool


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
        tavily_enabled=cfg.tavily_enabled,
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
