from contextlib import asynccontextmanager
import os

import database
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from database import close_database, create_db_and_tables
from sqlalchemy import text
from models import Message as _MessageModel  # noqa: F401 - registers ORM metadata.
from models import User as _UserModel  # noqa: F401 - registers ORM metadata.
from routers import auth, chat, product
from security import (
    SecurityMiddleware,
    close_rate_limiter,
    validate_rate_limit_configuration,
)
from services.auth_service import validate_auth_configuration
from services.auth_service import cleanup_auth_security_records


@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_auth_configuration()
    await validate_rate_limit_configuration()
    await create_db_and_tables()
    await cleanup_auth_security_records()
    try:
        yield
    finally:
        await close_rate_limiter()
        await close_database()


is_production = os.getenv("ENV", "development").lower() == "production"
app = FastAPI(
    lifespan=lifespan,
    docs_url=None if is_production else "/docs",
    redoc_url=None if is_production else "/redoc",
    openapi_url=None if is_production else "/openapi.json",
)


def get_allowed_origins() -> list[str]:
    defaults = []
    if os.getenv("ENV", "development").lower() != "production":
        defaults = [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
        ]
    configured = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "").split(",")
        if origin.strip()
    ]
    frontend_url = os.getenv("FRONTEND_URL", "").strip()
    if frontend_url:
        configured.append(frontend_url)
    origins = list(dict.fromkeys([*defaults, *configured]))
    if "*" in origins:
        raise RuntimeError("Wildcard CORS origins cannot be used with credentials.")
    return origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
app.add_middleware(SecurityMiddleware)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    _: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    errors = [
        {
            "location": list(error.get("loc", ())),
            "message": error.get("msg", "Invalid input"),
            "type": error.get("type", "validation_error"),
        }
        for error in exc.errors()
    ]
    return JSONResponse(status_code=422, content={"detail": errors})

app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(product.router)

@app.get("/")
def root():
    return {"message": "Debate Coach is running!"}

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/health/db")
async def database_health():
    if not database.init_database() or database.AsyncSessionLocal is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="DATABASE_URL is not configured.",
        )

    async with database.AsyncSessionLocal() as session:
        await session.execute(text("select 1"))
    return {"status": "ok", "database": "connected"}
