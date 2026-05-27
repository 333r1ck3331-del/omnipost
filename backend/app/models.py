"""SQLAlchemy ORM models."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Integer, Boolean, Text, DateTime, Index, ForeignKey, Date
)
from sqlalchemy.orm import relationship
from app.core.database import Base


def _uuid():
    return str(uuid.uuid4())


def _now():
    return datetime.now(timezone.utc)


class ContentItem(Base):
    __tablename__ = "content_items"

    id = Column(String, primary_key=True, default=_uuid)
    idea_text = Column(Text, nullable=False)
    reference_text = Column(Text, nullable=True, default=None, comment="参考资料 / 背景长文（创作时塞进 prompt）")
    brief = Column(Text, nullable=True, default=None, comment="User's content requirements")
    scene = Column(String, nullable=True, comment="场景类型：kepu/guandian/gushi/qinggan/ganhuo/redian，空=通用")
    enrichment_flags = Column(Text, nullable=True, comment="JSON: {topic_articles:bool, counter_views:bool, data_cases:bool}")
    enrichment_data = Column(Text, nullable=True, comment="JSON: 抓取到的素材清单（带标题、URL、内容、状态）")
    status = Column(String, default="draft", index=True)

    # Gate 1 — value judgment
    gate1_score = Column(Integer, nullable=True)
    gate1_result = Column(Text, nullable=True)
    gate1_passed = Column(Boolean, default=False)
    gate1_research = Column(Text, nullable=True, comment="JSON: Tavily 搜索原始结果（注入 prompt 的依据）")

    # Production
    selected_types = Column(Text, nullable=True)
    production_started_at = Column(DateTime(timezone=True), nullable=True)
    content_gzh = Column(Text, nullable=True)
    content_xhs = Column(Text, nullable=True)
    content_video_script = Column(Text, nullable=True)
    content_bilibili = Column(Text, nullable=True)
    image_plans = Column(Text, nullable=True, comment="JSON: 配图方案 + MJ/DALL-E prompt")
    video_storyboard = Column(Text, nullable=True, comment="JSON: 视频分镜表（镜头/口播/BGM/时长）")
    title_suggestions = Column(Text, nullable=True)
    production_raw = Column(Text, nullable=True)
    review_log = Column(Text, nullable=True, comment="JSON: 自我审稿挑刺记录 + 是否改写")
    final_content = Column(Text, nullable=True)

    # Publish
    publish_url = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    # Distribution strategy — generated after review approval
    distribution_strategy = Column(Text, nullable=True)

    # Style: 选用的命名风格 id（None = 不用风格）
    style_id = Column(String, nullable=True, comment="StyleSample.id; null=不用风格")

    created_at = Column(DateTime(timezone=True), default=_now, index=True)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now, index=True)
    version = Column(Integer, default=1, nullable=False)

    __table_args__ = (
        Index("ix_content_status_updated", "status", "updated_at"),
    )


# ── Phase 2: Content Library ────────────────────────────────────────

class Track(Base):
    """内容赛道（如：心理赛道、AI 科技）。"""
    __tablename__ = "tracks"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False, unique=True)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_now)

    entries = relationship(
        "ContentEntry",
        back_populates="track",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class ContentEntry(Base):
    """赛道下的选题/内容条目。"""
    __tablename__ = "content_entries"

    id = Column(String, primary_key=True, default=_uuid)
    track_id = Column(
        String,
        ForeignKey("tracks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String, nullable=False)
    topic_direction = Column(Text, nullable=True, comment="选题方向/角度")
    publish_date = Column(Date, nullable=True, comment="计划发布日期")
    # 状态：to_edit（待编辑）、to_publish（待发布）、published（已发布）
    status = Column(String, default="to_edit", nullable=False, index=True)
    notes = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime(timezone=True), default=_now)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    track = relationship("Track", back_populates="entries")

    __table_args__ = (
        Index("ix_entry_track_status", "track_id", "status"),
    )


# ── Phase 3: Feed Crawling ──────────────────────────────────────────

class FeedSource(Base):
    """RSS 订阅源（用户管理）。"""
    __tablename__ = "feed_sources"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    url = Column(String, nullable=False, unique=True)
    enabled = Column(Boolean, default=True, nullable=False)
    last_fetched_at = Column(DateTime(timezone=True), nullable=True)
    last_error = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_now)


class CrawlBatch(Base):
    """一次抓取产生一个批次（左侧时间轴一条）。"""
    __tablename__ = "crawl_batches"

    id = Column(String, primary_key=True, default=_uuid)
    triggered_at = Column(DateTime(timezone=True), default=_now, index=True)
    source_count = Column(Integer, default=0, nullable=False)
    item_count = Column(Integer, default=0, nullable=False)
    note = Column(Text, nullable=True, comment="抓取摘要 / 失败信息汇总")

    items = relationship(
        "CrawlItem",
        back_populates="batch",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class CrawlItem(Base):
    """抓取到的一条文章。"""
    __tablename__ = "crawl_items"

    id = Column(String, primary_key=True, default=_uuid)
    batch_id = Column(
        String,
        ForeignKey("crawl_batches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_id = Column(
        String,
        ForeignKey("feed_sources.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    source_name = Column(String, nullable=True, comment="抓取时快照，源被删后仍可显示")
    title = Column(String, nullable=False)
    link = Column(String, nullable=False)
    summary = Column(Text, nullable=True)
    content = Column(Text, nullable=True, comment="原文 / 长正文（如 RSS 提供）")
    author = Column(String, nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=_now)

    batch = relationship("CrawlBatch", back_populates="items")

    __table_args__ = (
        Index("ix_crawl_item_batch_published", "batch_id", "published_at"),
    )


# ── Phase 4: Writing Style Library ──────────────────────────────────

class StyleSample(Base):
    """命名的写作风格样本（可保存多条，按 id 选用）。"""
    __tablename__ = "style_samples"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False, comment="风格名（如：公众号-深度文 / 小红书-感性）")
    content = Column(Text, nullable=False, comment="风格样本正文")
    is_default = Column(Boolean, default=False, nullable=False, comment="未指定时使用此条；最多一条 True")
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_now)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)
