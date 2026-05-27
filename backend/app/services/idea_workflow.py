"""Idea workflow service — all business logic for the content pipeline.

The router layer (`app/routers/ideas.py`) only does HTTP parsing and
response shaping; everything else lives here: state-machine guards,
optimistic locking, LLM orchestration, and DB writes.

Functions raise `fastapi.HTTPException` directly. This is a pragmatic
choice for a single-binary FastAPI app — introducing a custom
`WorkflowError` plus a translation layer would add code without
buying us anything. If we ever split into multiple delivery layers
(CLI, gRPC, etc.) we'll revisit.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import func, select, update as sql_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.platforms import all_platforms, get as pf_get
from app.models import ContentItem
from app.schemas import (
    IdeaDetail,
    IdeaListResponse,
    IdeaSummary,
)
from app.services.agents import (
    run_content_production,
    run_content_review,
    run_distribution_strategy,
    run_title_optimization,
    run_value_judge,
)

logger = logging.getLogger(__name__)


# ── Constants ─────────────────────────────────────────────────────────

VALID_STATUSES: set[str] = {
    "draft", "pending_review", "approved", "rejected",
    "review", "in_production", "production_failed",
    "completed", "published",
}

PRODUCTION_TIMEOUT = timedelta(minutes=10)

# Allowed to enter content production. `pending_review` is NOT here —
# the user must approve Gate 1 first.
PRODUCIBLE_STATES: tuple[str, ...] = ("approved", "review", "production_failed")


# ── Lookups ───────────────────────────────────────────────────────────

async def get_or_404(idea_id: str, db: AsyncSession) -> ContentItem:
    result = await db.execute(select(ContentItem).where(ContentItem.id == idea_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "内容条目不存在")
    return item


async def list_ideas(
    db: AsyncSession,
    status: str | None,
    limit: int,
    offset: int,
    q: str | None = None,
    scene: str | None = None,
) -> IdeaListResponse:
    if status and status not in VALID_STATUSES:
        raise HTTPException(
            400,
            f"无效的状态值: {status!r}，有效值: {', '.join(sorted(VALID_STATUSES))}",
        )
    base = select(ContentItem)
    if status:
        base = base.where(ContentItem.status == status)
    if scene:
        base = base.where(ContentItem.scene == scene)
    if q:
        like = f"%{q.strip()}%"
        base = base.where(
            (ContentItem.idea_text.ilike(like)) | (ContentItem.final_content.ilike(like))
        )

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    rows = (await db.execute(
        base.order_by(ContentItem.created_at.desc()).limit(limit).offset(offset)
    )).scalars().all()
    return IdeaListResponse(
        items=[to_summary(i) for i in rows],
        total=total, limit=limit, offset=offset,
    )


async def review_queue(db: AsyncSession) -> list[IdeaSummary]:
    rows = (await db.execute(
        select(ContentItem)
        .where(ContentItem.status == "completed")
        .order_by(ContentItem.updated_at.desc())
    )).scalars().all()
    return [to_summary(i) for i in rows]


# ── Mutations ────────────────────────────────────────────────────────

async def create_idea(
    db: AsyncSession,
    idea_text: str,
    scene: str | None = None,
    reference_text: str | None = None,
) -> ContentItem:
    """Create an idea + run Gate 1 value judgment. Errors persist but don't 500."""
    # 场景白名单校验
    from app.services.prompt_loader import SCENES
    if scene and scene not in SCENES:
        raise HTTPException(400, f"未知场景: {scene!r}，可选: {', '.join(SCENES.keys())}")
    ref = (reference_text or "").strip() or None
    item = ContentItem(
        idea_text=idea_text,
        scene=scene or None,
        reference_text=ref,
        status="pending_review",
    )
    db.add(item)

    try:
        result = await run_value_judge(idea_text, reference_text=ref)
        item.gate1_score = result["score"]
        details = result.get("details")
        item.gate1_result = json.dumps(
            details if details is not None else {"error": "AI evaluation failed"},
            ensure_ascii=False,
        )
        # 把 Tavily 原始搜索结果存下来，让前端可核对 AI 引用的依据
        search_results = result.get("search_results") or []
        item.gate1_research = json.dumps(
            {"search_results": search_results, "search_used": result.get("search_used", False)},
            ensure_ascii=False,
        )
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
    return item


