"""End-to-end happy path: create → gate1 approve → produce → review → publish."""

import pytest


pytestmark = pytest.mark.asyncio


async def test_full_happy_path(client):
    # 1. Create
    r = await client.post("/api/ideas", json={"idea_text": "测试点子：年轻人开始害怕接电话了"})
    assert r.status_code == 201, r.text
    idea = r.json()
    iid = idea["id"]
    assert idea["status"] == "pending_review"
    assert idea["gate1_score"] == 78  # from fake

    # 2. Gate 1 approve
    r = await client.post(f"/api/ideas/{iid}/gate1/approve")
    assert r.status_code == 200
    r = await client.get(f"/api/ideas/{iid}")
    assert r.json()["status"] == "approved"
    assert r.json()["gate1_passed"] is True

    # 3. Produce gzh + xhs
    r = await client.post(f"/api/ideas/{iid}/produce", json={"types": ["gzh", "xhs"]})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "review"
    assert body["content_gzh"] and "gzh" in body["content_gzh"]
    assert body["content_xhs"] and "xhs" in body["content_xhs"]
    assert body["title_suggestions"] == ["标题A", "标题B", "标题C"]

    # 4. Review approve
    r = await client.post(f"/api/ideas/{iid}/review/approve")
    assert r.status_code == 200
    assert r.json()["distribution_ready"] is True

    # 5. Publish
    r = await client.post(f"/api/ideas/{iid}/publish", json={"notes": "ok"})
    assert r.status_code == 200

    # 6. Final state
    r = await client.get(f"/api/ideas/{iid}")
    final = r.json()
    assert final["status"] == "published"
    assert final["distribution_strategy"] is not None
