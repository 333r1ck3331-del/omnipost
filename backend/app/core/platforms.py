"""Platform registry — single source of truth for all platform mappings.

Every hardcoded if/elif and naming alias should route through this registry.
Adding a new platform means adding one entry here, then using the helpers
everywhere else. No more "加平台漏代码" bugs.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Platform:
    """One entry in the platform registry."""

    key: str               # canonical short key: "gzh", "xhs", "video", "bilibili"
    schema_key: str        # key in output_schema.json scripts: "gongzhonghao", "xiaohongshu", ...
    model_field: str       # database column / Pydantic field: "content_gzh", ...
    label: str             # human-readable Chinese label: "公众号", "小红书", ...
    truncate: int = 300    # chars for distribution-strategy content summary
    icon: str = "📄"       # emoji icon


PLATFORMS: tuple[Platform, ...] = (
    Platform(
        key="gzh",
        schema_key="gongzhonghao",
        model_field="content_gzh",
        label="公众号",
        truncate=800,
        icon="📰",
    ),
    Platform(
        key="xhs",
        schema_key="xiaohongshu",
        model_field="content_xhs",
        label="小红书",
        truncate=300,
        icon="📕",
    ),
    Platform(
        key="video",
        schema_key="douyin",
        model_field="content_video_script",
        label="短视频脚本",
        truncate=400,
        icon="🎵",
    ),
    Platform(
        key="bilibili",
        schema_key="bilibili",
        model_field="content_bilibili",
        label="B站视频",
        truncate=1000,
        icon="📺",
    ),
)


# Fast lookups — built once, immutable
_BY_KEY: dict[str, Platform] = {p.key: p for p in PLATFORMS}
_BY_FIELD: dict[str, Platform] = {p.model_field: p for p in PLATFORMS}
_ALL_KEYS: tuple[str, ...] = tuple(p.key for p in PLATFORMS)
_ALL_FIELDS: tuple[str, ...] = tuple(p.model_field for p in PLATFORMS)
ALL_TYPE_KEYS: tuple[str, ...] = _ALL_KEYS  # for schemas.py Literal


def get(key: str) -> Platform:
    """Get a Platform by canonical key. Raises ValueError if unknown."""
    if key not in _BY_KEY:
        raise ValueError(f"Unknown platform key: {key!r}, expected one of {_ALL_KEYS}")
    return _BY_KEY[key]


def all_platforms() -> tuple[Platform, ...]:
    """Return all registered platforms in order."""
    return PLATFORMS


def all_keys() -> tuple[str, ...]:
    """Return all canonical platform keys."""
    return _ALL_KEYS


def schema_keys_for(selected: list[str]) -> list[str]:
    """Map user-facing keys to output_schema keys."""
    return [_BY_KEY[k].schema_key for k in selected]


def labels_for(selected: list[str]) -> str:
    """Human-readable list using Chinese enumeration comma."""
    return "、".join(_BY_KEY[k].label for k in selected)


# Startup sanity check — RuntimeError survives `python -O`
if len(_BY_KEY) != len(PLATFORMS):
    raise RuntimeError("Duplicate platform keys detected")
if len(_BY_FIELD) != len(PLATFORMS):
    raise RuntimeError("Duplicate platform fields detected")
