"""User config router — persist AI model preference and search settings."""

import json
import logging
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger(__name__)

CONFIG_PATH = Path(__file__).resolve().parents[3] / "user_config.json"


class UserConfig(BaseModel):
    provider: str = "deepseek"
    api_key: str = ""
    tavily_enabled: bool = True


router = APIRouter(prefix="/api/config", tags=["config"])


def load_config() -> UserConfig:
    """Load user config from JSON file. Returns defaults if file missing."""
    if not CONFIG_PATH.exists():
        return UserConfig()
    try:
        return UserConfig(**json.loads(CONFIG_PATH.read_text(encoding="utf-8")))
    except (json.JSONDecodeError, OSError) as e:
        logger.warning(f"Failed to load user config: {e}")
        return UserConfig()


def save_config(cfg: UserConfig) -> None:
    """Save user config atomically to JSON file."""
    tmp = CONFIG_PATH.with_suffix(".json.tmp")
    tmp.write_text(cfg.model_dump_json(indent=2), encoding="utf-8")
    tmp.replace(CONFIG_PATH)


@router.get("", response_model=UserConfig)
def get_config():
    return load_config()


@router.post("", response_model=UserConfig)
def update_config(cfg: UserConfig):
    save_config(cfg)
    logger.info(f"Config updated: provider={cfg.provider}, tavily={cfg.tavily_enabled}")
    return cfg
