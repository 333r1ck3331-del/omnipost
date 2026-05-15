"""Load and assemble prompts from the prompts/ directory.

Supports variable injection: {track_display}, {tone_name}, {idea}.
"""

import os
import json
import yaml
from app.core.config import PROMPTS_DIR, SCHEMAS_DIR, CONFIG_DIR


def _read(path: str) -> str:
    with open(path, encoding="utf-8") as f:
        return f.read()


def load_system_prompt(track_name: str = "psychology") -> str:
    """Load system.md with track variables injected."""
    template = _read(os.path.join(PROMPTS_DIR, "system.md"))

    # Load track config
    track_path = os.path.join(CONFIG_DIR, "tracks", f"{track_name}.yaml")
    if os.path.exists(track_path):
        with open(track_path, encoding="utf-8") as f:
            track_config = yaml.safe_load(f)
        track_display = track_config.get("track_display", track_name)
    else:
        track_display = track_name

    return template.replace("{track_display}", track_display).replace("{track_name}", track_name)


def load_rules() -> str:
    """Load global content rules."""
    return _read(os.path.join(PROMPTS_DIR, "rules.md"))


def load_tone_prompt(tone_slug: str) -> str:
    """Load a specific tone prompt by its slug (e.g. 'gentle_comfort')."""
    path = os.path.join(PROMPTS_DIR, "tones", f"{tone_slug}.md")
    if not os.path.exists(path):
        # Fallback: try to find by Chinese name
        tone_map = {
            "温柔抚慰": "gentle_comfort",
            "清醒共情": "clear_empathy",
            "社会观察": "social_observe",
            "心理科普": "psych_science",
        }
        slug = tone_map.get(tone_slug, "gentle_comfort")
        path = os.path.join(PROMPTS_DIR, "tones", f"{slug}.md")

    return _read(path)


def load_output_schema() -> dict:
    """Load the output JSON schema."""
    with open(os.path.join(SCHEMAS_DIR, "output_schema.json"), encoding="utf-8") as f:
        return json.load(f)


def assemble_value_judge_prompt(idea: str, track: str = "psychology", tone: str = "gentle_comfort") -> str:
    """Assemble the full prompt for value judgment (Gate 1).

    Uses a lightweight version: system + rules + idea, asking for just the score section.
    """
    schema = load_output_schema()
    score_schema = schema["properties"]["score"]

    return f"""你是中文资深内容研究员。请评估以下内容点子的价值。

{load_rules()}

【用户的想法】
{idea}

【赛道】{track}

请只输出 score 部分的 JSON（严格 JSON，不要 markdown 围栏）：
{json.dumps(score_schema, ensure_ascii=False, indent=2)}
"""


def assemble_content_production_prompt(
    idea: str,
    track: str = "psychology",
    tone: str = "gentle_comfort",
    selected_types: list[str] | None = None,
) -> str:
    """Assemble the full prompt for content production.

    This is the liubai-equivalent: produces the full content package.
    """
    system = load_system_prompt(track)
    tone_prompt = load_tone_prompt(tone)
    rules = load_rules()
    schema = load_output_schema()

    # Filter schema to only requested types if specified
    if selected_types:
        # Keep full schema for now — the AI will fill what's asked
        pass

    prompt = f"""{system}

{tone_prompt}

【用户的想法/素材】
{idea}

请深入研究后输出完整内容包。严格输出 JSON 对象本身，不要前后任何解释、不要 markdown 围栏。

输出 JSON 结构：
{json.dumps(schema["properties"], ensure_ascii=False, indent=1)}

{rules}

再次强调：只输出 JSON 对象本身。"""

    return prompt