async def approve_gate1(db: AsyncSession, idea_id: str) -> None:
    item = await get_or_404(idea_id, db)
    if item.status not in ("pending_review", "draft"):
        raise HTTPException(409, f"状态 {item.status!r} 不能进行 Gate 1 审批")
    item.gate1_passed = True
    item.status = "approved"
    await db.commit()


async def reject_gate1(db: AsyncSession, idea_id: str) -> None:
    item = await get_or_404(idea_id, db)
    if item.status not in ("pending_review", "draft"):
        raise HTTPException(409, f"状态 {item.status!r} 不能驳回")
    item.gate1_passed = False
    item.status = "rejected"
    await db.commit()


async def save_brief(db: AsyncSession, idea_id: str, brief_text: str) -> None:
    item = await get_or_404(idea_id, db)
    item.brief = brief_text
    await db.commit()


async def produce_content(
    db: AsyncSession,
    idea_id: str,
    types: list[str],
    enrichment_flags: dict[str, bool] | None = None,
    style_id: str | None = None,
) -> ContentItem:
    """Run content production with optimistic locking.

    Allowed entry states: approved | review | production_failed, plus
    `in_production` if the previous attempt is older than PRODUCTION_TIMEOUT
    (zombie recovery).
    """
    item = await get_or_404(idea_id, db)
    prev_status = item.status

    if prev_status not in PRODUCIBLE_STATES:
        # SQLite 不保留 tzinfo，读回的 datetime 是 naive — 视为 UTC
        started_at = item.production_started_at
        if started_at is not None and started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=timezone.utc)
        is_zombie = (
            prev_status == "in_production"
            and started_at is not None
            and datetime.now(timezone.utc) - started_at > PRODUCTION_TIMEOUT
        )
        if not is_zombie:
            raise HTTPException(409, f"状态 {prev_status!r} 不能生产内容，请先通过价值判断")

    # Optimistic lock — exactly one concurrent request can flip the status.
    res = await db.execute(
        sql_update(ContentItem)
        .where(ContentItem.id == item.id, ContentItem.status == prev_status)
        .values(
            status="in_production",
            selected_types=json.dumps(types, ensure_ascii=False),
            production_started_at=datetime.now(timezone.utc),
            style_id=style_id if style_id is not None else item.style_id,
        )
    )
    if res.rowcount == 0:
        await db.rollback()
        raise HTTPException(409, "该条目正在被另一个请求处理，请稍后重试")
    await db.commit()
    await db.refresh(item)

    try:
        # 素材增强（可选）— 在内容生产前先抓
        extra_research = ""
        if enrichment_flags and any(enrichment_flags.values()):
            from app.services.enrichment import (
                run_enrichment,
                format_enrichment_for_prompt,
            )
            try:
                enrichment_data = await run_enrichment(item.idea_text, enrichment_flags)
                extra_research = format_enrichment_for_prompt(enrichment_data)
                item.enrichment_flags = json.dumps(enrichment_flags, ensure_ascii=False)
                item.enrichment_data = json.dumps(enrichment_data, ensure_ascii=False)
            except Exception as e:  # noqa: BLE001
                logger.exception("enrichment failed (continuing without): %s", e)
                item.enrichment_flags = json.dumps(enrichment_flags, ensure_ascii=False)
                item.enrichment_data = json.dumps({}, ensure_ascii=False)

        result = await run_content_production(
            item.idea_text, types, brief=item.brief or "", scene=item.scene,
            extra_research=extra_research,
            reference_text=item.reference_text,
            style_id=item.style_id,
        )
        for p in all_platforms():
            val = result.get(p.model_field)
            if val is not None:
                setattr(item, p.model_field, val)
        item.title_suggestions = json.dumps(result.get("title_suggestions"), ensure_ascii=False)
        item.image_plans = result.get("image_plans")
        item.video_storyboard = result.get("video_storyboard")
        item.production_raw = json.dumps(result.get("production_raw"), ensure_ascii=False)

        # ── 自我审稿：用户开关控制（默认关，避免无声烧 token）──
        from app.core.config import _load_user_config
        cfg = _load_user_config()
        if cfg.get("auto_review", False):
            review_log: dict = {}
            for p in all_platforms():
                if p.key not in types:
                    continue
                draft = getattr(item, p.model_field, None)
                if not draft:
                    continue
                try:
                    rev = await run_content_review(p.label, draft, idea=item.idea_text, scene=item.scene, style_id=item.style_id)
                    if rev.get("changed") and rev.get("rewritten"):
                        setattr(item, p.model_field, rev["rewritten"])
                    review_log[p.key] = {
                        "changed": rev.get("changed", False),
                        "issues": rev.get("issues", []),
                        "error": rev.get("error"),
                    }
                except Exception as e:
                    logger.exception(f"Review error on {p.key}")
                    review_log[p.key] = {"changed": False, "issues": [], "error": str(e)}
            item.review_log = json.dumps(review_log, ensure_ascii=False)

        item.status = "review"
    except Exception as e:
        logger.error(f"Production failed: {e}")
        try:
            item.status = "production_failed"
            await db.commit()
        except Exception:
            logger.exception("Failed to set production_failed status")
        if isinstance(e, asyncio.CancelledError):
            raise
        raise HTTPException(500, "内容生产失败，请稍后重试")
    else:
        await db.commit()

    await db.refresh(item)
    return item


