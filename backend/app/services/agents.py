"""Agent orchestration — value judgment (Gate 1) and content production."""

import json
import logging

from app.services.llm import call_llm, parse_json_response, LLMError
from app.services.prompt_loader import (
    assemble_value_judge_prompt,
    assemble_content_production_prompt,
    load_distribution_prompt,
    load_reviewer_prompt,
    load_style_samples,
)
from app.services.search import search_competitors, format_search_results, SearchError, fetch_urls, format_url_content
from app.core.platforms import all_platforms

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
            logger.info("Tavily search: %d results", len(results))
    except SearchError as e:
        logger.warning("Tavily search skipped: %s", e)
    except Exception:
        logger.exception("Tavily search unexpected error")

    # Step 2: Build prompt with search results
    system, user = assemble_value_judge_prompt(idea, search_results=search_text)

    # Step 3: Call LLM — use the dedicated value_judge.md as system prompt
    result = await call_llm(user, system_prompt=system)
    raw = result["content"]

    # Step 4: Parse
    try:
        data = parse_json_response(raw)
    except LLMError:
        data = {"overall": -1, "verdict": "AI 返回格式异常，建议人工判断", "error": True}

    score = data.get("overall", data.get("score", 0))
    if isinstance(score, dict):
        # LLM sometimes nests score in an object
        score = score.get("score") or score.get("value") or score.get("overall") or 0
    try:
        score = int(float(score))
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
    scene: str | None = None,
    extra_research: str = "",
) -> dict:
    """Produce content: full package including gzh, xhs, video script, titles.

    Before calling the LLM, searches for related content via Tavily and
    crawls any URLs found in the user's brief. Results are injected as
    a research brief into the production prompt.

    Returns:
        {"content_gzh": str, "content_xhs": str, "content_video_script": str,
         "title_suggestions": list, "production_raw": dict, "token_usage": dict,
         "search_used": bool, "urls_fetched": int}
    """
    # Step 0: Research — search + URL crawl
    research_parts = []
    search_used = False
    urls_fetched = 0

    # Extract and strip URLs from brief
    urls = _URL_RE.findall(brief) if brief else []
    brief_clean = _URL_RE.sub('', brief).strip() if brief else ""

    # Tavily search
    try:
        search_query = f"{idea} {' '.join(brief_clean.split()[:20])}" if brief_clean else idea
        results = await search_competitors(search_query, max_results=5)
        if results:
            research_parts.append(format_search_results(results))
            search_used = True
            logger.info(f"Production search: {len(results)} results")
    except SearchError as e:
        logger.warning(f"Production search skipped: {e}")
    except Exception as e:
        logger.error(f"Production search error: {e}")

    # URL crawl
    if urls:
        try:
            crawled = await fetch_urls(urls)
            if crawled:
                research_parts.append(format_url_content(crawled))
                urls_fetched = len([c for c in crawled if not c.get("error")])
                logger.info(f"Crawled {len(urls)} URLs, {urls_fetched} OK")
        except Exception as e:
            logger.error(f"URL crawl error: {e}")

    research_brief = "\n\n".join(research_parts) if research_parts else ""
    if extra_research and extra_research.strip():
        research_brief = (research_brief + "\n\n" + extra_research.strip()).strip()

    prompt = assemble_content_production_prompt(
        idea, selected_types, brief=brief, research_brief=research_brief, scene=scene,
    )
    system = "你是中文资深内容研究员。只输出有效 JSON，不要任何额外文字。"

    result = await call_llm(prompt, system_prompt=system)
    raw = result["content"]

    try:
        data = parse_json_response(raw)
    except LLMError:
        raise LLMError("AI 返回格式异常，请重试。")

    # Extract from the full liubai-style output
    scripts = data.get("scripts", {})
    titles = data.get("titles", [])

    content_gzh = None
    content_xhs = None
    content_video_script = None
    content_bilibili = None
    title_suggestions = []

    # Extract content
    if selected_types is None or "gzh" in selected_types:
        gzh = scripts.get("gongzhonghao", {})
        if gzh:
            # New schema: gongzhonghao.body; also support old blocks format
            body = gzh.get("body", "")
            if body:
                content_gzh = body
            else:
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
        douyin = scripts.get("douyin_script") or scripts.get("douyin", {})
        if douyin:
            # New schema: douyin_script with hook/intro/body/climax/ending
            if any(k in douyin for k in ("hook_0_3s", "intro_4_15s")):
                lines = []
                for part, label in [("hook_0_3s", "前3秒"), ("intro_4_15s", "引入"), 
                                    ("body_16_50s", "展开"), ("climax_51_75s", "高潮"), 
                                    ("ending_76_90s", "收尾")]:
                    txt = douyin.get(part, "")
                    if txt:
                        lines.append(f"[{label}] {txt}")
                content_video_script = "\n".join(lines) if lines else json.dumps(douyin, ensure_ascii=False)
            else:
                # Old format: douyin.shots[]
                shots = douyin.get("shots", [])
                script_lines = []
                for s in shots:
                    script_lines.append(f"[{s.get('time', '')}] {s.get('narration', '')}")
                content_video_script = "\n".join(script_lines) if script_lines else json.dumps(douyin, ensure_ascii=False)

    if selected_types is None or "bilibili" in selected_types:
        bili = scripts.get("bilibili_script") or scripts.get("bilibili", {})
        if bili:
            parts = [f"标题: {bili.get('title', '')}"]
            if bili.get("total_minutes"):
                parts.append(f"时长: {bili['total_minutes']}分钟")
            parts.append("")
            # New schema: chapters[].voiceover (flat); old: chapters[].shots[].narration (nested)
            for ch in bili.get("chapters", []):
                ts = ch.get("timestamp", "")
                parts.append(f"\n## {ch.get('title', '')} ({ts})" if ts else f"\n## {ch.get('title', '')}")
                # New: direct voiceover field
                voice = ch.get("voiceover", "")
                if voice:
                    dm = ch.get("danmaku_hint", "")
                    dm_str = f" [弹幕预判: {dm}]" if dm else ""
                    parts.append(f"{voice}{dm_str}")
                # Old: nested shots array
                for shot in ch.get("shots", []):
                    dm = shot.get('danmaku_anticipate', '')
                    dm_str = f" [弹幕预判: {dm}]" if dm else ""
                    parts.append(f"[{shot.get('time', '')}] {shot.get('narration', '')}{dm_str}")
            parts.append(f"\n结尾: {bili.get('ending', '')}")
            content_bilibili = "\n".join(parts)

    # Extract titles
    for t in titles:
        if isinstance(t, dict):
            title_suggestions.append(t.get("text", ""))

    # Extract image plans (only for gzh/xhs)
    image_plans_obj = data.get("image_plans") or {}
    image_plans_out: dict = {}
    if (selected_types is None or "gzh" in selected_types) and image_plans_obj.get("gongzhonghao"):
        image_plans_out["gzh"] = image_plans_obj["gongzhonghao"]
    if (selected_types is None or "xhs" in selected_types) and image_plans_obj.get("xiaohongshu"):
        image_plans_out["xhs"] = image_plans_obj["xiaohongshu"]
    image_plans_json = json.dumps(image_plans_out, ensure_ascii=False) if image_plans_out else None

    # Extract video storyboard (only for video/bilibili)
    storyboard_obj = data.get("video_storyboard") or {}
    storyboard_out: dict = {}
    if (selected_types is None or "video" in selected_types) and storyboard_obj.get("douyin"):
        storyboard_out["video"] = storyboard_obj["douyin"]
    if (selected_types is None or "bilibili" in selected_types) and storyboard_obj.get("bilibili"):
        storyboard_out["bilibili"] = storyboard_obj["bilibili"]
    storyboard_json = json.dumps(storyboard_out, ensure_ascii=False) if storyboard_out else None

    # Sanity check: every selected type MUST have content
    if selected_types:
        contents = {
            "gzh": content_gzh, "xhs": content_xhs,
            "video": content_video_script, "bilibili": content_bilibili,
        }
        missing = [t for t in selected_types if not contents.get(t)]
        if missing:
            from app.core.platforms import get
            labels = "、".join(get(t).label for t in missing)
            logger.warning(f"LLM produced empty content for selected types: {labels}")

    # AI trace backend check — lightweight regex scan for obvious patterns
    ai_traces_found = _scan_ai_traces({
        "gzh": content_gzh, "xhs": content_xhs,
        "video": content_video_script, "bilibili": content_bilibili,
    })
    if ai_traces_found:
        logger.warning(f"AI traces detected in output: {ai_traces_found}")

    return {
        "content_gzh": content_gzh,
        "content_xhs": content_xhs,
        "content_video_script": content_video_script,
        "content_bilibili": content_bilibili,
        "image_plans": image_plans_json,
        "video_storyboard": storyboard_json,
        "title_suggestions": title_suggestions,
        "production_raw": data,
        "token_usage": result.get("usage"),
        "latency_ms": result.get("latency_ms"),
        "search_used": search_used,
        "urls_fetched": urls_fetched,
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
    except LLMError:
        titles = ["标题生成失败，请重试"]

    return {
        "titles": titles[:3],
        "token_usage": result.get("usage"),
    }


async def run_distribution_strategy(
    idea: str,
    content_gzh: str | None = None,
    content_xhs: str | None = None,
    content_video_script: str | None = None,
    content_bilibili: str | None = None,
) -> dict:
    """Generate multi-platform distribution strategy after content is approved.

    Called automatically after review approval. Analyzes the approved content
    and generates platform-specific publishing recommendations.

    Returns:
        {"strategy": dict, "token_usage": dict}
    """
    system = load_distribution_prompt()

    # Build content summary for the prompt.
    # Truncation lengths are per-platform, driven by the registry.
    content_summary_parts = [f"【内容主题】\n{idea}"]

    contents = {
        "gzh": content_gzh, "xhs": content_xhs,
        "video": content_video_script, "bilibili": content_bilibili,
    }
    for p in all_platforms():
        c = contents.get(p.key)
        if c:
            preview = c[:p.truncate] + ("..." if len(c) > p.truncate else "")
            content_summary_parts.append(f"\n【{p.label}内容摘要】\n{preview}")

    content_summary = "\n".join(content_summary_parts)

    user_prompt = f"""{content_summary}

请基于以上已审核通过的内容，生成完整的多平台投放策略。

严格输出 JSON（不要 markdown 围栏）："""

    result = await call_llm(user_prompt, system_prompt=system)
    raw = result["content"]

    try:
        data = parse_json_response(raw)
    except LLMError:
        raise LLMError("投放策略生成格式异常，请重试。")

    return {
        "strategy": data,
        "token_usage": result.get("usage"),
    }


async def run_content_review(
    platform_label: str,
    draft: str,
    idea: str = "",
    scene: str | None = None,
) -> dict:
    """Self-review pass: 主编挑刺并重写一段内容。

    Args:
        platform_label: 中文平台名（公众号 / 小红书 / 抖音脚本 / B站脚本）
        draft: 草稿原文
        idea: 原始选题（用于提供上下文）

    Returns:
        {
          "issues": [{"quote": str, "problem": str}, ...],
          "rewritten": str,        # 失败时为原 draft
          "changed": bool,          # rewritten != draft
          "token_usage": dict,
          "error": str | None,
        }
    """
    if not draft or not draft.strip():
        return {"issues": [], "rewritten": draft, "changed": False, "token_usage": None, "error": "empty_draft"}

    system = load_reviewer_prompt()
    style_block = load_style_samples()
    from app.services.prompt_loader import load_scene_prompt
    scene_block = load_scene_prompt(scene)

    user_prompt = f"""{scene_block}{style_block}
【平台】{platform_label}

【原始选题】
{idea or "(未提供)"}

【AI 草稿】
{draft}

请按系统提示的格式，挑出 3-5 个具体问题并重写。严格输出 JSON。"""

    try:
        result = await call_llm(user_prompt, system_prompt=system)
        raw = result["content"]
        data = parse_json_response(raw)
    except LLMError as e:
        logger.warning(f"Review failed ({platform_label}): {e}")
        return {"issues": [], "rewritten": draft, "changed": False, "token_usage": None, "error": str(e)}
    except Exception as e:
        logger.exception(f"Review unexpected error ({platform_label})")
        return {"issues": [], "rewritten": draft, "changed": False, "token_usage": None, "error": str(e)}

    issues = data.get("issues") or []
    rewritten = (data.get("rewritten") or "").strip()
    if not rewritten:
        return {"issues": issues, "rewritten": draft, "changed": False, "token_usage": result.get("usage"), "error": "empty_rewrite"}

    return {
        "issues": issues if isinstance(issues, list) else [],
        "rewritten": rewritten,
        "changed": rewritten != draft.strip(),
        "token_usage": result.get("usage"),
        "error": None,
    }


# ── AI trace scanner ──

import re as _re

_URL_RE = _re.compile(r'https?://[^\s<>"\')]+')
_MAX_BRIEF_LEN = 8000
_MAX_IDEA_LEN = 4000

_AI_PATTERNS = [
    (_re.compile(r"不是[^，。；\n]{2,20}而是"), "「不是X而是Y」对仗排比"),
    (_re.compile(r"(?:其实|我们|很多时候|一直以来)[，。]"), "模糊群体修辞"),
    (_re.compile(r"(?:温柔的|治愈的|有质感的|高级的)"), "空泛形容词"),
    (_re.compile(r"(?:请记得|愿你|希望你)"), "虚浮祝福"),
    (_re.compile(r"(?:\n\n[^，。\n]{10,30}。\n\n[^，。\n]{10,30}。\n\n[^，。\n]{10,30}。)"), "三段式排比对仗"),
]


def _scan_ai_traces(contents: dict) -> dict[str, list[str]]:
    """Lightweight regex scan for common AI patterns in produced content.

    Returns:
        {platform_key: [pattern_description, ...]} for platforms with hits.
    """
    found: dict[str, list[str]] = {}
    for platform, text in contents.items():
        if not text:
            continue
        hits: list[str] = []
        for pattern, desc in _AI_PATTERNS:
            if pattern.search(text):
                hits.append(desc)
        if hits:
            found[platform] = hits
    return found
