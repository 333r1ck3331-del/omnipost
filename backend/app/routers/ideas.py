"""Idea management API routes."""

import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.models import ContentItem
from app.schemas import (
    IdeaCreate, ProduceRequest, BriefRequest, ReviewEdit, ReviewReject, PublishAction,
    IdeaSummary, IdeaDetail, IdeaListResponse, TitleOptimizeResponse,
)
from app.services.agents import run_value_judge, run_content_production, run_title_optimization, run_distribution_strategy
from app.services.tts import generate_speech, TTSError
from app.core.platforms import get, all_platforms

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ideas", tags=["ideas"])

VALID_STATUSES = {
    "draft", "pending_review", "approved", "rejected",
    "review", "in_production", "production_failed",
    "completed", "published",
}


@router.post("", response_model=IdeaDetail, status_code=201)
async def create_idea(body: IdeaCreate, db: AsyncSession = Depends(get_db)):
    """Submit a new idea → triggers Gate 1 value judgment."""
    item = ContentItem(
        idea_text=body.idea_text,
        status="pending_review",
    )
    db.add(item)

    # Run Gate 1
    try:
        result = await run_value_judge(body.idea_text)
        item.gate1_score = result["score"]
        details = result.get("details")
        if details is None:
            item.gate1_result = json.dumps({"error": "AI evaluation failed"}, ensure_ascii=False)
        else:
            item.gate1_result = json.dumps(details, ensure_ascii=False)
        item.status = "pending_review"
    except Exception:
        logger.exception("Gate 1 failed")
        item.gate1_score = 0
        item.gate1_result = json.dumps(
            {"error": "evaluation_failed", "message": "价值判断失败，请稍后重试"},
            ensure_ascii=False,
        )
        item.status = "pending_review"

    await db.commit()
    await db.refresh(item)

    return _to_detail(item)