async def edit_review(
    db: AsyncSession,
    idea_id: str,
    fields: dict,
    final_content: dict | None,
    expected_version: int,
) -> ContentItem:
    """Apply partial edits to content during review (Gate 2).

    `fields` is a dict of model_field → value (already filtered to
    non-None platform contents by the router).
    """
    item = await get_or_404(idea_id, db)

    if item.status not in ("review", "completed"):
        raise HTTPException(409, f"状态 {item.status!r} 不能编辑（需 review 或 completed）")

    updates: dict = dict(fields)
    if final_content is not None:
        updates["final_content"] = json.dumps(final_content, ensure_ascii=False)

    if not updates:
        raise HTTPException(400, "没有提供任何修改内容")

    updates["version"] = item.version + 1

    res = await db.execute(
        sql_update(ContentItem)
        .where(ContentItem.id == item.id, ContentItem.version == expected_version)
        .values(**updates)
    )
    if res.rowcount == 0:
        await db.rollback()
        raise HTTPException(409, "编辑冲突：该条目已被其他用户修改，请刷新后重试")

    await db.commit()
    await db.refresh(item)
    return item


async def approve_review(db: AsyncSession, idea_id: str) -> dict:
    """Approve Gate 2 — content finalized + distribution strategy generated.

    Returns a dict with `distribution_ready: bool` so the router can
    surface whether the auto-strategy succeeded.
    """
    item = await get_or_404(idea_id, db)

    if item.status != "review":
        raise HTTPException(409, f"状态 {item.status!r} 无法进行 Gate 2 审批")

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

    # Snapshot final content if not already set.
    if item.final_content is None:
        fc = {"titles": json.loads(item.title_suggestions) if item.title_suggestions else []}
        for p in all_platforms():
            fc[p.key] = getattr(item, p.model_field)
        item.final_content = json.dumps(fc, ensure_ascii=False)

    # Auto-generate distribution strategy. Failure is non-fatal.
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


