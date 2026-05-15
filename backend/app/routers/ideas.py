"""Idea management API routes."""

import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models import ContentItem  # QualityLog skipped for now
from app.schemas import (
    IdeaCreate, ProduceRequest, ReviewEdit, ReviewReject, PublishAction,
    IdeaSummary, IdeaDetail, Gate1Response, ProduceStatus,
)
from app.services.agents import run_value_judge, run_content_production

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ideas", tags=["ideas"])


@router.post("", response_model=IdeaDetail, status_code=201)
async def create_idea(body: IdeaCreate, db: AsyncSession = Depends(get_db)):
    """Submit a new idea → triggers Gate 1 value judgment."""
    item = ContentItem(
        idea_text=body.idea_text,
        track=body.track,
        tone=body.tone,
        status="pending_review",
    )
    db.add(item)

    # Run Gate 1
    try:
        result = await run_value_judge(body.idea_text, body.track, body.tone)
        item.gate1_score = result["score"]
        item.gate1_result = json.dumps(result["details"], ensure_ascii=False)
        item.status = "pending_review"

        # Log quality (skip for now — content_item_id needs commit first)
        # qlog = QualityLog(...)
        pass
    except Exception as e:
        logger.error(f"Gate 1 failed: {e}", exc_info=True)
        item.gate1_score = 0
        item.gate1_result = json.dumps({"error": str(e)}, ensure_ascii=False)
        item.status = "draft"

    await db.commit()
    await db.refresh(item)

    return _to_detail(item)


@router.get("", response_model=list[IdeaSummary])
async def list_ideas(status: str | None = None, db: AsyncSession = Depends(get_db)):
    """List ideas, optionally filtered by status."""
    q = select(ContentItem).order_by(ContentItem.created_at.desc())
    if status:
        q = q.where(ContentItem.status == status)
    result = await db.execute(q)
    items = result.scalars().all()
    return [_to_summary(i) for i in items]


@router.get("/queue/review", response_model=list[IdeaSummary])
async def review_queue(db: AsyncSession = Depends(get_db)):
    """Get items waiting for review (status=completed production)."""
    q = select(ContentItem).where(ContentItem.status == "completed").order_by(ContentItem.updated_at.desc())
    result = await db.execute(q)
    items = result.scalars().all()
    return [_to_summary(i) for i in items]


@router.get("/{idea_id}", response_model=IdeaDetail)
async def get_idea(idea_id: str, db: AsyncSession = Depends(get_db)):
    """Get full idea detail."""
    item = await _get_or_404(idea_id, db)
    return _to_detail(item)


@router.post("/{idea_id}/gate1/approve")
async def approve_gate1(idea_id: str, db: AsyncSession = Depends(get_db)):
    """Approve Gate 1 — idea is worth producing."""
    item = await _get_or_404(idea_id, db)
    item.gate1_passed = 1
    item.status = "approved"
    await db.commit()
    return {"status": "ok", "message": "已通过价值判断，可以开始生产内容"}


@router.post("/{idea_id}/gate1/reject")
async def reject_gate1(idea_id: str, db: AsyncSession = Depends(get_db)):
    """Reject Gate 1 — idea is not worth it."""
    item = await _get_or_404(idea_id, db)
    item.gate1_passed = 0
    item.status = "rejected"
    await db.commit()
    return {"status": "ok", "message": "已驳回"}


@router.post("/{idea_id}/produce")
async def produce_content(
    idea_id: str,
    body: ProduceRequest,
    db: AsyncSession = Depends(get_db),
):
    """Trigger content production for approved idea."""
    item = await _get_or_404(idea_id, db)

    if item.status not in ("approved", "pending_review"):
        raise HTTPException(400, "请先通过价值判断（门禁 1）")

    item.status = "in_production"
    item.selected_types = json.dumps(body.types, ensure_ascii=False)
    tone = body.tone or item.tone
    await db.commit()

    try:
        result = await run_content_production(
            item.idea_text,
            item.track,
            tone,
            body.types,
        )

        item.content_gzh = result.get("content_gzh")
        item.content_xhs = result.get("content_xhs")
        item.content_video_script = result.get("content_video_script")
        item.title_suggestions = json.dumps(result.get("title_suggestions"), ensure_ascii=False)
        item.production_raw = json.dumps(result.get("production_raw"), ensure_ascii=False)
        item.status = "completed"

        # Log quality (skip for now)
        pass

    except Exception as e:
        logger.error(f"Production failed: {e}")
        item.status = "approved"  # rollback so user can retry
        await db.commit()
        raise HTTPException(500, f"内容生产失败: {e}")

    await db.commit()
    await db.refresh(item)

    return _to_detail(item)


