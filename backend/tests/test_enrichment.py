"""素材增强 enrichment 端到端测试 — 全程 mock 外部调用。"""
import json

import pytest


@pytest.fixture
def mock_enrichment(monkeypatch):
    """Mock enrichment 的网络层：返回可预测的素材清单。"""
    fake_articles = [
        {"title": "文章1", "url": "https://a.example.com/1", "content": "正文1", "fetched": True},
        {"title": "文章2", "url": "https://a.example.com/2", "content": "正文2", "fetched": True},
    ]
    fake_counter = [
        {"title": "反方1", "url": "https://b.example.com/1", "content": "反对", "fetched": True, "query": "反对 X"},
    ]
    fake_data = [
        {"title": "报告A", "url": "https://c.example.com/r", "content": "数据20%", "fetched": True},
    ]

    from app.services import enrichment as en

    async def fake_topic(idea):
        return fake_articles

    async def fake_counter_fn(idea):
        return fake_counter

    async def fake_data_fn(idea):
        return fake_data

    monkeypatch.setattr(en, "enrich_topic_articles", fake_topic)
    monkeypatch.setattr(en, "enrich_counter_views", fake_counter_fn)
    monkeypatch.setattr(en, "enrich_data_cases", fake_data_fn)
    return {"articles": fake_articles, "counter": fake_counter, "data": fake_data}


@pytest.mark.asyncio
async def test_produce_without_enrichment_works(client):
    """不传 enrichment 字段，应像之前一样工作。"""
    r = await client.post("/api/ideas", json={"idea_text": "测试"})
    iid = r.json()["id"]
    await client.post(f"/api/ideas/{iid}/gate1/approve")
    r2 = await client.post(f"/api/ideas/{iid}/produce", json={"types": ["gzh"]})
    assert r2.status_code == 200
    body = r2.json()
    assert body.get("enrichment_flags") in (None, {})
    assert body.get("enrichment_summary") in (None, {})


@pytest.mark.asyncio
async def test_produce_with_all_enrichment(client, mock_enrichment):
    r = await client.post("/api/ideas", json={"idea_text": "年轻人该早睡吗"})
    iid = r.json()["id"]
    await client.post(f"/api/ideas/{iid}/gate1/approve")
    r2 = await client.post(
        f"/api/ideas/{iid}/produce",
        json={
            "types": ["gzh"],
            "enrichment": {"topic_articles": True, "counter_views": True, "data_cases": True},
        },
    )
    assert r2.status_code == 200, r2.text
    body = r2.json()
    flags = body["enrichment_flags"]
    assert flags == {"topic_articles": True, "counter_views": True, "data_cases": True}
    summary = body["enrichment_summary"]
    assert summary["topic_articles"]["count"] == 2
    assert summary["counter_views"]["count"] == 1
    assert summary["data_cases"]["count"] == 1
    # 来源 URL 透出
    assert summary["topic_articles"]["items"][0]["url"] == "https://a.example.com/1"


@pytest.mark.asyncio
async def test_produce_with_partial_enrichment(client, mock_enrichment):
    """只开 data_cases，其他两个不应触发。"""
    r = await client.post("/api/ideas", json={"idea_text": "x"})
    iid = r.json()["id"]
    await client.post(f"/api/ideas/{iid}/gate1/approve")
    r2 = await client.post(
        f"/api/ideas/{iid}/produce",
        json={"types": ["gzh"], "enrichment": {"data_cases": True}},
    )
    assert r2.status_code == 200
    summary = r2.json()["enrichment_summary"]
    assert "data_cases" in summary
    assert "topic_articles" not in summary
    assert "counter_views" not in summary


@pytest.mark.asyncio
async def test_enrichment_failure_does_not_500(client, monkeypatch):
    """enrichment 内部炸了，produce 仍应成功，只是 enrichment_data 为空。"""
    from app.services import enrichment as en

    async def boom(idea, flags):
        raise RuntimeError("network boom")

    monkeypatch.setattr(en, "run_enrichment", boom)

    r = await client.post("/api/ideas", json={"idea_text": "x"})
    iid = r.json()["id"]
    await client.post(f"/api/ideas/{iid}/gate1/approve")
    r2 = await client.post(
        f"/api/ideas/{iid}/produce",
        json={"types": ["gzh"], "enrichment": {"topic_articles": True}},
    )
    assert r2.status_code == 200, r2.text


@pytest.mark.asyncio
async def test_format_enrichment_for_prompt():
    """格式化函数：有数据时返回非空字符串、包含约束语；无数据时返回空。"""
    from app.services.enrichment import format_enrichment_for_prompt

    assert format_enrichment_for_prompt({}) == ""
    assert format_enrichment_for_prompt({"topic_articles": []}) == ""

    data = {
        "topic_articles": [
            {"title": "T", "url": "https://x.com/1", "content": "正文"}
        ]
    }
    out = format_enrichment_for_prompt(data)
    assert "https://x.com/1" in out
    assert "严禁编造" in out  # 约束语
    assert "来源" in out  # 来源标注约束
