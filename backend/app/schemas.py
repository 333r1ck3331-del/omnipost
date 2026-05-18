"""Pydantic schemas for API request/response validation."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ── Request schemas ──

class IdeaCreate(BaseModel):
    idea_text: str = Field(..., min_length=1, max_length=2000, description="内容点子")


class Gate1Action(BaseModel):
    """通过 or 驳回门禁1"""
    pass  # no body needed, the action is encoded in the URL


class ProduceRequest(BaseModel):
    """开始生产内容"""
    types: list[str] = Field(..., description="勾选的内容类型: gzh, xhs, video")


class BriefRequest(BaseModel):
    """保存内容要求"""
    brief_text: str = Field(..., min_length=1, max_length=2000, description="内容方向/要求")


class ReviewEdit(BaseModel):
    """编辑某条内容"""
    content_gzh: Optional[str] = None
    content_xhs: Optional[str] = None
    content_video_script: Optional[str] = None
    final_content: Optional[dict] = None


class ReviewReject(BaseModel):
    """退回重做某条"""
    retry_type: str = Field(..., description="gzh | xhs | video")


class PublishAction(BaseModel):
    """标记已发布"""
    publish_url: Optional[str] = None
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
    gate1_passed: int
    selected_types: Optional[list[str]] = None
    content_gzh: Optional[str] = None
    content_xhs: Optional[str] = None
    content_video_script: Optional[str] = None
    title_suggestions: Optional[list] = None
    final_content: Optional[dict] = None
    publish_url: Optional[str] = None
    notes: Optional[str] = None
    distribution_strategy: Optional[object] = None
    created_at: str
    updated_at: str

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
    details: dict  # the full AI response
    token_usage: Optional[dict] = None


class ProduceStatus(BaseModel):
    """Production progress."""
    status: str
    completed_types: list[str]
    content_gzh: Optional[str] = None
    content_xhs: Optional[str] = None
    content_video_script: Optional[str] = None
    title_suggestions: Optional[list] = None


class TitleOptimizeResponse(BaseModel):
    """Title optimization result."""
    titles: list[str]