async def reject_review(
    db: AsyncSession,
    idea_id: str,
    retry_type: str,
) -> ContentItem:
    """Retry production for a single content type. Returns to `review`."""
    item = await get_or_404(idea_id, db)

    if item.status != "review":
        raise HTTPException(409, f"状态 {item.status!r} 无法退回重做（需 review）")

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
            item.idea_text, [retry_type], brief=item.brief or "", scene=item.scene,
            reference_text=item.reference_text,
            style_id=item.style_id,
        )
        p = pf_get(retry_type)
        val = result.get(p.model_field)
        if val is not None:
            setattr(item, p.model_field, val)
        item.status = "review"
    except Exception as e:
        logger.exception(f"Retry production failed for {idea_id}/{retry_type}: {e}")
        # Restore to review so the user still sees the previous content.
        item.status = "review"
        await db.commit()
        if isinstance(e, asyncio.CancelledError):
            raise
        raise HTTPException(500, "重做失败，请稍后重试")

    await db.commit()
    await db.refresh(item)
    return item


async def mark_published(
    db: AsyncSession,
    idea_id: str,
    publish_url: str | None,
    notes: str | None,
) -> None:
    item = await get_or_404(idea_id, db)
    if item.status != "completed":
        raise HTTPException(400, "请先通过内容审核（门禁 2）")
    item.publish_url = publish_url
    item.notes = notes
    item.status = "published"
    await db.commit()


async def optimize_titles(db: AsyncSession, idea_id: str) -> list[str]:
    item = await get_or_404(idea_id, db)
    existing = json.loads(item.title_suggestions) if item.title_suggestions else []
    result = await run_title_optimization(item.idea_text, existing)
    return result["titles"]


# ── Serializers ──────────────────────────────────────────────────────

def _maybe_json(s):
    """Parse a JSON string, return raw value on failure, None on None."""
    if s is None:
        return None
    try:
        return json.loads(s)
    except (json.JSONDecodeError, TypeError):
        return s


def _enrichment_summary_safe(raw):
    """从 enrichment_data JSON 字段算 summary（兼容空/坏数据）。"""
    try:
        if not raw:
            return None
        data = json.loads(raw) if isinstance(raw, str) else raw
        if not isinstance(data, dict):
            return None
        from app.services.enrichment import enrichment_summary
        s = enrichment_summary(data)
        return s or None
    except Exception:
        return None


def to_summary(item: ContentItem) -> IdeaSummary:
    text = item.idea_text or ""
    return IdeaSummary(
        id=item.id,
        idea_text=text[:100] + ("..." if len(text) > 100 else ""),
        status=item.status,
        gate1_score=item.gate1_score,
        created_at=item.created_at.isoformat() if item.created_at else "",
    )


def to_detail(item: ContentItem) -> IdeaDetail:
    detail = IdeaDetail(
        id=item.id,
        idea_text=item.idea_text,
        scene=item.scene,
        reference_text=getattr(item, "reference_text", None),
        status=item.status,
        gate1_score=item.gate1_score,
        gate1_result=_maybe_json(item.gate1_result),
        gate1_passed=item.gate1_passed,
        gate1_research=_maybe_json(item.gate1_research),
        selected_types=_maybe_json(item.selected_types),
        title_suggestions=_maybe_json(item.title_suggestions),
        image_plans=_maybe_json(item.image_plans),
        video_storyboard=_maybe_json(item.video_storyboard),
        final_content=_maybe_json(item.final_content),
        review_log=_maybe_json(getattr(item, "review_log", None)),
        enrichment_flags=_maybe_json(getattr(item, "enrichment_flags", None)),
        enrichment_data=_maybe_json(getattr(item, "enrichment_data", None)),
        enrichment_summary=_enrichment_summary_safe(getattr(item, "enrichment_data", None)),
        publish_url=item.publish_url,
        notes=item.notes,
        distribution_strategy=_maybe_json(item.distribution_strategy),
        style_id=getattr(item, "style_id", None),
        created_at=item.created_at.isoformat() if item.created_at else "",
        updated_at=item.updated_at.isoformat() if item.updated_at else "",
        version=item.version,
    )
    for p in all_platforms():
        setattr(detail, p.model_field, getattr(item, p.model_field))
    return detail
