"""场景（scene）端到端测试 — 创建/校验/路由/IdeaDetail 暴露。"""
import pytest


@pytest.mark.asyncio
async def test_list_scenes_endpoint(client):
    r = await client.get("/api/ideas/scenes")
    assert r.status_code == 200
    data = r.json()
    keys = {s["value"] for s in data["scenes"]}
    assert keys == {"kepu", "guandian", "gushi", "qinggan", "ganhuo", "redian"}


@pytest.mark.asyncio
async def test_create_idea_with_scene(client):
    r = await client.post("/api/ideas", json={"idea_text": "讲讲短期记忆", "scene": "kepu"})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["scene"] == "kepu"


@pytest.mark.asyncio
async def test_create_idea_invalid_scene_rejected(client):
    r = await client.post("/api/ideas", json={"idea_text": "x", "scene": "bogus"})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_create_idea_without_scene_defaults_null(client):
    r = await client.post("/api/ideas", json={"idea_text": "随便写点啥"})
    assert r.status_code == 201
    assert r.json()["scene"] is None


@pytest.mark.asyncio
async def test_scene_persists_through_produce(client):
    r = await client.post("/api/ideas", json={"idea_text": "为啥要早睡", "scene": "guandian"})
    iid = r.json()["id"]
    await client.post(f"/api/ideas/{iid}/gate1/approve")
    r2 = await client.post(f"/api/ideas/{iid}/produce", json={"types": ["gzh"]})
    assert r2.status_code == 200
    assert r2.json()["scene"] == "guandian"


@pytest.mark.asyncio
async def test_scene_passed_to_production(monkeypatch, client):
    """生产函数应收到 scene 参数。"""
    captured = {}
    from app.services import idea_workflow as wf

    real = wf.run_content_production

    async def spy(idea, selected_types=None, brief="", scene=None, extra_research="", **kwargs):
        captured["scene"] = scene
        return await real(idea, selected_types, brief, scene=scene, extra_research=extra_research, **kwargs)

    monkeypatch.setattr(wf, "run_content_production", spy)

    r = await client.post("/api/ideas", json={"idea_text": "故事一则", "scene": "gushi"})
    iid = r.json()["id"]
    await client.post(f"/api/ideas/{iid}/gate1/approve")
    await client.post(f"/api/ideas/{iid}/produce", json={"types": ["gzh"]})
    assert captured["scene"] == "gushi"
