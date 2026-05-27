"""Writing style library — CRUD for named style samples."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import StyleSample

router = APIRouter(prefix="/api/styles", tags=["styles"])


# ── Schemas ──

class StyleIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    content: str = Field(..., min_length=1, max_length=8000)
    is_default: bool = False
    sort_order: int = 0


class StyleOut(BaseModel):
    id: str
    name: str
    content: str
    is_default: bool
    sort_order: int

    model_config = {"from_attributes": True}


# ── Helpers ──

async def _clear_default(db: AsyncSession, except_id: str | None = None):
    stmt = update(StyleSample).values(is_default=False).where(StyleSample.is_default == True)  # noqa: E712
    if except_id:
        stmt = stmt.where(StyleSample.id != except_id)
    await db.execute(stmt)


# ── Routes ──

@router.get("", response_model=list[StyleOut])
async def list_styles(db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(
            select(StyleSample).order_by(StyleSample.sort_order, StyleSample.created_at)
        )
    ).scalars().all()
    return rows


@router.post("", response_model=StyleOut)
async def create_style(body: StyleIn, db: AsyncSession = Depends(get_db)):
    style = StyleSample(
        name=body.name.strip(),
        content=body.content,
        is_default=body.is_default,
        sort_order=body.sort_order,
    )
    db.add(style)
    await db.flush()
    if body.is_default:
        await _clear_default(db, except_id=style.id)
    await db.commit()
    await db.refresh(style)
    return style


@router.put("/{style_id}", response_model=StyleOut)
async def update_style(style_id: str, body: StyleIn, db: AsyncSession = Depends(get_db)):
    style = await db.get(StyleSample, style_id)
    if not style:
        raise HTTPException(404, "style not found")
    style.name = body.name.strip()
    style.content = body.content
    style.is_default = body.is_default
    style.sort_order = body.sort_order
    if body.is_default:
        await _clear_default(db, except_id=style.id)
    await db.commit()
    await db.refresh(style)
    return style


@router.delete("/{style_id}")
async def delete_style(style_id: str, db: AsyncSession = Depends(get_db)):
    style = await db.get(StyleSample, style_id)
    if not style:
        raise HTTPException(404, "style not found")
    await db.delete(style)
    await db.commit()
    return {"ok": True}
