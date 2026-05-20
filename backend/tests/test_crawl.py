"""Phase 3 信息爬取测试 — 源 CRUD + 抓取（mock RSS） + 联动。"""

from __future__ import annotations

from unittest.mock import patch, AsyncMock

import pytest
import pytest_asyncio
from sqlalchemy import delete as sql_delete

from app.core.database import async_session
from app.models import CrawlBatch, CrawlItem, ContentEntry, ContentItem, FeedSource, Track


pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture(autouse=True)
async def _clean_crawl_tables():
    """每个测试前清空相关表，避免互相污染。"""
    async with async_session() as db:
        # 顺序：先子后父
        await db.execute(sql_delete(CrawlItem))
        await db.execute(sql_delete(CrawlBatch))
        await db.execute(sql_delete(FeedSource))
        await db.execute(sql_delete(ContentEntry))
        await db.execute(sql_delete(Track))
        await db.execute(sql_delete(ContentItem))
        await db.commit()
    yield


# ── Feed sources CRUD ─────────────────────────────────────────────

async def test_feed_source_crud(client):
    # empty
    r = await client.get("/api/feed-sources")
    assert r.status_code == 200 and r.json() == []

    # create
    r = await client.post("/api/feed-sources", json={
        "name": "虎嗅",
        "url": "https://www.huxiu.com/rss/0.xml",
    })
    assert r.status_code == 201
    src = r.json()
    assert src["enabled"] is True and src["name"] == "虎嗅"
    sid = src["id"]

    # duplicate url → 400
    r = await client.post("/api/feed-sources", json={"name": "虎嗅2", "url": "https://www.huxiu.com/rss/0.xml"})
    assert r.status_code == 400

    # bad url
    r = await client.post("/api/feed-sources", json={"name": "x", "url": "not-a-url"})
    assert r.status_code == 400

    # patch (disable)
    r = await client.patch(f"/api/feed-sources/{sid}", json={"enabled": False})
    assert r.status_code == 200 and r.json()["enabled"] is False

    # delete
    r = await client.delete(f"/api/feed-sources/{sid}")
    assert r.status_code == 204

    r = await client.get("/api/feed-sources")
    assert r.json() == []


# ── Crawl with mocked HTTP ────────────────────────────────────────

_FAKE_RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>Fake Feed</title>
<item>
  <title>文章A</title>
  <link>https://example.com/a</link>
  <description>摘要A的内容</description>
  <pubDate>Mon, 19 May 2026 08:00:00 GMT</pubDate>
</item>
<item>
  <title>文章B</title>
  <link>https://example.com/b</link>
  <description>摘要B</description>
</item>
</channel></rss>
""".encode("utf-8")

_FAKE_RSS_DUP = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>Another Feed</title>
<item>
  <title>文章A 重复</title>
  <link>https://example.com/a</link>
  <description>同一篇</description>
</item>
<item>
  <title>文章C</title>
  <link>https://example.com/c</link>
</item>
</channel></rss>
""".encode("utf-8")


class _FakeResp:
    def __init__(self, content):
        self.content = content
    def raise_for_status(self):
        pass


async def _fake_get(self, url, **kw):
    if "dup" in url:
        return _FakeResp(_FAKE_RSS_DUP)
    if "fail" in url:
        import httpx
        raise httpx.ConnectError("dns fail")
    return _FakeResp(_FAKE_RSS)


async def test_crawl_run_dedups_and_handles_errors(client):
    # 3 个源：正常 + 重复内容 + 失败
    for name, url in [
        ("Feed1", "https://feed1.test/rss"),
        ("Feed2-dup", "https://dup.test/rss"),
        ("Feed3-fail", "https://fail.test/rss"),
    ]:
        await client.post("/api/feed-sources", json={"name": name, "url": url})

    with patch("httpx.AsyncClient.get", new=_fake_get):
        r = await client.post("/api/crawl/run")
    assert r.status_code == 201
    batch = r.json()
    # 去重后：a, b, c 共 3 条（dup 的 a 被去掉）
    assert batch["item_count"] == 3
    assert batch["source_count"] == 3
    # note 中应包含失败信息
    assert "失败 1" in batch["note"]

    bid = batch["id"]

    # 列条目
    r = await client.get(f"/api/crawl/batches/{bid}/items")
    items = r.json()
    assert len(items) == 3
    links = {it["link"] for it in items}
    assert links == {"https://example.com/a", "https://example.com/b", "https://example.com/c"}

    # 列批次
    r = await client.get("/api/crawl/batches")
    assert len(r.json()) == 1

    return bid, [it["id"] for it in items]


