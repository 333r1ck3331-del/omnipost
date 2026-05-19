"""Optimistic locks: concurrent produce must let exactly one win."""

import asyncio
import pytest


pytestmark = pytest.mark.asyncio


async def test_concurrent_produce_only_one_wins(client):
    r = await client.post("/api/ideas", json={"idea_text": "并发生产"})
    iid = r.json()["id"]
    await client.post(f"/api/ideas/{iid}/gate1/approve")

    r1, r2 = await asyncio.gather(
        client.post(f"/api/ideas/{iid}/produce", json={"types": ["gzh"]}),
        client.post(f"/api/ideas/{iid}/produce", json={"types": ["xhs"]}),
    )
    statuses = sorted([r1.status_code, r2.status_code])
    assert statuses == [200, 409], f"expected exactly one winner, got {statuses}"


async def test_edit_with_stale_version_conflicts(client):
    r = await client.post("/api/ideas", json={"idea_text": "版本冲突"})
    iid = r.json()["id"]
    await client.post(f"/api/ideas/{iid}/gate1/approve")
    await client.post(f"/api/ideas/{iid}/produce", json={"types": ["gzh"]})

    # First edit with correct version
    r = await client.patch(
        f"/api/ideas/{iid}/review/edit",
        json={"content_gzh": "改一次", "version": 1},
    )
    assert r.status_code == 200

    # Second edit with stale version
    r = await client.patch(
        f"/api/ideas/{iid}/review/edit",
        json={"content_gzh": "再改一次", "version": 1},
    )
    assert r.status_code == 409
