"""Tests for style library CRUD."""

import pytest

pytestmark = pytest.mark.asyncio


async def test_create_list_update_delete_style(client):
    # 清掉前面测试残留
    existing = (await client.get("/api/styles")).json()
    for s in existing:
        await client.delete(f"/api/styles/{s['id']}")

    # 创建
    r = await client.post(
        "/api/styles",
        json={"name": "公众号-深度", "content": "样本内容A", "is_default": True, "sort_order": 0},
    )
    assert r.status_code == 200
    s1 = r.json()
    assert s1["name"] == "公众号-深度"
    assert s1["is_default"] is True

    # 再建一条 default → 旧的应被清掉
    r = await client.post(
        "/api/styles",
        json={"name": "小红书-感性", "content": "样本内容B", "is_default": True, "sort_order": 1},
    )
    s2 = r.json()
    assert s2["is_default"] is True

    r = await client.get("/api/styles")
    rows = r.json()
    assert len(rows) == 2
    defaults = [r for r in rows if r["is_default"]]
    assert len(defaults) == 1
    assert defaults[0]["id"] == s2["id"]

    # 更新
    r = await client.put(
        f"/api/styles/{s1['id']}",
        json={"name": "公众号-深度2", "content": "新内容", "is_default": False, "sort_order": 0},
    )
    assert r.status_code == 200
    assert r.json()["name"] == "公众号-深度2"

    # 删除
    r = await client.delete(f"/api/styles/{s1['id']}")
    assert r.status_code == 200
    r = await client.get("/api/styles")
    assert len(r.json()) == 1


async def test_load_style_samples_resolves_by_id(client):
    """prompt_loader.load_style_samples(style_id) 应读取指定风格。"""
    # 清掉残留确保干净
    existing = (await client.get("/api/styles")).json()
    for s in existing:
        await client.delete(f"/api/styles/{s['id']}")

    r = await client.post(
        "/api/styles",
        json={"name": "测试风格", "content": "MARKERSTYLE_XYZ", "is_default": False, "sort_order": 0},
    )
    sid = r.json()["id"]

    from app.services.prompt_loader import load_style_samples
    from app.core.config import DATABASE_URL as _DBURL
    block = load_style_samples(sid)
    assert "MARKERSTYLE_XYZ" in block, f"got: {block!r}; DATABASE_URL={_DBURL!r}; sid={sid!r}"

    # 设为 default 后不传 id 也能找到
    await client.put(
        f"/api/styles/{sid}",
        json={"name": "测试风格", "content": "MARKERSTYLE_XYZ", "is_default": True, "sort_order": 0},
    )
    block2 = load_style_samples()
    assert "MARKERSTYLE_XYZ" in block2
