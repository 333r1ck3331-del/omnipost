"""Phase 3 — 信息爬取 API.

- /api/feed-sources: RSS 源 CRUD
- /api/crawl: 触发抓取 / 列批次 / 列单批次条目 / 删批次或条目
- /api/crawl/items-to-track: 把抓取条目一键加入赛道
- /api/crawl/items-to-idea: 把抓取条目合并送去生成点子
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, delete as sql_delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import (
    ContentEntry,
    ContentItem,
    CrawlBatch,
    CrawlItem,
    FeedSource,
    Track,
)
from app.schemas import (
    CrawlBatchOut,
    CrawlItemOut,
    CrawlItemsToIdea,
    CrawlItemsToTrack,
    FeedSourceCreate,
    FeedSourceOut,
    FeedSourceUpdate,
)
from app.services.crawler import crawl_all_enabled

logger = logging.getLogger(__name__)
router = APIRouter(tags=["crawl"])


# ── Feed Sources ────────────────────────────────────────────────────

@router.get("/api/feed-sources", response_model=list[FeedSourceOut])
async def list_feed_sources(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(FeedSource).order_by(FeedSource.sort_order, FeedSource.created_at)
    )).scalars().all()
    return list(rows)


@router.post("/api/feed-sources", response_model=FeedSourceOut, status_code=201)
async def create_feed_source(body: FeedSourceCreate, db: AsyncSession = Depends(get_db)):
    url = body.url.strip()
    if not (url.startswith("http://") or url.startswith("https://")):
        raise HTTPException(400, "URL 必须以 http:// 或 https:// 开头")

    existing = (await db.execute(
        select(FeedSource).where(FeedSource.url == url)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(400, f"该 URL 已存在：{existing.name}")

    max_order = (await db.execute(
        select(func.coalesce(func.max(FeedSource.sort_order), -1))
    )).scalar_one()
    src = FeedSource(
        name=body.name.strip(),
        url=url,
        enabled=body.enabled,
        sort_order=int(max_order) + 1,
    )
    db.add(src)
    await db.commit()
    await db.refresh(src)
    return src


@router.patch("/api/feed-sources/{source_id}", response_model=FeedSourceOut)
async def update_feed_source(
    source_id: str,
    body: FeedSourceUpdate,
    db: AsyncSession = Depends(get_db),
):
    src = (await db.execute(
        select(FeedSource).where(FeedSource.id == source_id)
    )).scalar_one_or_none()
    if not src:
        raise HTTPException(404, "订阅源不存在")
    data = body.model_dump(exclude_unset=True)
    if "url" in data:
        url = data["url"].strip()
        if not (url.startswith("http://") or url.startswith("https://")):
            raise HTTPException(400, "URL 必须以 http:// 或 https:// 开头")
        if url != src.url:
            dup = (await db.execute(
                select(FeedSource).where(FeedSource.url == url)
            )).scalar_one_or_none()
            if dup:
                raise HTTPException(400, f"该 URL 已存在：{dup.name}")
        data["url"] = url
    for k, v in data.items():
        setattr(src, k, v)
    await db.commit()
    await db.refresh(src)
    return src


@router.delete("/api/feed-sources/{source_id}", status_code=204)
async def delete_feed_source(source_id: str, db: AsyncSession = Depends(get_db)):
    src = (await db.execute(
        select(FeedSource).where(FeedSource.id == source_id)
    )).scalar_one_or_none()
    if not src:
        raise HTTPException(404, "订阅源不存在")
    await db.delete(src)
    await db.commit()
    return None


# ── Crawl batches ───────────────────────────────────────────────────

@router.post("/api/crawl/run", response_model=CrawlBatchOut, status_code=201)
async def trigger_crawl(db: AsyncSession = Depends(get_db)):
    """触发一次抓取：并发拉取所有启用的源 → 写入新批次。"""
    batch = await crawl_all_enabled(db)
    return batch


@router.get("/api/crawl/batches", response_model=list[CrawlBatchOut])
async def list_batches(
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(CrawlBatch).order_by(CrawlBatch.triggered_at.desc()).limit(min(limit, 500))
    )).scalars().all()
    return list(rows)


@router.get("/api/crawl/batches/{batch_id}/items", response_model=list[CrawlItemOut])
async def list_batch_items(batch_id: str, db: AsyncSession = Depends(get_db)):
    batch = (await db.execute(
        select(CrawlBatch).where(CrawlBatch.id == batch_id)
    )).scalar_one_or_none()
    if not batch:
        raise HTTPException(404, "批次不存在")
    rows = (await db.execute(
        select(CrawlItem)
        .where(CrawlItem.batch_id == batch_id)
        .order_by(CrawlItem.published_at.desc().nullslast(), CrawlItem.created_at)
    )).scalars().all()
    return list(rows)


@router.delete("/api/crawl/batches/{batch_id}", status_code=204)
async def delete_batch(batch_id: str, db: AsyncSession = Depends(get_db)):
    batch = (await db.execute(
        select(CrawlBatch).where(CrawlBatch.id == batch_id)
    )).scalar_one_or_none()
    if not batch:
        raise HTTPException(404, "批次不存在")
    await db.delete(batch)
    await db.commit()
    return None


@router.delete("/api/crawl/items/{item_id}", status_code=204)
async def delete_item(item_id: str, db: AsyncSession = Depends(get_db)):
    item = (await db.execute(
        select(CrawlItem).where(CrawlItem.id == item_id)
    )).scalar_one_or_none()
    if not item:
        raise HTTPException(404, "条目不存在")
    await db.delete(item)
    await db.commit()
    return None


# ── 联动：加入赛道 / 送去生成点子 ───────────────────────────────────

@router.post("/api/crawl/items-to-track")
async def crawl_items_to_track(body: CrawlItemsToTrack, db: AsyncSession = Depends(get_db)):
    """把多条抓取条目作为新条目加入指定赛道。"""
    track = (await db.execute(
        select(Track).where(Track.id == body.track_id)
    )).scalar_one_or_none()
    if not track:
        raise HTTPException(404, "赛道不存在")

    items = (await db.execute(
        select(CrawlItem).where(CrawlItem.id.in_(body.item_ids))
    )).scalars().all()
    if not items:
        raise HTTPException(400, "未找到任何抓取条目")

    max_order = (await db.execute(
        select(func.coalesce(func.max(ContentEntry.sort_order), -1))
        .where(ContentEntry.track_id == body.track_id)
    )).scalar_one()
    next_order = int(max_order) + 1

    created_ids = []
    for it in items:
        # notes = 摘要 + 来源 + 原文链接
        notes_parts = []
        if it.summary:
            notes_parts.append(it.summary)
        notes_parts.append(f"[来源] {it.source_name or '未知'}")
        notes_parts.append(f"[原文] {it.link}")
        entry = ContentEntry(
            track_id=body.track_id,
            title=it.title[:200],
            topic_direction=None,
            status="to_edit",
            notes="\n".join(notes_parts),
            sort_order=next_order,
        )
        db.add(entry)
        next_order += 1
        created_ids.append(entry.id)

    await db.commit()
    return {"created": len(created_ids), "track_id": body.track_id}


@router.post("/api/crawl/items-to-idea")
async def crawl_items_to_idea(body: CrawlItemsToIdea, db: AsyncSession = Depends(get_db)):
    """把多条抓取条目合并为一条 idea_text，新建一个 ContentItem（点子）。"""
    items = (await db.execute(
        select(CrawlItem).where(CrawlItem.id.in_(body.item_ids))
    )).scalars().all()
    if not items:
        raise HTTPException(400, "未找到任何抓取条目")

    # 合并为一段文本
    parts = []
    for i, it in enumerate(items, start=1):
        block = [f"【{i}】{it.title}"]
        if it.source_name:
            block.append(f"  来源：{it.source_name}")
        if it.summary:
            block.append(f"  摘要：{it.summary}")
        block.append(f"  链接：{it.link}")
        parts.append("\n".join(block))
    idea_text = "\n\n".join(parts)

    new_idea = ContentItem(
        idea_text=idea_text,
        brief=body.brief,
        status="draft",
    )
    db.add(new_idea)
    await db.commit()
    await db.refresh(new_idea)
    return {"id": new_idea.id, "merged_count": len(items)}
