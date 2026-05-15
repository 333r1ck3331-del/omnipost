"""SQLAlchemy ORM models."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Integer, Text, DateTime
from app.core.database import Base


def _uuid():
    return str(uuid.uuid4())


def _now():
    return datetime.now(timezone.utc)


class ContentItem(Base):
    __tablename__ = "content_items"

    id = Column(String, primary_key=True, default=_uuid)
    idea_text = Column(Text, nullable=False)
    track = Column(String, default="psychology")
    tone = Column(String, default="gentle_comfort")
    status = Column(String, default="draft")

    # Gate 1 — value judgment
    gate1_score = Column(Integer, nullable=True)
    gate1_result = Column(Text, nullable=True)
    gate1_passed = Column(Integer, default=0)

    # Production
    selected_types = Column(Text, nullable=True)
    content_gzh = Column(Text, nullable=True)
    content_xhs = Column(Text, nullable=True)
    content_video_script = Column(Text, nullable=True)
    title_suggestions = Column(Text, nullable=True)
    production_raw = Column(Text, nullable=True)
    final_content = Column(Text, nullable=True)

    # Publish
    publish_url = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=_now)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)


class QualityLog(Base):
    __tablename__ = "quality_logs"

    id = Column(String, primary_key=True, default=_uuid)
    content_item_id = Column(String, nullable=False)
    step = Column(String, nullable=False)
    model = Column(String, nullable=True)
    tokens_in = Column(Integer, nullable=True)
    tokens_out = Column(Integer, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    you_edited = Column(Integer, default=0)
    satisfaction = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now)
