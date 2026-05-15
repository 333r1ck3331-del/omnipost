"""Full flow test: idea → gate1 → produce → review."""
import asyncio, json, sys
sys.path.insert(0, "/opt/data/omnipost/backend")

from app.core.database import init_db
from main import app
from httpx import AsyncClient, ASGITransport

async def main():
    await init_db()
    transport = ASGITransport(app=app)
    
    async with AsyncClient(transport=transport, base_url="http://test", timeout=180) as client:
        # Step 1: Create idea (Gate 1 auto-runs)
        print("1. Submitting idea...")
        r = await client.post("/api/ideas", json={
            "idea_text": "年轻人开始害怕接电话了",
            "track": "psychology",
            "tone": "clear_empathy",
        })
        assert r.status_code == 201, f"Step 1 failed: {r.status_code}"
        idea = r.json()
        idea_id = idea["id"]
        score = idea["gate1_score"]
        verdict = idea["gate1_result"].get("verdict", "?")
        print(f"   ✓ Score: {score}/100 — {verdict[:60]}")
        
        # Step 2: Approve gate 1
        print("2. Approving gate 1...")
        r = await client.post(f"/api/ideas/{idea_id}/gate1/approve")
        assert r.status_code == 200, f"Step 2 failed: {r.status_code}"
        print("   ✓ Approved")
        
        # Step 3: Produce content
        print("3. Producing content (calling DeepSeek, ~60s)...")
        r = await client.post(f"/api/ideas/{idea_id}/produce", json={
            "types": ["gzh", "xhs", "video"],
            "tone": "clear_empathy",
        })
        assert r.status_code == 200, f"Step 3 failed: {r.status_code} {r.text[:200]}"
        idea = r.json()
        gzh_len = len(idea["content_gzh"] or "")
        xhs_len = len(idea["content_xhs"] or "")
        vid_len = len(idea["content_video_script"] or "")
        titles = idea.get("title_suggestions") or []
        print(f"   ✓ GZH: {gzh_len} chars | XHS: {xhs_len} chars | Video: {vid_len} chars")
        print(f"   ✓ Titles: {len(titles)}")
        
        # Step 4: Approve review
        print("4. Approving review...")
        r = await client.post(f"/api/ideas/{idea_id}/review/approve")
        assert r.status_code == 200, f"Step 4 failed: {r.status_code}"
        print("   ✓ Review approved")
        
        # Step 5: Mark published
        print("5. Publishing...")
        r = await client.post(f"/api/ideas/{idea_id}/publish", json={"notes": "test"})
        assert r.status_code == 200, f"Step 5 failed: {r.status_code}"
        print("   ✓ Published")
        
        print(f"\n{'='*50}")
        print("🎉 FULL FLOW SUCCESS!")
        print(f"{'='*50}")
        
        # Show snippets
        print(f"\n--- 公众号开头 ---")
        print((idea["content_gzh"] or "")[:200])
        print(f"\n--- 小红书 ---")
        print((idea["content_xhs"] or "")[:200])

asyncio.run(main())
