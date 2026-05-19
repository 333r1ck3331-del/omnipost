"""Health + basic listing — fastest smoke test."""

import pytest


pytestmark = pytest.mark.asyncio


async def test_health(client):
    r = await client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


async def test_list_empty_ok(client):
    r = await client.get("/api/ideas?limit=1")
    assert r.status_code == 200
    body = r.json()
    assert "items" in body
    assert "total" in body
    assert isinstance(body["items"], list)


async def test_list_invalid_status_400(client):
    r = await client.get("/api/ideas?status=not_a_state")
    assert r.status_code == 400
