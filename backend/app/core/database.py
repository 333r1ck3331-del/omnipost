"""Database setup — SQLite via SQLAlchemy async."""

from sqlalchemy import event
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.core.config import DATABASE_URL

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# SQLite 默认关闭外键约束 → 级联删除不工作。每次连接都打开。
@event.listens_for(engine.sync_engine, "connect")
def _enable_sqlite_foreign_keys(dbapi_conn, _conn_record):
    try:
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()
    except Exception:
        # 非 SQLite 后端时忽略
        pass


class Base(DeclarativeBase):
    pass


async def init_db():
    """Create all tables. Called on startup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # 轻量迁移：补 content_items.review_log 列（SQLite IF NOT EXISTS 不支持 ADD COLUMN，先探测）
        await _ensure_column(conn, "content_items", "review_log", "TEXT")
        await _ensure_column(conn, "content_items", "scene", "VARCHAR")
        await _ensure_column(conn, "content_items", "enrichment_flags", "TEXT")
        await _ensure_column(conn, "content_items", "enrichment_data", "TEXT")
        await _ensure_column(conn, "content_items", "gate1_research", "TEXT")
        await _ensure_column(conn, "content_items", "style_id", "VARCHAR")
        await _ensure_column(conn, "content_items", "reference_text", "TEXT")
        # 旧版 user_config.json.style_samples 字符串迁移为首条默认风格
        await _migrate_legacy_style_samples(conn)


async def _migrate_legacy_style_samples(conn):
    """把 user_config.json 里的 style_samples 字符串迁移成 StyleSample 默认条（幂等）。"""
    try:
        from app.core.config import _load_user_config
        cfg = _load_user_config()
        legacy = (cfg.get("style_samples") or "").strip()
        if not legacy:
            return
        # 已有任意 style_samples 行 → 不再迁移
        res = await conn.exec_driver_sql("SELECT COUNT(*) FROM style_samples")
        count = res.fetchone()[0]
        if count > 0:
            return
        import uuid as _u
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        new_id = str(_u.uuid4())
        await conn.exec_driver_sql(
            "INSERT INTO style_samples (id, name, content, is_default, sort_order, created_at, updated_at) "
            "VALUES (?, ?, ?, 1, 0, ?, ?)",
            (new_id, "默认风格（迁移）", legacy, now, now),
        )
    except Exception:
        # 迁移失败不应阻断启动
        import logging
        logging.getLogger(__name__).exception("legacy style_samples migration failed")


async def _ensure_column(conn, table: str, column: str, decl: str):
    """Add a column if missing (idempotent, SQLite-safe)."""
    from sqlalchemy import text
    res = await conn.exec_driver_sql(f"PRAGMA table_info({table})")
    cols = {row[1] for row in res.fetchall()}
    if column not in cols:
        await conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {column} {decl}")


async def get_db() -> AsyncSession:
    """Dependency: yields an async DB session."""
    async with async_session() as session:
        yield session
