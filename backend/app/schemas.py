"""Pydantic schemas for API request/response validation."""

from datetime import datetime, date
from typing import Optional, Literal
from pydantic import BaseModel, Field, HttpUrl, ConfigDict

from app.core.platforms import all_keys, labels_for, get as pf_get

# ⚠️ Pydantic Literal requires literal values — must hardcode.
# When adding a platform to platforms.py, add its key here too.
RetryType = Literal["gzh", "xhs", "video", "bilibili"]
TYPES_DESC = "勾选的内容类型: " + labels_for(all_keys())

# Startup invariant: RetryType must stay in sync with platforms.py
assert set(RetryType.__args__) == set(all_keys()), (
    f"RetryType ({set(RetryType.__args__)}) out of sync with "
    f"platforms.all_keys() ({set(all_keys())}). "
    f"Update schemas.py RetryType when adding/removing platforms."
)


# ── Request schemas ──

class IdeaCreate(BaseModel):
    idea_text: str = Field(..., min_length=1, max_length=2000, description="内容点子")


class Gate1Action(BaseModel):
    """通过 or 驳回门禁1"""
    pass


class ProduceRequest(BaseModel):
    """开始生产内容"""
    types: list[str] = Field(..., description=TYPES_DESC)


class BriefRequest(BaseModel):
    """保存内容要求"""
    brief_text: str = Field(..., min_length=1, max_length=2000, description="内容方向/要求")


class ReviewEdit(BaseModel):
    """编辑某条内容"""
    content_gzh: Optional[str] = None
    content_xhs: Optional[str] = None
    content_video_script: Optional[str] = None
    content_bilibili: Optional[str] = None
    final_content: Optional[dict] = None
    version: int = Field(..., ge=1, description="当前版本号，用于乐观锁")


class ReviewReject(BaseModel):
    """退回重做某条"""
    retry_type: RetryType = Field(
        ..., description="重做的内容类型: " + " | ".join(all_keys())
    )


class PublishAction(BaseModel):
    """标记已发布"""
    publish_url: Optional[HttpUrl] = None
    notes: Optional[str] = None


# ── Response schemas ──

class IdeaSummary(BaseModel):
    id: str
    idea_text: str
    status: str
    gate1_score: Optional[int] = None
    created_at: str

    class Config:
        from_attributes = True


class IdeaDetail(BaseModel):
    id: str
    idea_text: str
    status: str
    gate1_score: Optional[int] = None
    gate1_result: Optional[object] = None
    gate1_passed: bool
    selected_types: Optional[list[str]] = None
    content_gzh: Optional[str] = None
    content_xhs: Optional[str] = None
    content_video_script: Optional[str] = None
    content_bilibili: Optional[str] = None
    title_suggestions: Optional[list] = None
    image_plans: Optional[dict] = None
    video_storyboard: Optional[dict] = None
    final_content: Optional[dict] = None
    publish_url: Optional[str] = None
    notes: Optional[str] = None
    distribution_strategy: Optional[object] = None
    created_at: str
    updated_at: str
    version: int

    class Config:
        from_attributes = True


class IdeaListResponse(BaseModel):
    items: list[IdeaSummary]
    total: int
    limit: int
    offset: int


class Gate1Response(BaseModel):
    """Value judgment result sent back to frontend."""
    score: int
    details: dict
    token_usage: Optional[dict] = None


class ProduceStatus(BaseModel):
    """Production progress."""
    status: str
    completed_types: list[str]
    content_gzh: Optional[str] = None
    content_xhs: Optional[str] = None
    content_video_script: Optional[str] = None
    content_bilibili: Optional[str] = None
    title_suggestions: Optional[list] = None


class TitleOptimizeResponse(BaseModel):
    """Title optimization result."""
    titles: list[str]


# ── Phase 2: Content Library ─────────────────────────────────────────

EntryStatus = Literal["to_edit", "to_publish", "published"]


class TrackCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    description: Optional[str] = None


class TrackUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=80)
    description: Optional[str] = None
    sort_order: Optional[int] = None


class TrackOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    sort_order: int = 0
    entry_count: int = 0
    created_at: datetime


class EntryCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    topic_direction: Optional[str] = None
    publish_date: Optional[date] = None
    status: EntryStatus = "to_edit"
    notes: Optional[str] = None


class EntryUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    topic_direction: Optional[str] = None
    publish_date: Optional[date] = None
    status: Optional[EntryStatus] = None
    notes: Optional[str] = None
    sort_order: Optional[int] = None


class EntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    track_id: str
    title: str
    topic_direction: Optional[str] = None
    publish_date: Optional[date] = None
    status: EntryStatus
    notes: Optional[str] = None
    sort_order: int = 0
    created_at: datetime
    updated_at: datetime


class EntryBatchUpdate(BaseModel):
    """批量改状态。"""
    ids: list[str] = Field(..., min_length=1)
    status: EntryStatus
