import os
from collections.abc import AsyncGenerator

from dotenv import load_dotenv
from fastapi import HTTPException, status
from sqlalchemy import MetaData, text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.schema import CreateSchema

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
DB_SCHEMA = os.getenv("DB_SCHEMA", "debate_coach").strip() or None
engine: AsyncEngine | None = None
AsyncSessionLocal: async_sessionmaker[AsyncSession] | None = None


class Base(DeclarativeBase):
    metadata = MetaData(schema=DB_SCHEMA)


def _normalize_database_url(url: str) -> str:
    """Accept common Postgres URLs and force the asyncpg SQLAlchemy driver."""
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


def init_database() -> bool:
    global engine, AsyncSessionLocal

    if not DATABASE_URL:
        return False

    if engine is None:
        echo_sql = os.getenv("SQLALCHEMY_ECHO", "").lower() in {"1", "true", "yes"}
        engine = create_async_engine(_normalize_database_url(DATABASE_URL), echo=echo_sql)
        AsyncSessionLocal = async_sessionmaker(
            bind=engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )

    return True


async def create_db_and_tables() -> None:
    if not init_database() or engine is None:
        return

    import models  # noqa: F401 - registers ORM models before create_all.

    async with engine.begin() as conn:
        if DB_SCHEMA and DB_SCHEMA != "public":
            schema_exists = await conn.scalar(
                text("select exists(select 1 from information_schema.schemata where schema_name = :schema_name)"),
                {"schema_name": DB_SCHEMA},
            )
            if not schema_exists:
                await conn.execute(CreateSchema(DB_SCHEMA, if_not_exists=True))
        await conn.run_sync(Base.metadata.create_all)


async def close_database() -> None:
    if engine is not None:
        await engine.dispose()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    if not init_database() or AsyncSessionLocal is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="DATABASE_URL is not set. Add a postgresql+asyncpg:// URL to .env to enable chat history.",
        )

    async with AsyncSessionLocal() as session:
        yield session
