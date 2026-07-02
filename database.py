import os
import re
import logging
from collections.abc import AsyncGenerator
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from fastapi import HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import MetaData, text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.schema import CreateSchema

from backend_env import load_backend_env

load_backend_env()

DATABASE_URL = os.getenv("DATABASE_URL")
DB_SCHEMA = os.getenv("DB_SCHEMA", "debate_coach").strip() or None
SCHEMA_NAME_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,62}$")
ENVIRONMENT = os.getenv("ENV", "development").lower()
logger = logging.getLogger(__name__)
engine: AsyncEngine | None = None
AsyncSessionLocal: async_sessionmaker[AsyncSession] | None = None
database_disabled = False


if DB_SCHEMA and not SCHEMA_NAME_RE.fullmatch(DB_SCHEMA):
    raise RuntimeError("DB_SCHEMA must be a valid Postgres identifier.")


class Base(DeclarativeBase):
    metadata = MetaData(schema=DB_SCHEMA)


def _normalize_database_url(url: str) -> str:
    """Accept common Postgres URLs and force the asyncpg SQLAlchemy driver."""
    parsed = urlsplit(url)
    query_items: list[tuple[str, str]] = []
    ssl_mode: str | None = None
    for key, value in parse_qsl(parsed.query, keep_blank_values=True):
        if key == "channel_binding":
            continue
        if key == "sslmode":
            ssl_mode = value.lower()
            continue
        query_items.append((key, value))
    if ssl_mode and ssl_mode not in {"disable", "allow"} and not any(
        key == "ssl" for key, _ in query_items
    ):
        query_items.append(("ssl", ssl_mode))
    query = urlencode(query_items)
    url = urlunsplit((parsed.scheme, parsed.netloc, parsed.path, query, parsed.fragment))
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


def init_database() -> bool:
    global engine, AsyncSessionLocal

    if database_disabled:
        return False

    if not DATABASE_URL:
        return False

    if engine is None:
        echo_sql = os.getenv("SQLALCHEMY_ECHO", "").lower() in {"1", "true", "yes"}
        engine = create_async_engine(
            _normalize_database_url(DATABASE_URL),
            echo=echo_sql,
            pool_pre_ping=True,
        )
        AsyncSessionLocal = async_sessionmaker(
            bind=engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )

    return True


def database_required() -> bool:
    return ENVIRONMENT == "production"


async def disable_database(exc: BaseException | None = None) -> None:
    global engine, AsyncSessionLocal, database_disabled

    if database_required() and exc is not None:
        raise exc

    database_disabled = True

    if exc is not None:
        logger.warning(
            "Database unavailable in development; using in-memory fallback: %s",
            exc,
        )

    if engine is not None:
        await engine.dispose()
    engine = None
    AsyncSessionLocal = None


async def create_db_and_tables() -> None:
    if not init_database() or engine is None:
        return

    import models  # noqa: F401 - registers ORM models before create_all.

    try:
        async with engine.begin() as conn:
            if DB_SCHEMA and DB_SCHEMA != "public":
                schema_exists = await conn.scalar(
                    text("select exists(select 1 from information_schema.schemata where schema_name = :schema_name)"),
                    {"schema_name": DB_SCHEMA},
                )
                if not schema_exists:
                    await conn.execute(CreateSchema(DB_SCHEMA, if_not_exists=True))
            await conn.run_sync(Base.metadata.create_all)
    except (ConnectionError, OSError, SQLAlchemyError) as exc:
        await disable_database(exc)


async def close_database() -> None:
    global engine, AsyncSessionLocal

    if engine is not None:
        await engine.dispose()
    engine = None
    AsyncSessionLocal = None


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    if not init_database() or AsyncSessionLocal is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="DATABASE_URL is not set. Add a postgresql+asyncpg:// URL to .env to enable chat history.",
        )

    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


async def get_optional_db() -> AsyncGenerator[AsyncSession | None, None]:
    if not init_database() or AsyncSessionLocal is None:
        yield None
        return

    try:
        async with AsyncSessionLocal() as session:
            try:
                await session.execute(text("select 1"))
            except (ConnectionError, OSError, SQLAlchemyError) as exc:
                await disable_database(exc)
                yield None
                return

            try:
                yield session
            except Exception:
                await session.rollback()
                raise
    except (ConnectionError, OSError, SQLAlchemyError) as exc:
        await disable_database(exc)
        yield None
