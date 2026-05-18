"""Agent orchestration — value judgment (Gate 1) and content production."""

import json
import logging

from app.services.llm import call_llm, parse_json_response, LLMError
from app.services.prompt_loader import (
    assemble_value_judge_prompt,
    assemble_content_production_prompt,
)
from app.services.search import search_competitors, format_search_results, SearchError

logger = logging.getLogger(__name__)


async def run_value_judge(idea: str) -> dict:
    """Gate 1: Evaluate the idea's value.

    1. Search for competing content via Tavily
    2. Inject search results into the AI prompt
    3. AI scores the idea with real market context

    Returns:
        {"score": int, "details": dict, "token_usage": dict, "search_used": bool}
    """
    # Step 1: Search for competitors
    search_text = None
    search_used = False
    try:
        results = await search_competitors(idea, max_results=5)
        if results:
            search_text = format_search_results(results)
            search_used = True
            logger.info(f"Tavily search: {len(results)} results for '{query}'")
    except SearchError as e:
        logger.warning(f"Tavily search skipped: {e}")
    except Exception as e:
        logger.error(f"Tavily search unexpected error: {e}")

    # Step 2: Build prompt with search results
    system, user = assemble_value_judge_prompt(idea, search_results=search_text)

    # Step 3: Call LLM — use the dedicated value_judge.md as system prompt
    result = await call_llm(user, system_prompt=system)
    raw = result["content"]

    # Step 4: Parse
    try:
        data = parse_json_response(raw)
    except json.JSONDecodeError:
        data = {"overall": 5, "verdict": "AI 返回格式异常，建议人工判断", "error": True}

    score = data.get("overall", data.get("score", 5))
    if isinstance(score, dict):
        score = 5
    try:
        score = int(score)
    except (TypeError, ValueError):
        score = 0

    return {
        "score": score,
        "details": data,
        "token_usage": result.get("usage"),
        "latency_ms": result.get("latency_ms"),
        "search_used": search_used,
    }


async def run_content_production(
    idea: str,
    selected_types: list[str] | None = None,
    brief: str = "",
) -> dict:
    """Produce content: full package including gzh, xhs, video script, titles, strategy.

    Returns:
        {"content_gzh": str, "content_xhs": str, "content_video_script": str,
         "title_suggestions": list, "production_raw": dict, "token_usage": dict}
    """
    prompt = assemble_content_production_prompt(idea, selected_types, brief=brief)
    system = "你是中文资深内容研究员。只输出有效 JSON，不要任何额外文字。"

    result = await call_llm(prompt, system_prompt=system)
    raw = result["content"]

    try:
        data = parse_json_response(raw)
    except json.JSONDecodeError:
        raise LLMError("AI 返回格式异常，请重试。")

    # Extract from the full liubai-style output
    scripts = data.get("scripts", {})
    titles = data.get("titles", [])

    content_gzh = None
    content_xhs = None
    content_video_script = None
    title_suggestions = []

    # Extract content
    if selected_types is None or "gzh" in selected_types:
        gzh = scripts.get("gongzhonghao", {})
        if gzh:
            blocks = gzh.get("blocks", [])
            parts = []
            for b in blocks:
                if isinstance(b, dict) and b.get("type") == "text":
                    parts.append(b.get("content", ""))
            content_gzh = "\n\n".join(parts) if parts else json.dumps(gzh, ensure_ascii=False)

    if selected_types is None or "xhs" in selected_types:
        xhs = scripts.get("xiaohongshu", {})
        if xhs:
            content_xhs = xhs.get("body", json.dumps(xhs, ensure_ascii=False))

    if selected_types is None or "video" in selected_types:
        douyin = scripts.get("douyin", {})
        if douyin:
            shots = douyin.get("shots", [])
            script_lines = []
            for s in shots:
                script_lines.append(f"[{s.get('time', '')}] {s.get('narration', '')}")
            content_video_script = "\n".join(script_lines) if script_lines else json.dumps(douyin, ensure_ascii=False)

    # Extract titles
    for t in titles:
        if isinstance(t, dict):
            title_suggestions.append(t.get("text", ""))

    return {
        "content_gzh": content_gzh,
        "content_xhs": content_xhs,
        "content_video_script": content_video_script,
        "title_suggestions": title_suggestions,
        "production_raw": data,
        "token_usage": result.get("usage"),
        "latency_ms": result.get("latency_ms"),
    }


async def run_title_optimization(
    idea: str,
    current_titles: list[str] | None = None,
) -> dict:
    """Generate 3 alternative titles for content during review.

    Returns:
        {"titles": [str, str, str], "token_usage": dict}
    """
    existing = "\n".join(f"- {t}" for t in (current_titles or [])) or "（暂无）"

    prompt = f"""你是中文自媒体标题优化专家。

【内容主题】
{idea}

【当前标题】
{existing}

请基于以上信息，生成 3 个优化后的备选标题。
- 每个标题应有不同角度（如：情感共鸣型、干货实用型、争议讨论型）
- 每个标题 15-30 字
- 适合微信公众号/小红书场景

只输出 JSON（不要 markdown 围栏）：
{{
  "titles": [
    {{"text": "标题1", "angle": "情感共鸣"}},
    {{"text": "标题2", "angle": "干货实用"}},
    {{"text": "标题3", "angle": "争议讨论"}}
  ]
}}"""

    system = "你是中文资深标题优化师。只输出有效 JSON，不要任何额外文字。"
    result = await call_llm(prompt, system_prompt=system)
    raw = result["content"]

    try:
        data = parse_json_response(raw)
        titles = [t.get("text", "") for t in data.get("titles", [])]
    except (json.JSONDecodeError, LLMError):
        titles = ["标题生成失败，请重试"]

    return {
        "titles": titles[:3],
        "token_usage": result.get("usage"),
    }
