"""Application configuration from environment variables."""

import os
from dotenv import load_dotenv

load_dotenv()

# LLM
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "deepseek")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "deepseek-chat")

# DeepSeek
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")

# Claude
CLAUDE_BASE_URL = os.getenv("CLAUDE_BASE_URL", "https://api.anthropic.com/v1")

# Database
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./omnipost.db")

# App
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
DEBUG = os.getenv("DEBUG", "true").lower() == "true"

# Search
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")

# Paths — from app/core/config.py, go up 2 levels to backend/
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
PROMPTS_DIR = os.path.join(_BASE_DIR, "prompts")
SCHEMAS_DIR = os.path.join(_BASE_DIR, "schemas")
CONFIG_DIR = os.path.join(_BASE_DIR, "config")