@router.patch("/{idea_id}/review/edit")
async def edit_review(idea_id: str, body: ReviewEdit, db: AsyncSession = Depends(get_db)):
    """Edit content during review (Gate 2)."""
    item = await _get_or_404(idea_id, db)

    if body.content_gzh is not None:
        item.content_gzh = body.content_gzh
    if body.content_xhs is not None:
        item.content_xhs = body.content_xhs
    if body.content_video_script is not None:
        item.content_video_script = body.content_video_script
    if body.final_content is not None:
        item.final_content = json.dumps(body.final_content, ensure_ascii=False)

    await db.commit()
    await db.refresh(item)
    return _to_detail(item)


@router.post("/{idea_id}/review/approve")
async def approve_review(idea_id: str, db: AsyncSession = Depends(get_db)):
    """Approve review (Gate 2) — content is finalized."""
    item = await _get_or_404(idea_id, db)

    # Save current content as final if not already set
    if not item.final_content:
        item.final_content = json.dumps({
            "gzh": item.content_gzh,
            "xhs": item.content_xhs,
            "video_script": item.content_video_script,
            "titles": json.loads(item.title_suggestions) if item.title_suggestions else [],
        }, ensure_ascii=False)

    item.status = "completed"
    await db.commit()
    return {"status": "ok", "message": "审核通过，可以发布"}


@router.post("/{idea_id}/review/reject")
async def reject_review(idea_id: str, body: ReviewReject, db: AsyncSession = Depends(get_db)):
    """Reject review for a specific content type — retry production for just that type."""
    item = await _get_or_404(idea_id, db)

    item.status = "in_production"
    await db.commit()

    try:
        result = await run_content_production(
            item.idea_text,
            item.track,
            item.tone,
            [body.retry_type],
        )

        if body.retry_type == "gzh":
            item.content_gzh = result.get("content_gzh")
        elif body.retry_type == "xhs":
            item.content_xhs = result.get("content_xhs")
        elif body.retry_type == "video":
            item.content_video_script = result.get("content_video_script")

        item.status = "completed"
    except Exception as e:
        item.status = "completed"  # revert so user sees old content
        await db.commit()
        raise HTTPException(500, f"重做失败: {e}")

    await db.commit()
    await db.refresh(item)
    return _to_detail(item)


@router.post("/{idea_id}/publish")
async def mark_published(idea_id: str, body: PublishAction, db: AsyncSession = Depends(get_db)):
    """Mark as published with optional URL."""
    item = await _get_or_404(idea_id, db)
    item.publish_url = body.publish_url
    item.notes = body.notes
    item.status = "published"
    await db.commit()
    return {"status": "ok", "message": "已标记为已发布"}


# ── Helpers ──

async def _get_or_404(idea_id: str, db: AsyncSession) -> ContentItem:
    result = await db.execute(select(ContentItem).where(ContentItem.id == idea_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "内容条目不存在")
    return item


def _to_summary(item: ContentItem) -> IdeaSummary:
    return IdeaSummary(
        id=item.id,
        idea_text=item.idea_text[:100] + ("..." if len(item.idea_text or "") > 100 else ""),
        status=item.status,
        track=item.track,
        tone=item.tone,
        gate1_score=item.gate1_score,
        created_at=item.created_at,
    )


def _to_detail(item: ContentItem) -> IdeaDetail:
    def _json(s):
        """Parse JSON string, return None on failure."""
        if s is None:
            return None
        try:
            return json.loads(s)
        except (json.JSONDecodeError, TypeError):
            return s

    return IdeaDetail(
        id=item.id,
        idea_text=item.idea_text,
        track=item.track,
        tone=item.tone,
        status=item.status,
        gate1_score=item.gate1_score,
        gate1_result=_json(item.gate1_result),
        gate1_passed=item.gate1_passed,
        selected_types=_json(item.selected_types),
        content_gzh=item.content_gzh,
        content_xhs=item.content_xhs,
        content_video_script=item.content_video_script,
        title_suggestions=_json(item.title_suggestions),
        final_content=_json(item.final_content),
        publish_url=item.publish_url,
        notes=item.notes,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )
