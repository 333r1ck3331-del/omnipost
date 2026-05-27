"""Idea management API routes — thin HTTP shell over idea_workflow service."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.platforms import all_platforms
from app.schemas import (
    BriefRequest,
    IdeaCreate,
    IdeaDetail,
    IdeaListResponse,
    IdeaSummary,
    ProduceRequest,
    PublishAction,
    ReviewEdit,
    ReviewReject,
    TitleOptimizeResponse,
)
from app.services import idea_workflow as wf
from app.services.tts import TTSError, generate_speech

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ideas", tags=["ideas"])


@router.get("/scenes")
async def list_scenes():
    """场景白名单 — 给前端下拉用。"""
    from app.services.prompt_loader import SCENES
    return {"scenes": [{"value": k, "label": v} for k, v in SCENES.items()]}


# ── Reads ────────────────────────────────────────────────────────────

@router.get("", response_model=IdeaListResponse)
async def list_ideas(
    status: str | None = None,
    q: str | None = None,
    scene: str | None = None,
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await wf.list_ideas(db, status, limit, offset, q=q, scene=scene)


@router.get("/queue/review", response_model=list[IdeaSummary])
async def review_queue(db: AsyncSession = Depends(get_db)):
    return await wf.review_queue(db)


@router.get("/{idea_id}", response_model=IdeaDetail)
async def get_idea(idea_id: str, db: AsyncSession = Depends(get_db)):
    item = await wf.get_or_404(idea_id, db)
    return wf.to_detail(item)


# ── Create + Gate 1 ──────────────────────────────────────────────────

@router.post("", response_model=IdeaDetail, status_code=201)
async def create_idea(body: IdeaCreate, db: AsyncSession = Depends(get_db)):
    item = await wf.create_idea(
        db,
        body.idea_text,
        scene=body.scene,
        reference_text=body.reference_text,
    )
    return wf.to_detail(item)


@router.post("/{idea_id}/gate1/approve")
async def approve_gate1(idea_id: str, db: AsyncSession = Depends(get_db)):
    await wf.approve_gate1(db, idea_id)
    return {"status": "ok", "message": "已通过价值判断，可以开始生产内容"}


@router.post("/{idea_id}/gate1/reject")
async def reject_gate1(idea_id: str, db: AsyncSession = Depends(get_db)):
    await wf.reject_gate1(db, idea_id)
    return {"status": "ok", "message": "已驳回"}


@router.post("/{idea_id}/brief")
async def save_brief(idea_id: str, body: BriefRequest, db: AsyncSession = Depends(get_db)):
    await wf.save_brief(db, idea_id, body.brief_text)
    return {"status": "ok", "message": "Brief saved"}


# ── Production ───────────────────────────────────────────────────────

@router.post("/{idea_id}/produce")
async def produce_content(
    idea_id: str,
    body: ProduceRequest,
    db: AsyncSession = Depends(get_db),
):
    item = await wf.produce_content(db, idea_id, body.types, enrichment_flags=body.enrichment, style_id=body.style_id)
    return wf.to_detail(item)


# ── Review (Gate 2) ──────────────────────────────────────────────────

@router.patch("/{idea_id}/review/edit")
async def edit_review(idea_id: str, body: ReviewEdit, db: AsyncSession = Depends(get_db)):
    fields = {
        p.model_field: getattr(body, p.model_field)
        for p in all_platforms()
        if getattr(body, p.model_field, None) is not None
    }
    item = await wf.edit_review(db, idea_id, fields, body.final_content, body.version)
    return wf.to_detail(item)


@router.post("/{idea_id}/review/approve")
async def approve_review(idea_id: str, db: AsyncSession = Depends(get_db)):
    return await wf.approve_review(db, idea_id)


@router.post("/{idea_id}/review/reject")
async def reject_review(idea_id: str, body: ReviewReject, db: AsyncSession = Depends(get_db)):
    item = await wf.reject_review(db, idea_id, body.retry_type)
    return wf.to_detail(item)


# ── Publish ──────────────────────────────────────────────────────────

@router.post("/{idea_id}/publish")
async def mark_published(idea_id: str, body: PublishAction, db: AsyncSession = Depends(get_db)):
    publish_url = str(body.publish_url) if body.publish_url else None
    await wf.mark_published(db, idea_id, publish_url, body.notes)
    return {"status": "ok", "message": "已标记为已发布"}


# ── Misc ─────────────────────────────────────────────────────────────

@router.post("/{idea_id}/optimize-titles", response_model=TitleOptimizeResponse)
async def optimize_titles(idea_id: str, db: AsyncSession = Depends(get_db)):
    titles = await wf.optimize_titles(db, idea_id)
    return TitleOptimizeResponse(titles=titles)


@router.post("/{idea_id}/tts")
async def generate_tts(idea_id: str, db: AsyncSession = Depends(get_db)):
    item = await wf.get_or_404(idea_id, db)
    if not item.content_video_script:
        raise HTTPException(400, "请先生成视频脚本")
    try:
        result = await generate_speech(item.content_video_script)
        return {"status": "ok", "url": result["url"], "filename": result["filename"]}
    except TTSError as e:
        raise HTTPException(400, str(e))
