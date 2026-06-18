from fastapi import FastAPI
from routers import chat

app = FastAPI()
app.include_router(chat.router)

@app.get("/")
def root():
    return {"message": "Debate Coach is running!"}

@app.get("/health")
def health():
    return {"status": "ok"}