@router.get("", response_model=IdeaListResponse)
async def list_ideas(
    status: str | None = None,
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List ideas, optionally filtered by status, with pagination."""
    if status and status not in VALID_STATUSES:
        raise HTTPException(
            400,
            f"无效的状态值: {status!r}，有效值: {', '.join(sorted(VALID_STATUSES))}",
        )
    base = select(ContentItem)
    if status:
        base = base.where(ContentItem.status == status)

    count_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_q)).scalar_one()

    q = base.order_by(ContentItem.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(q)
    items = result.scalars().all()
    return IdeaListResponse(items=[_to_summary(i) for i in items], total=total, limit=limit, offset=offset)


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
    if item.status not in ("pending_review", "draft"):
        raise HTTPException(409, f"状态 {item.status!r} 不能进行 Gate 1 审批")
    item.gate1_passed = True
    item.status = "approved"
    await db.commit()
    return {"status": "ok", "message": "已通过价值判断，可以开始生产内容"}


@router.post("/{idea_id}/gate1/reject")
async def reject_gate1(idea_id: str, db: AsyncSession = Depends(get_db)):
    """Reject Gate 1 — idea is not worth it."""
    item = await _get_or_404(idea_id, db)
    if item.status not in ("pending_review", "draft"):
        raise HTTPException(409, f"状态 {item.status!r} 不能驳回")
    item.gate1_passed = False
    item.status = "rejected"
    await db.commit()
    return {"status": "ok", "message": "已驳回"}


@router.post("/{idea_id}/brief")
async def save_brief(idea_id: str, body: BriefRequest, db: AsyncSession = Depends(get_db)):
    """Save user's content brief before production."""
    item = await _get_or_404(idea_id, db)
    item.brief = body.brief_text
    await db.commit()
    return {"status": "ok", "message": "Brief saved"}


from datetime import datetime, timedelta, timezone

PRODUCTION_TIMEOUT = timedelta(minutes=10)

# States allowed to enter content production.
# pending_review is NOT included — user must approve Gate 1 first.
PRODUCIBLE_STATES = ("approved", "review", "production_failed")


@router.post("/{idea_id}/produce")
async def produce_content(
    idea_id: str,
    body: ProduceRequest,
    db: AsyncSession = Depends(get_db),
):
    """Trigger content production for approved idea.

    Supports retry from production_failed. Uses optimistic locking
    (UPDATE ... WHERE status=prev) to prevent concurrent production.
    """
    item = await _get_or_404(idea_id, db)
    prev_status = item.status

    if prev_status not in PRODUCIBLE_STATES:
        # Allow recovery from stuck in_production (e.g. server crash)
        if prev_status == "in_production" and item.production_started_at \
                and datetime.now(timezone.utc) - item.production_started_at > PRODUCTION_TIMEOUT:
            pass  # allow retry
        else:
            raise HTTPException(409, f"状态 {prev_status!r} 不能生产内容，请先通过价值判断")

    # Optimistic lock: only transition if nobody else already did
    from sqlalchemy import update as sql_update
    result = await db.execute(
        sql_update(ContentItem)
        .where(ContentItem.id == item.id, ContentItem.status == prev_status)
        .values(status="in_production", selected_types=json.dumps(body.types, ensure_ascii=False),
                production_started_at=datetime.now(timezone.utc))
    )
    if result.rowcount == 0:
        await db.rollback()
        raise HTTPException(409, "该条目正在被另一个请求处理，请稍后重试")
    await db.commit()
    await db.refresh(item)

    try:
        result = await run_content_production(
            item.idea_text,
            body.types,
            brief=item.brief or "",
        )

        # Assign content to DB fields via registry
        for p in all_platforms():
            val = result.get(p.model_field)
            if val is not None:
                setattr(item, p.model_field, val)
        item.title_suggestions = json.dumps(result.get("title_suggestions"), ensure_ascii=False)
        item.image_plans = result.get("image_plans")
        item.video_storyboard = result.get("video_storyboard")
        item.production_raw = json.dumps(result.get("production_raw"), ensure_ascii=False)
        item.status = "review"

    except Exception as e:
        logger.error(f"Production failed: {e}")
        try:
            item.status = "production_failed"
            await db.commit()
        except Exception:
            logger.exception("Failed to set production_failed status")
        import asyncio
        if isinstance(e, asyncio.CancelledError):
            raise
        raise HTTPException(500, "内容生产失败，请稍后重试")

    else:
        await db.commit()
    await db.refresh(item)

    return _to_detail(item)


@router.patch("/{idea_id}/review/edit")
async def edit_review(idea_id: str, body: ReviewEdit, db: AsyncSession = Depends(get_db)):
    """Edit content during review (Gate 2). Uses optimistic lock via version."""
    item = await _get_or_404(idea_id, db)

    if item.status not in ("review", "completed"):
        raise HTTPException(409, f"状态 {item.status!r} 不能编辑（需 review 或 completed）")

    # Optimistic lock: only update if version matches
    from sqlalchemy import update as sql_update
    updates: dict = {}
    for p in all_platforms():
        val = getattr(body, p.model_field, None)
        if val is not None:
            updates[p.model_field] = val
    if body.final_content is not None:
        updates["final_content"] = json.dumps(body.final_content, ensure_ascii=False)
    updates["version"] = item.version + 1

    if not updates:
        await db.rollback()
        raise HTTPException(400, "没有提供任何修改内容")

    res = await db.execute(
        sql_update(ContentItem)
        .where(ContentItem.id == item.id, ContentItem.version == body.version)
        .values(**updates)
    )
    if res.rowcount == 0:
        await db.rollback()
        raise HTTPException(409, "编辑冲突：该条目已被其他用户修改，请刷新后重试")

    await db.commit()
    await db.refresh(item)
    return _to_detail(item)


@router.post("/{idea_id}/review/approve")
async def approve_review(idea_id: str, db: AsyncSession = Depends(get_db)):
    """Approve review (Gate 2) — content is finalized."""
    item = await _get_or_404(idea_id, db)

    if item.status != "review":
        raise HTTPException(409, f"状态 {item.status!r} 无法进行 Gate 2 审批")

    # Optimistic lock: only one request can transition review→completed
    from sqlalchemy import update as sql_update
    res = await db.execute(
        sql_update(ContentItem)
        .where(ContentItem.id == item.id, ContentItem.status == "review")
        .values(status="completed")
    )
    if res.rowcount == 0:
        await db.rollback()
        raise HTTPException(409, "该条目正在被另一个请求处理，请稍后重试")
    await db.commit()
    await db.refresh(item)

    # Save current content as final if not already set
    if item.final_content is None:
        fc = {"titles": json.loads(item.title_suggestions) if item.title_suggestions else []}
        for p in all_platforms():
            fc[p.key] = getattr(item, p.model_field)
        item.final_content = json.dumps(fc, ensure_ascii=False)

    # Auto-generate distribution strategy
    distribution_ok = False
    try:
        contents = {p.key: getattr(item, p.model_field) for p in all_platforms()}
        dist_result = await run_distribution_strategy(
            idea=item.idea_text,
            content_gzh=contents.get("gzh"),
            content_xhs=contents.get("xhs"),
            content_video_script=contents.get("video"),
            content_bilibili=contents.get("bilibili"),
        )
        item.distribution_strategy = json.dumps(dist_result["strategy"], ensure_ascii=False)
        distribution_ok = True
    except Exception as e:
        logger.error("Distribution strategy failed: %s", e)
        item.distribution_strategy = json.dumps(
            {"error": "distribution_failed", "message": "投放策略生成失败，可稍后重试"},
            ensure_ascii=False,
        )

    await db.commit()
    return {
        "status": "ok",
        "message": "审核通过，可以发布",
        "distribution_ready": distribution_ok,
    }


@router.post("/{idea_id}/review/reject")
async def reject_review(idea_id: str, body: ReviewReject, db: AsyncSession = Depends(get_db)):
    """Reject review for a specific content type — retry production for just that type.

    Flow: review → in_production → review (re-review required, NOT completed).
    Uses optimistic lock to prevent concurrent reject/produce.
    """
    item = await _get_or_404(idea_id, db)

    if item.status != "review":
        raise HTTPException(409, f"状态 {item.status!r} 无法退回重做（需 review）")

    # Optimistic lock
    from sqlalchemy import update as sql_update
    res = await db.execute(
        sql_update(ContentItem)
        .where(ContentItem.id == item.id, ContentItem.status == "review")
        .values(status="in_production")
    )
    if res.rowcount == 0:
        await db.rollback()
        raise HTTPException(409, "该条目正在被另一个请求处理，请稍后重试")
    await db.commit()
    await db.refresh(item)

    try:
        result = await run_content_production(
            item.idea_text,
            [body.retry_type],
            brief=item.brief or "",
        )

        p = get(body.retry_type)
        val = result.get(p.model_field)
        if val is not None:
            setattr(item, p.model_field, val)

        # Back to review — user must re-approve via /review/approve
        item.status = "review"
    except Exception as e:
        logger.exception(f"Retry production failed for {idea_id}/{body.retry_type}: {e}")
        # Restore to review so user keeps the previous content visible
        item.status = "review"
        await db.commit()
        import asyncio
        if isinstance(e, asyncio.CancelledError):
            raise
        raise HTTPException(500, "重做失败，请稍后重试")

    await db.commit()
    await db.refresh(item)
    return _to_detail(item)


@router.post("/{idea_id}/publish")
async def mark_published(idea_id: str, body: PublishAction, db: AsyncSession = Depends(get_db)):
    """Mark as published with optional URL."""
    item = await _get_or_404(idea_id, db)
    if item.status != "completed":
        raise HTTPException(400, "请先通过内容审核（门禁 2）")
    item.publish_url = str(body.publish_url) if body.publish_url else None
    item.notes = body.notes
    item.status = "published"
    await db.commit()
    return {"status": "ok", "message": "已标记为已发布"}


@router.post("/{idea_id}/optimize-titles", response_model=TitleOptimizeResponse)
async def optimize_titles(idea_id: str, db: AsyncSession = Depends(get_db)):
    """Generate 3 alternative titles for the idea content."""
    item = await _get_or_404(idea_id, db)
    existing = json.loads(item.title_suggestions) if item.title_suggestions else []
    result = await run_title_optimization(item.idea_text, existing)
    return TitleOptimizeResponse(titles=result["titles"])


@router.post("/{idea_id}/tts")
async def generate_tts(idea_id: str, db: AsyncSession = Depends(get_db)):
    """Generate TTS audio from video script."""
    item = await _get_or_404(idea_id, db)
    if not item.content_video_script:
        raise HTTPException(400, "请先生成视频脚本")
    try:
        result = await generate_speech(item.content_video_script)
        return {"status": "ok", "url": result["url"], "filename": result["filename"]}
    except TTSError as e:
        raise HTTPException(400, str(e))


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
        gate1_score=item.gate1_score,
        created_at=item.created_at.isoformat() if item.created_at else "",
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

    detail = IdeaDetail(
        id=item.id,
        idea_text=item.idea_text,
        status=item.status,
        gate1_score=item.gate1_score,
        gate1_result=_json(item.gate1_result),
        gate1_passed=item.gate1_passed,
        selected_types=_json(item.selected_types),
        title_suggestions=_json(item.title_suggestions),
        image_plans=_json(item.image_plans),
        video_storyboard=_json(item.video_storyboard),
        final_content=_json(item.final_content),
        publish_url=item.publish_url,
        notes=item.notes,
        distribution_strategy=_json(item.distribution_strategy),
        created_at=item.created_at.isoformat() if item.created_at else "",
        updated_at=item.updated_at.isoformat() if item.updated_at else "",
        version=item.version,
    )
    for p in all_platforms():
        setattr(detail, p.model_field, getattr(item, p.model_field))
    return detail
