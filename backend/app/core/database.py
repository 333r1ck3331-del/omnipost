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


async def get_db() -> AsyncSession:
    """Dependency: yields an async DB session."""
    async with async_session() as session:
        yield session
