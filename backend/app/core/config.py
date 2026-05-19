"""Application configuration — env vars + user_config.json override.

Priority: user_config.json > .env > defaults.
Call reload_config() after writing user_config.json to apply changes without restart.
"""

import json
import logging
import os
from pathlib import Path
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Paths — from app/core/config.py, go up 2 levels to backend/
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
PROMPTS_DIR = os.path.join(_BASE_DIR, "prompts")
SCHEMAS_DIR = os.path.join(_BASE_DIR, "schemas")
CONFIG_DIR = os.path.join(_BASE_DIR, "config")
_USER_CONFIG_PATH = Path(_BASE_DIR).parent / "user_config.json"


def _load_user_config() -> dict:
    """Read user_config.json, return empty dict if missing or corrupt."""
    if not _USER_CONFIG_PATH.exists():
        return {}
    try:
        return json.loads(_USER_CONFIG_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        logger.warning(f"Failed to load user_config.json: {e}")
        return {}


def reload_config():
    """Re-read .env + user_config.json and update module-level attrs.

    Called by the config router after saving user_config.json, so
    downstream consumers (llm.py) pick up changes without restart.
    """
    global LLM_PROVIDER, LLM_API_KEY, LLM_MODEL
    global DEEPSEEK_BASE_URL, CLAUDE_BASE_URL
    global DATABASE_URL, SECRET_KEY, DEBUG
    global TAVILY_API_KEY, TAVILY_ENABLED

    load_dotenv(override=True)
    user_cfg = _load_user_config()

    # LLM — user_config overrides env
    LLM_PROVIDER = user_cfg.get("provider") or os.getenv("LLM_PROVIDER", "deepseek")
    LLM_API_KEY = user_cfg.get("api_key") or os.getenv("LLM_API_KEY", "")
    LLM_MODEL = os.getenv("LLM_MODEL", "deepseek-chat")

    DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
    CLAUDE_BASE_URL = os.getenv("CLAUDE_BASE_URL", "https://api.anthropic.com/v1")
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./omnipost.db")
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
    DEBUG = os.getenv("DEBUG", "true").lower() == "true"

    # Search — user_config tavily_enabled overrides env
    if "tavily_enabled" in user_cfg:
        TAVILY_ENABLED = bool(user_cfg["tavily_enabled"])
    else:
        TAVILY_ENABLED = os.getenv("TAVILY_ENABLED", "true").lower() == "true"
    TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")

    logger.info(
        f"Config reloaded: provider={LLM_PROVIDER}, "
        f"tavily={TAVILY_ENABLED}, model={LLM_MODEL}"
    )


# Initial load
load_dotenv()
user_cfg = _load_user_config()

LLM_PROVIDER = user_cfg.get("provider") or os.getenv("LLM_PROVIDER", "deepseek")
LLM_API_KEY = user_cfg.get("api_key") or os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "deepseek-chat")

DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
CLAUDE_BASE_URL = os.getenv("CLAUDE_BASE_URL", "https://api.anthropic.com/v1")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./omnipost.db")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
DEBUG = os.getenv("DEBUG", "true").lower() == "true"

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")
if "tavily_enabled" in user_cfg:
    TAVILY_ENABLED = bool(user_cfg["tavily_enabled"])
else:
    TAVILY_ENABLED = os.getenv("TAVILY_ENABLED", "true").lower() == "true"
