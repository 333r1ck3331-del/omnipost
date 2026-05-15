"""LLM API calls — supports DeepSeek and Claude."""

import json
import time
import httpx
from app.core.config import (
    LLM_PROVIDER,
    LLM_API_KEY,
    LLM_MODEL,
    DEEPSEEK_BASE_URL,
    CLAUDE_BASE_URL,
)


class LLMError(Exception):
    pass


async def call_llm(prompt: str, system_prompt: str | None = None) -> dict:
    """Call the configured LLM and return {content, usage}.

    Returns:
        {"content": str, "usage": {"input": int, "output": int, "model": str}}
    """
    if not LLM_API_KEY or LLM_API_KEY == "sk-your-key-here":
        raise LLMError("API Key 未配置。请在 backend/.env 中设置 LLM_API_KEY。")

    if LLM_PROVIDER == "deepseek":
        return await _call_deepseek(prompt, system_prompt)
    elif LLM_PROVIDER == "claude":
        return await _call_claude(prompt, system_prompt)
    else:
        raise LLMError(f"不支持的 LLM provider: {LLM_PROVIDER}")


async def _call_deepseek(prompt: str, system_prompt: str | None = None) -> dict:
    """Call DeepSeek API (OpenAI-compatible)."""
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    body = {
        "model": LLM_MODEL,
        "messages": messages,
        "max_tokens": 8000,
    }

    # deepseek-chat supports json_object mode
    if LLM_MODEL == "deepseek-chat":
        body["response_format"] = {"type": "json_object"}
        body["temperature"] = 0.85

    t0 = time.monotonic()
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{DEEPSEEK_BASE_URL}/chat/completions",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {LLM_API_KEY}",
            },
            json=body,
        )
    latency = (time.monotonic() - t0) * 1000

    if resp.status_code != 200:
        raise LLMError(f"DeepSeek API 错误 ({resp.status_code}): {resp.text[:300]}")

    data = resp.json()
    content = data["choices"][0]["message"]["content"]
    usage = data.get("usage", {})

    return {
        "content": content,
        "usage": {
            "input": usage.get("prompt_tokens", 0),
            "output": usage.get("completion_tokens", 0),
            "model": LLM_MODEL,
        },
        "latency_ms": int(latency),
    }


async def _call_claude(prompt: str, system_prompt: str | None = None) -> dict:
    """Call Claude API (Anthropic Messages)."""
    messages = [{"role": "user", "content": prompt}]

    body = {
        "model": LLM_MODEL,
        "max_tokens": 8000,
        "messages": messages,
    }
    if system_prompt:
        body["system"] = system_prompt

    t0 = time.monotonic()
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{CLAUDE_BASE_URL}/messages",
            headers={
                "Content-Type": "application/json",
                "x-api-key": LLM_API_KEY,
                "anthropic-version": "2023-06-01",
            },
            json=body,
        )
    latency = (time.monotonic() - t0) * 1000

    if resp.status_code != 200:
        raise LLMError(f"Claude API 错误 ({resp.status_code}): {resp.text[:300]}")

    data = resp.json()
    content = data["content"][0]["text"]
    usage = data.get("usage", {})

    return {
        "content": content,
        "usage": {
            "input": usage.get("input_tokens", 0),
            "output": usage.get("output_tokens", 0),
            "model": LLM_MODEL,
        },
        "latency_ms": int(latency),
    }


def parse_json_response(raw: str) -> dict:
    """Parse LLM output to JSON. Handles common formatting issues."""
    text = raw.strip()

    # Remove markdown code fences
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first line (```json or ```) and last line (```)
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines)

    # Find JSON boundaries
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start : end + 1]

    return json.loads(text)
