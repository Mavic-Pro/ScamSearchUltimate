from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.src.api import api_router
from backend.src.db.validator import ensure_db_ready
from backend.src.core.update import start_auto_update_if_enabled

app = FastAPI(title="ScamHunter Ultimate", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

@app.on_event("startup")
def _startup():
    ensure_db_ready()
    start_auto_update_if_enabled()

@app.get("/")
def root():
    return {"name": "ScamHunter Ultimate", "status": "ok"}
