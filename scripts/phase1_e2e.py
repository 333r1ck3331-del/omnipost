"""Phase 1 端到端联测（真实 LLM）。

跑一遍完整流程：create → gate1/approve → save brief →
produce(gzh+xhs+video) → 验证 image_plans/video_storyboard →
review/approve → 验证 distribution_strategy → publish。

每步打印关键字段长度/状态，遇错立即退出。
"""
import asyncio
import json
import sys
import time
import httpx

BASE = "http://127.0.0.1:8000"
TIMEOUT = 240  # production 调用可能要 1~2 分钟


async def main():
    idea_text = "年轻人开始害怕接电话了：技术、社交焦虑与代际差异"
    brief = "从社会心理学角度切入，引用1-2个真实案例，避免说教感，篇幅1000字左右，结尾留白"
    types = ["gzh", "xhs", "video"]

    async with httpx.AsyncClient(base_url=BASE, timeout=TIMEOUT) as c:
        t0 = time.time()

        # 1. Create + Gate 1
        print("[1] POST /api/ideas  (含 Gate1 价值判断)")
        r = await c.post("/api/ideas", json={"idea_text": idea_text})
        if r.status_code != 201:
            print(f"    ❌ {r.status_code}: {r.text[:300]}")
            sys.exit(1)
        idea = r.json()
        iid = idea["id"]
        print(f"    ✓ id={iid[:8]}…  score={idea.get('gate1_score')}  "
              f"verdict={(idea.get('gate1_result') or {}).get('verdict', '?')[:60]}")

        # 2. Gate 1 approve
        print("[2] POST /gate1/approve")
        r = await c.post(f"/api/ideas/{iid}/gate1/approve")
        assert r.status_code == 200, r.text
        print("    ✓ approved")

        # 3. Save brief
        print("[3] POST /brief")
        r = await c.post(f"/api/ideas/{iid}/brief", json={"brief_text": brief})
        assert r.status_code == 200, r.text
        print("    ✓ brief saved")

        # 4. Produce (real LLM call — 60~120s)
        print(f"[4] POST /produce  types={types}  (真实 LLM, 约 1~2 分钟)")
        t_prod = time.time()
        r = await c.post(f"/api/ideas/{iid}/produce", json={"types": types})
        dt = time.time() - t_prod
        if r.status_code != 200:
            print(f"    ❌ {r.status_code}: {r.text[:500]}")
            sys.exit(1)
        body = r.json()
        print(f"    ✓ {dt:.1f}s  status={body['status']}")
        print(f"      gzh: {len(body.get('content_gzh') or '')} chars")
        print(f"      xhs: {len(body.get('content_xhs') or '')} chars")
        print(f"      video: {len(body.get('content_video_script') or '')} chars")
        print(f"      titles: {body.get('title_suggestions')}")

        # image_plans: 实际结构 {gzh: {cover, inline_images[]}, xhs: {cover, carousel[]}}
        ip = body.get("image_plans")
        if ip and isinstance(ip, dict):
            parts = []
            for plat in ("gzh", "xhs"):
                p = ip.get(plat)
                if isinstance(p, dict):
                    has_cover = bool(p.get("cover"))
                    inline_n = len(p.get("inline_images") or [])
                    carousel_n = len(p.get("carousel") or [])
                    extras = []
                    if has_cover:
                        extras.append("cover")
                    if inline_n:
                        extras.append(f"inline×{inline_n}")
                    if carousel_n:
                        extras.append(f"carousel×{carousel_n}")
                    parts.append(f"{plat}({', '.join(extras) or 'empty'})")
            print(f"      image_plans: {' | '.join(parts) if parts else 'empty'}")
        else:
            print(f"      ⚠️  image_plans 缺失或非 dict: {type(ip).__name__}")

        # video_storyboard: 实际结构 {video: {shots[], bgm, total_seconds}, bilibili: {shots[], total_minutes}}
        vs = body.get("video_storyboard")
        if vs and isinstance(vs, dict):
            parts = []
            for plat in ("video", "bilibili"):
                p = vs.get(plat)
                if isinstance(p, dict):
                    shots_n = len(p.get("shots") or [])
                    parts.append(f"{plat}(shots×{shots_n})")
            print(f"      video_storyboard: {' | '.join(parts) if parts else 'empty'}")
        else:
            print(f"      ⚠️  video_storyboard 缺失或非 dict: {type(vs).__name__}")

        # 5. Review approve
        print("[5] POST /review/approve  (含 distribution_strategy 生成)")
        t_rev = time.time()
        r = await c.post(f"/api/ideas/{iid}/review/approve")
        dt = time.time() - t_rev
        if r.status_code != 200:
            print(f"    ❌ {r.status_code}: {r.text[:500]}")
            sys.exit(1)
        approve_body = r.json()
        print(f"    ✓ {dt:.1f}s  distribution_ready={approve_body.get('distribution_ready')}")

        # 6. Verify final state
        print("[6] GET /  (验证最终状态 + distribution_strategy)")
        r = await c.get(f"/api/ideas/{iid}")
        final = r.json()
        assert final["status"] == "completed", final["status"]
        ds = final.get("distribution_strategy")
        if ds and isinstance(ds, dict) and not ds.get("error"):
            plats = list((ds.get("platforms") or {}).keys())
            print(f"    ✓ status=completed  distribution.platforms={plats}")
            print(f"      audience_layers={'yes' if ds.get('audience_layers') else 'no'}  "
                  f"risk_warning={'yes' if ds.get('risk_warning') else 'no'}")
        else:
            print(f"    ⚠️  distribution_strategy 异常: {json.dumps(ds, ensure_ascii=False)[:200]}")

        # 7. Publish
        print("[7] POST /publish")
        r = await c.post(f"/api/ideas/{iid}/publish", json={"notes": "联测通过"})
        assert r.status_code == 200, r.text
        print("    ✓ published")

        print(f"\n✅ 全流程通过，总耗时 {time.time()-t0:.1f}s   idea_id={iid}")


asyncio.run(main())
