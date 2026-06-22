from contextlib import asynccontextmanager

from fastapi import FastAPI

from database import close_database, create_db_and_tables
from models import Message as _MessageModel  # noqa: F401 - registers ORM metadata.
from routers import chat


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_db_and_tables()
    yield
    await close_database()


app = FastAPI(lifespan=lifespan)
app.include_router(chat.router)

@app.get("/")
def root():
    return {"message": "Debate Coach is running!"}

@app.get("/health")
def health():
    return {"status": "ok"}
