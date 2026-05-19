"""LLM API calls — supports DeepSeek and Claude.

Uses `import app.core.config as cfg` (not `from ... import`) so that
reload_config() (triggered by Settings page save) takes effect at call time
without requiring a process restart.
"""

import asyncio
import json
import logging
import time

import httpx
import app.core.config as cfg

logger = logging.getLogger(__name__)


class LLMError(Exception):
    pass


# ── Security: base URL whitelist ──────────────────────────────────

_ALLOWED_BASE_URLS = {
    "deepseek": {"https://api.deepseek.com", "https://api.deepseek.com/v1"},
    "claude": {"https://api.anthropic.com/v1"},
}

_TIMEOUT = httpx.Timeout(connect=10.0, read=120.0, write=30.0, pool=10.0)
_LIMITS = httpx.Limits(max_connections=50, max_keepalive_connections=10)


def _redact(text: str, *secrets: str) -> str:
    for s in secrets:
        if s:
            text = text.replace(s, "***")
    return text


# ── Retry helper ──────────────────────────────────────────────────

async def _post_with_retry(
    client: httpx.AsyncClient,
    url: str,
    *,
    headers: dict,
    json_body: dict,
    api_key: str,
    max_attempts: int = 3,
):
    """POST with exponential backoff on 429/5xx/network errors."""
    last_exc = None
    for attempt in range(max_attempts):
        try:
            resp = await client.post(url, headers=headers, json=json_body)
            if resp.status_code < 500 and resp.status_code != 429:
                return resp
            last_exc = LLMError(
                f"HTTP {resp.status_code}: {_redact(resp.text[:200], api_key)}"
            )
        except (httpx.TimeoutException, httpx.NetworkError) as e:
            last_exc = e
        await asyncio.sleep(0.5 * (2**attempt))
    raise LLMError(f"上游 API 重试 {max_attempts} 次仍失败: {last_exc}")


# ── Main entry ────────────────────────────────────────────────────

async def call_llm(prompt: str, system_prompt: str | None = None) -> dict:
    """Call the configured LLM and return {content, usage, latency_ms}.

    Reads provider/key/model from cfg at call time, so Settings changes
    take effect immediately without restart.
    """
    if not isinstance(prompt, str) or len(prompt) > 200_000:
        raise LLMError("prompt 非法或过长")

    api_key = cfg.LLM_API_KEY
    provider = cfg.LLM_PROVIDER
    model = cfg.LLM_MODEL

    if not api_key or api_key.startswith("sk-your-"):
        raise LLMError(
            "API Key 未配置。请在 Settings 页面设置或在 backend/.env 中设置 LLM_API_KEY。"
        )

    if provider == "deepseek":
        return await _call_deepseek(prompt, system_prompt, api_key, model)
    elif provider == "claude":
        return await _call_claude(prompt, system_prompt, api_key, model)
    else:
        raise LLMError(f"不支持的 LLM provider: {provider}")


# ── DeepSeek ──────────────────────────────────────────────────────

async def _call_deepseek(
    prompt: str,
    system_prompt: str | None,
    api_key: str,
    model: str,
) -> dict:
    """Call DeepSeek API (OpenAI-compatible) with retry."""
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    body = {
        "model": model,
        "messages": messages,
        "max_tokens": 8000,
    }

    if model == "deepseek-chat":
        body["response_format"] = {"type": "json_object"}
        body["temperature"] = 0.85

    base_url = cfg.DEEPSEEK_BASE_URL.rstrip("/")
    if base_url not in _ALLOWED_BASE_URLS["deepseek"]:
        raise LLMError("DEEPSEEK_BASE_URL 不在白名单内")

    t0 = time.monotonic()
    async with httpx.AsyncClient(timeout=_TIMEOUT, limits=_LIMITS) as client:
        resp = await _post_with_retry(
            client,
            f"{base_url}/chat/completions",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
            json_body=body,
            api_key=api_key,
        )
    latency = (time.monotonic() - t0) * 1000

    if resp.status_code != 200:
        raise LLMError(
            f"DeepSeek API 错误 ({resp.status_code}): {_redact(resp.text[:300], api_key)}"
        )

    data = resp.json()
    content = data["choices"][0]["message"]["content"]
    usage = data.get("usage", {})

    return {
        "content": content,
        "usage": {
            "input": usage.get("prompt_tokens", 0),
            "output": usage.get("completion_tokens", 0),
            "model": model,
        },
        "latency_ms": int(latency),
    }


# ── Claude ────────────────────────────────────────────────────────

async def _call_claude(
    prompt: str,
    system_prompt: str | None,
    api_key: str,
    model: str,
) -> dict:
    """Call Claude API (Anthropic Messages) with retry."""
    messages = [{"role": "user", "content": prompt}]

    body = {
        "model": model,
        "max_tokens": 8000,
        "messages": messages,
        "thinking": {"type": "disabled"},
    }
    if system_prompt:
        body["system"] = system_prompt

    base_url = cfg.CLAUDE_BASE_URL.rstrip("/")
    if base_url not in _ALLOWED_BASE_URLS["claude"]:
        raise LLMError("CLAUDE_BASE_URL 不在白名单内")

    t0 = time.monotonic()
    async with httpx.AsyncClient(timeout=_TIMEOUT, limits=_LIMITS) as client:
        resp = await _post_with_retry(
            client,
            f"{base_url}/messages",
            headers={
                "Content-Type": "application/json",
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
            },
            json_body=body,
            api_key=api_key,
        )
    latency = (time.monotonic() - t0) * 1000

    if resp.status_code != 200:
        raise LLMError(
            f"Claude API 错误 ({resp.status_code}): {_redact(resp.text[:300], api_key)}"
        )

    data = resp.json()
    content_blocks = data.get("content", [])
    text_block = next(
        (b for b in content_blocks if b.get("type") == "text"), None
    )
    if not text_block:
        raise LLMError(
            f"Claude 返回无文本内容: {json.dumps(content_blocks, ensure_ascii=False)[:200]}"
        )
    content = text_block["text"]
    usage = data.get("usage", {})

    return {
        "content": content,
        "usage": {
            "input": usage.get("input_tokens", 0),
            "output": usage.get("output_tokens", 0),
            "model": model,
        },
        "latency_ms": int(latency),
    }


# ── JSON parsing ──────────────────────────────────────────────────

def parse_json_response(raw: str) -> dict:
    """Parse LLM output to JSON dict. Handles common formatting issues.

    Raises LLMError (not JSONDecodeError) for all parsing failures.
    """
    if not raw or not raw.strip():
        raise LLMError("AI 返回为空，请重试。")

    if len(raw) > 1_000_000:
        raise LLMError("AI 返回内容过大，拒绝解析。")

    text = raw.strip()

    # Remove markdown code fences
    if text.startswith("```"):
        lines = text.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    try:
        obj = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                obj = json.loads(text[start : end + 1])
            except json.JSONDecodeError as e:
                raise LLMError("AI 返回 JSON 解析失败，请重试。") from e
        else:
            raise LLMError("AI 返回非 JSON 格式，请重试。")

    if not isinstance(obj, dict):
        raise LLMError(
            f"AI 返回了 {type(obj).__name__} 而不是 JSON 对象，请重试。"
        )

    return obj
