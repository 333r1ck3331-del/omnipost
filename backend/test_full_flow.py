"""Full flow test: idea → gate1 → produce → review → publish + edge cases.

Run: python test_full_flow.py
"""
import asyncio, json, sys
sys.path.insert(0, "/opt/data/omnipost/backend")

from app.core.database import init_db
from main import app
from httpx import AsyncClient, ASGITransport


# ── Happy path ──

async def test_happy_path(client):
    print("\n[test_happy_path]")
    r = await client.post("/api/ideas", json={"idea_text": "年轻人开始害怕接电话了"})
    assert r.status_code == 201, f"Step 1 failed: {r.status_code}"
    idea = r.json()
    iid = idea["id"]
    print(f"   ✓ Score: {idea['gate1_score']}/100")

    r = await client.post(f"/api/ideas/{iid}/gate1/approve")
    assert r.status_code == 200
    print("   ✓ Gate1 approved")

    r = await client.post(f"/api/ideas/{iid}/produce", json={"types": ["gzh", "xhs"]})
    assert r.status_code == 200, f"Produce failed: {r.status_code} {r.text[:200]}"
    idea = r.json()
    print(f"   ✓ GZH: {len(idea['content_gzh'] or '')} chars | XHS: {len(idea['content_xhs'] or '')} chars")

    r = await client.post(f"/api/ideas/{iid}/review/approve")
    assert r.status_code == 200
    print("   ✓ Review approved")

    r = await client.post(f"/api/ideas/{iid}/publish", json={"notes": "test"})
    assert r.status_code == 200
    print("   ✓ Published")


# ── Edge cases ──

async def test_gate1_reject(client):
    """Path: create → gate1/reject → rejected (terminal)."""
    print("\n[test_gate1_reject]")
    r = await client.post("/api/ideas", json={"idea_text": "测试驳回点子"})
    assert r.status_code == 201
    iid = r.json()["id"]
    r = await client.post(f"/api/ideas/{iid}/gate1/reject")
    assert r.status_code == 200
    r = await client.get(f"/api/ideas/{iid}")
    assert r.json()["status"] == "rejected"
    # Rejected is terminal — produce should fail
    r = await client.post(f"/api/ideas/{iid}/produce", json={"types": ["gzh"]})
    assert r.status_code == 409, f"rejected idea should not produce: {r.status_code}"
    print("   ✓ rejected is terminal")


async def test_produce_before_gate1(client):
    """Cannot produce while still pending_review."""
    print("\n[test_produce_before_gate1]")
    r = await client.post("/api/ideas", json={"idea_text": "未审批就生产"})
    iid = r.json()["id"]
    r = await client.post(f"/api/ideas/{iid}/produce", json={"types": ["gzh"]})
    assert r.status_code == 409, f"expected 409, got {r.status_code}"
    print("   ✓ produce blocked before gate1")


async def test_review_reject_returns_to_review(client):
    """review/reject must land back in 'review', NOT 'completed' (Gate 2 not auto-passed)."""
    print("\n[test_review_reject_returns_to_review]")
    r = await client.post("/api/ideas", json={"idea_text": "退回重做测试"})
    iid = r.json()["id"]
    await client.post(f"/api/ideas/{iid}/gate1/approve")
    await client.post(f"/api/ideas/{iid}/produce", json={"types": ["gzh", "xhs"]})
    r = await client.post(f"/api/ideas/{iid}/review/reject", json={"retry_type": "gzh"})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "review", \
        f"after reject should be 'review' not {r.json()['status']!r}"
    print("   ✓ reject returns to review (Gate 2 still required)")


async def test_concurrent_produce(client):
    """Two simultaneous produce calls — only one should win."""
    print("\n[test_concurrent_produce]")
    r = await client.post("/api/ideas", json={"idea_text": "并发测试"})
    iid = r.json()["id"]
    await client.post(f"/api/ideas/{iid}/gate1/approve")

    r1, r2 = await asyncio.gather(
        client.post(f"/api/ideas/{iid}/produce", json={"types": ["gzh"]}),
        client.post(f"/api/ideas/{iid}/produce", json={"types": ["xhs"]}),
        return_exceptions=True,
    )
    statuses = sorted([getattr(r, "status_code", 0) for r in (r1, r2)])
    assert 200 in statuses and 409 in statuses, f"got {statuses}"
    print(f"   ✓ concurrent produce: {statuses}")


async def test_publish_requires_completed(client):
    """publish before review/approve must fail."""
    print("\n[test_publish_requires_completed]")
    r = await client.post("/api/ideas", json={"idea_text": "提前发布"})
    iid = r.json()["id"]
    await client.post(f"/api/ideas/{iid}/gate1/approve")
    await client.post(f"/api/ideas/{iid}/produce", json={"types": ["gzh"]})
    # Status now 'review', not 'completed'
    r = await client.post(f"/api/ideas/{iid}/publish", json={"notes": "x"})
    assert r.status_code == 400
    print("   ✓ publish blocked before Gate 2")


async def test_brief_and_edit(client):
    """Brief save + review edit."""
    print("\n[test_brief_and_edit]")
    r = await client.post("/api/ideas", json={"idea_text": "测试 brief"})
    iid = r.json()["id"]
    r = await client.post(f"/api/ideas/{iid}/brief", json={"brief_text": "口语化"})
    assert r.status_code == 200
    await client.post(f"/api/ideas/{iid}/gate1/approve")
    await client.post(f"/api/ideas/{iid}/produce", json={"types": ["gzh"]})
    r = await client.patch(f"/api/ideas/{iid}/review/edit", json={"content_gzh": "手动改写", "version": 1})
    assert r.status_code == 200
    assert r.json()["content_gzh"] == "手动改写"
    print("   ✓ brief + edit")


# ── Runner ──

async def main():
    # DB tables created by FastAPI lifespan; init_db() called twice is harmless but noisy
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test", timeout=180) as client:
        tests = [
            test_happy_path,
            test_gate1_reject,
            test_produce_before_gate1,
            test_review_reject_returns_to_review,
            test_concurrent_produce,
            test_publish_requires_completed,
            test_brief_and_edit,
        ]
        passed = 0
        failed = 0
        for test in tests:
            try:
                await test(client)
                passed += 1
            except Exception as e:
                failed += 1
                print(f"   ❌ {test.__name__} FAILED: {e}")

        print(f"\n{'='*50}")
        print(f"Results: {passed} passed, {failed} failed out of {len(tests)}")
        print(f"{'='*50}")


asyncio.run(main())
