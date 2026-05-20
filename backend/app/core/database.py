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
