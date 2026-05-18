"""Load and assemble prompts from the prompts/ directory.

Supports variable injection: {track_display}, {tone_name}, {idea}.
"""

import os
import json
from app.core.config import PROMPTS_DIR, SCHEMAS_DIR


def _read(path: str) -> str:
    with open(path, encoding="utf-8") as f:
        return f.read()


def load_system_prompt() -> str:
    """Load system.md."""
    return _read(os.path.join(PROMPTS_DIR, "system.md"))


def load_rules() -> str:
    """Load global content rules."""
    return _read(os.path.join(PROMPTS_DIR, "rules.md"))


def load_value_judge_prompt() -> str:
    """Load the dedicated value-judgment system prompt."""
    return _read(os.path.join(PROMPTS_DIR, "value_judge.md"))


def load_tone_prompt(tone_slug: str) -> str:
    """DEPRECATED: Tone system removed. Kept for backward compat; returns empty."""
    return ""


def load_output_schema() -> dict:
    """Load the output JSON schema."""
    with open(os.path.join(SCHEMAS_DIR, "output_schema.json"), encoding="utf-8") as f:
        return json.load(f)


def assemble_value_judge_prompt(
    idea: str,
    search_results: str | None = None,
) -> tuple[str, str]:
    """Assemble the value-judgment prompt (Gate 1).

    Returns:
        (system_prompt, user_prompt) — system is value_judge.md verbatim,
        user contains search context + idea + the required output schema.
    """
    system_prompt = load_value_judge_prompt()

    if search_results:
        search_block = (
            "【全网搜索到的竞品内容】\n"
            "以下是全网搜索到的竞品内容，请仔细分析它们的角度、套路与盲区，"
            "并在 dimensions 与 competitive_analysis 中引用具体条目作为依据。\n\n"
            f"{search_results}"
        )
    else:
        search_block = (
            "【搜索数据】\n"
            "（本次未获取到搜索数据，请基于你的知识判断；"
            "并在 competitive_analysis 中明确声明数据缺失。）"
        )

    output_schema = """{
  "overall": 65,
  "verdict": "一句话判断",
  "dimensions": {
    "originality":      {"score": 70, "plus": ["..."], "minus": ["..."]},
    "audience_appeal":  {"score": 65, "plus": ["..."], "minus": ["..."]},
    "content_richness": {"score": 60, "plus": ["..."], "minus": ["..."]},
    "timeliness":       {"score": 75, "plus": ["..."], "minus": ["..."]},
    "feasibility":      {"score": 80, "plus": ["..."], "minus": ["..."]}
  },
  "competitive_analysis": "对比竞品内容的具体分析，2-3 句话",
  "advice": "如何改进这个点子的具体建议，2-3 句话"
}"""

    user_prompt = f"""{search_block}

【用户的内容点子】
{idea}

请按照系统提示中的五个维度逐项评估，每个维度都必须给出 score、plus、minus，
并最终汇总 overall、verdict、competitive_analysis、advice。

严格输出以下 JSON 结构（不要 markdown 围栏，不要任何额外文字）：
{output_schema}
"""

    return system_prompt, user_prompt


def assemble_content_production_prompt(
    idea: str,
    selected_types: list[str] | None = None,
    brief: str = "",
) -> str:
    """Assemble the full prompt for content production.

    This is the liubai-equivalent: produces the full content package.
    """
    system = load_system_prompt()
    rules = load_rules()
    schema = load_output_schema()

    brief_block = ""
    if brief.strip():
        brief_block = f"""
【用户的内容要求】
{brief.strip()}
"""

    prompt = f"""{system}
{brief_block}
【用户的想法/素材】
{idea}

请深入研究后输出完整内容包。严格输出 JSON 对象本身，不要前后任何解释、不要 markdown 围栏。

输出 JSON 结构：
{json.dumps(schema["properties"], ensure_ascii=False, indent=1)}

{rules}

再次强调：只输出 JSON 对象本身。"""

    return prompt
