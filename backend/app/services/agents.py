"""Agent orchestration — value judgment (Gate 1) and content production."""

import json
from app.services.llm import call_llm, parse_json_response, LLMError
from app.services.prompt_loader import (
    assemble_value_judge_prompt,
    assemble_content_production_prompt,
)


async def run_value_judge(idea: str, track: str = "psychology", tone: str = "gentle_comfort") -> dict:
    """Gate 1: Evaluate the idea's value.

    Returns:
        {"score": int, "details": dict, "token_usage": dict}
    """
    prompt = assemble_value_judge_prompt(idea, track, tone)
    system = "你是中文资深内容研究员。只输出有效 JSON，不要任何额外文字。"

    result = await call_llm(prompt, system_prompt=system)
    raw = result["content"]

    try:
        data = parse_json_response(raw)
    except json.JSONDecodeError:
        # If JSON parse fails, try a simpler extraction
        data = {"overall": 5, "verdict": "AI 返回格式异常，建议人工判断", "error": True}

    # Extract score — the schema has "overall" at top level
    score = data.get("overall", data.get("score", 5))
    if isinstance(score, dict):
        score = 5

    return {
        "score": score,
        "details": data,
        "token_usage": result.get("usage"),
        "latency_ms": result.get("latency_ms"),
    }


async def run_content_production(
    idea: str,
    track: str = "psychology",
    tone: str = "gentle_comfort",
    selected_types: list[str] | None = None,
) -> dict:
    """Produce content: full package including gzh, xhs, video script, titles, strategy.

    Returns:
        {"content_gzh": str, "content_xhs": str, "content_video_script": str,
         "title_suggestions": list, "production_raw": dict, "token_usage": dict}
    """
    prompt = assemble_content_production_prompt(idea, track, tone, selected_types)
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
            # Combine blocks into one string
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
            # Combine shots into script text
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
