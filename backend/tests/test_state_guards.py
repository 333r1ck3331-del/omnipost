"""State-machine guards: every illegal transition must 4xx, not 500."""

import pytest


pytestmark = pytest.mark.asyncio


async def _new_idea(client, text="边界测试"):
    r = await client.post("/api/ideas", json={"idea_text": text})
    assert r.status_code == 201
    return r.json()["id"]


async def test_produce_before_gate1_blocked(client):
    iid = await _new_idea(client, "未通过 Gate1 就生产")
    r = await client.post(f"/api/ideas/{iid}/produce", json={"types": ["gzh"]})
    assert r.status_code == 409


async def test_publish_before_gate2_blocked(client):
    iid = await _new_idea(client, "未通过 Gate2 就发布")
    await client.post(f"/api/ideas/{iid}/gate1/approve")
    await client.post(f"/api/ideas/{iid}/produce", json={"types": ["gzh"]})
    # Now in review — publish should fail
    r = await client.post(f"/api/ideas/{iid}/publish", json={})
    assert r.status_code == 400


async def test_rejected_is_terminal(client):
    iid = await _new_idea(client, "驳回后终结")
    r = await client.post(f"/api/ideas/{iid}/gate1/reject")
    assert r.status_code == 200
    r = await client.post(f"/api/ideas/{iid}/produce", json={"types": ["gzh"]})
    assert r.status_code == 409


async def test_review_reject_returns_to_review(client):
    """After /review/reject, status must be 'review' so Gate 2 is still required."""
    iid = await _new_idea(client, "退回重做")
    await client.post(f"/api/ideas/{iid}/gate1/approve")
    await client.post(f"/api/ideas/{iid}/produce", json={"types": ["gzh", "xhs"]})
    r = await client.post(f"/api/ideas/{iid}/review/reject", json={"retry_type": "gzh"})
    assert r.status_code == 200, r.text
    r = await client.get(f"/api/ideas/{iid}")
    assert r.json()["status"] == "review"


async def test_get_404_for_unknown_id(client):
    r = await client.get("/api/ideas/this-id-does-not-exist")
    assert r.status_code == 404