async def test_crawl_no_sources(client):
    """没源也能抓，建一个空批次。"""
    with patch("httpx.AsyncClient.get", new=_fake_get):
        r = await client.post("/api/crawl/run")
    assert r.status_code == 201
    assert r.json()["item_count"] == 0
    assert "没有启用的订阅源" in r.json()["note"]


async def test_crawl_disabled_source_skipped(client):
    await client.post("/api/feed-sources", json={"name": "F1", "url": "https://f1.test/rss"})
    r = await client.post("/api/feed-sources", json={"name": "F2", "url": "https://f2.test/rss", "enabled": False})
    with patch("httpx.AsyncClient.get", new=_fake_get):
        r = await client.post("/api/crawl/run")
    # 只抓了 1 个源
    assert r.json()["source_count"] == 1


async def test_crawl_items_to_track(client):
    # 准备：1 个源 + 1 次抓取
    await client.post("/api/feed-sources", json={"name": "F", "url": "https://f.test/rss"})
    with patch("httpx.AsyncClient.get", new=_fake_get):
        r = await client.post("/api/crawl/run")
    bid = r.json()["id"]
    items = (await client.get(f"/api/crawl/batches/{bid}/items")).json()
    item_ids = [it["id"] for it in items]

    # 建赛道
    r = await client.post("/api/tracks", json={"name": "AI 赛道"})
    tid = r.json()["id"]

    # 加入赛道
    r = await client.post("/api/crawl/items-to-track", json={
        "item_ids": item_ids,
        "track_id": tid,
    })
    assert r.status_code == 200
    assert r.json()["created"] == 2

    # 赛道下确实有 2 条
    entries = (await client.get(f"/api/tracks/{tid}/entries")).json()
    assert len(entries) == 2
    # notes 应包含原文链接
    assert any("https://example.com/" in (e["notes"] or "") for e in entries)


async def test_crawl_items_to_idea(client):
    await client.post("/api/feed-sources", json={"name": "F", "url": "https://f.test/rss"})
    with patch("httpx.AsyncClient.get", new=_fake_get):
        r = await client.post("/api/crawl/run")
    bid = r.json()["id"]
    items = (await client.get(f"/api/crawl/batches/{bid}/items")).json()
    item_ids = [it["id"] for it in items]

    r = await client.post("/api/crawl/items-to-idea", json={
        "item_ids": item_ids,
        "brief": "请综合这两篇写一篇新闻速递",
    })
    assert r.status_code == 200
    assert r.json()["merged_count"] == 2
    idea_id = r.json()["id"]

    # 验证 idea 真的建出来了
    r = await client.get(f"/api/ideas/{idea_id}")
    assert r.status_code == 200
    assert "文章A" in r.json()["idea_text"]
    assert "文章B" in r.json()["idea_text"]


async def test_delete_batch_cascades(client):
    await client.post("/api/feed-sources", json={"name": "F", "url": "https://f.test/rss"})
    with patch("httpx.AsyncClient.get", new=_fake_get):
        r = await client.post("/api/crawl/run")
    bid = r.json()["id"]

    # 删批次
    r = await client.delete(f"/api/crawl/batches/{bid}")
    assert r.status_code == 204

    # items 应自动消失
    r = await client.get(f"/api/crawl/batches/{bid}/items")
    assert r.status_code == 404


async def test_delete_single_item(client):
    await client.post("/api/feed-sources", json={"name": "F", "url": "https://f.test/rss"})
    with patch("httpx.AsyncClient.get", new=_fake_get):
        r = await client.post("/api/crawl/run")
    bid = r.json()["id"]
    items = (await client.get(f"/api/crawl/batches/{bid}/items")).json()
    iid = items[0]["id"]

    r = await client.delete(f"/api/crawl/items/{iid}")
    assert r.status_code == 204

    items2 = (await client.get(f"/api/crawl/batches/{bid}/items")).json()
    assert len(items2) == 1
