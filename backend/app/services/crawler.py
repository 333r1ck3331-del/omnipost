"""RSS 抓取服务 — 并发拉取所有启用的源，去重，写入数据库。"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

import feedparser
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CrawlBatch, CrawlItem, FeedSource

logger = logging.getLogger(__name__)

# 单源抓取超时（秒）
FETCH_TIMEOUT = 15.0
# 单源最多取多少条（避免老源一次返回几百条）
MAX_ITEMS_PER_SOURCE = 50


def _parse_dt(struct_time) -> Optional[datetime]:
    """feedparser 的 struct_time → aware datetime。"""
    if not struct_time:
        return None
    try:
        # struct_time 是 UTC
        return datetime(*struct_time[:6], tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def _extract_summary(entry) -> Optional[str]:
    """从 RSS entry 取摘要，截断到 1000 字符。"""
    raw = (
        entry.get("summary")
        or entry.get("description")
        or (entry.get("content", [{}])[0].get("value") if entry.get("content") else None)
    )
    if not raw:
        return None
    # 简单去 HTML 标签（不用 BeautifulSoup，保持轻量）
    import re
    text = re.sub(r"<[^>]+>", "", raw)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:1000] if text else None


async def _fetch_one(client: httpx.AsyncClient, source: FeedSource) -> tuple[list[dict], Optional[str]]:
    """抓一个源 → (items, error_msg)。失败返回空列表 + 错误描述。"""
    try:
        r = await client.get(source.url, timeout=FETCH_TIMEOUT, follow_redirects=True)
        r.raise_for_status()
    except httpx.HTTPError as e:
        return [], f"HTTP 错误：{type(e).__name__}: {e}"
    except Exception as e:
        return [], f"抓取异常：{type(e).__name__}: {e}"

    try:
        parsed = feedparser.parse(r.content)
    except Exception as e:
        return [], f"RSS 解析失败：{e}"

    if parsed.bozo and not parsed.entries:
        return [], f"RSS 格式无效：{parsed.bozo_exception}"

    items = []
    for entry in parsed.entries[:MAX_ITEMS_PER_SOURCE]:
        link = entry.get("link", "").strip()
        title = (entry.get("title") or "").strip()
        if not link or not title:
            continue
        items.append({
            "title": title[:500],
            "link": link,
            "summary": _extract_summary(entry),
            "content": None,  # 不抓正文，太重；用户点"打开原文"看
            "author": (entry.get("author") or "").strip()[:200] or None,
            "published_at": _parse_dt(entry.get("published_parsed") or entry.get("updated_parsed")),
        })
    return items, None


async def crawl_all_enabled(db: AsyncSession) -> CrawlBatch:
    """抓取所有 enabled=True 的源，写入一个新 batch。返回 batch。

    去重逻辑：同一次抓取内按 link 去重（不同源都抓到同一文章只保留第一个）。
    """
    sources = (await db.execute(
        select(FeedSource).where(FeedSource.enabled == True).order_by(FeedSource.sort_order)
    )).scalars().all()

    if not sources:
        # 没源也建批次，让用户看到"这次抓了 0 篇"
        batch = CrawlBatch(source_count=0, item_count=0, note="没有启用的订阅源")
        db.add(batch)
        await db.commit()
        await db.refresh(batch)
        return batch

    # 并发抓
    async with httpx.AsyncClient(headers={"User-Agent": "OmniPost/1.0 RSS Reader"}) as client:
        results = await asyncio.gather(
            *[_fetch_one(client, s) for s in sources],
            return_exceptions=False,
        )

    seen_links: set[str] = set()
    all_items: list[CrawlItem] = []
    errors: list[str] = []
    now = datetime.now(timezone.utc)

    for source, (items, err) in zip(sources, results):
        source.last_fetched_at = now
        if err:
            source.last_error = err
            errors.append(f"{source.name}: {err}")
            continue
        source.last_error = None
        for it in items:
            if it["link"] in seen_links:
                continue
            seen_links.add(it["link"])
            all_items.append(CrawlItem(
                source_id=source.id,
                source_name=source.name,
                **it,
            ))

    note_parts = [f"抓取 {len(sources)} 个源"]
    if errors:
        note_parts.append(f"失败 {len(errors)} 个")
        note_parts.append("：" + "；".join(errors[:5]))  # 前 5 条错误
    note = " | ".join(note_parts)

    batch = CrawlBatch(
        source_count=len(sources),
        item_count=len(all_items),
        note=note,
    )
    db.add(batch)
    await db.flush()  # 拿到 batch.id

    for it in all_items:
        it.batch_id = batch.id
    db.add_all(all_items)

    await db.commit()
    await db.refresh(batch)
    return batch
