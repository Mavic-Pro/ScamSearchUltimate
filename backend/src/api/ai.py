from fastapi import APIRouter
from pydantic import BaseModel

from backend.src.core.ai import chat, suggest_rules
from backend.src.db.connection import connect, load_db_config
from backend.src.utils.api import ok, fail

router = APIRouter(prefix="/api/ai", tags=["ai"])


class ChatRequest(BaseModel):
    messages: list[dict]
    target_id: int | None = None
    include_dom: bool = False
    include_iocs: bool = False


@router.post("/chat")
def chat_endpoint(req: ChatRequest):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        result = chat(conn, req.messages, req.target_id, req.include_dom, req.include_iocs)
        if "error" in result:
            return fail(result["error"])
        return ok(result)
    finally:
        conn.close()


class SuggestRequest(BaseModel):
    prompt: str
    target_id: int | None = None
    include_dom: bool = False
    include_iocs: bool = False


@router.post("/suggest")
def suggest_endpoint(req: SuggestRequest):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        result = suggest_rules(conn, req.prompt, req.target_id, req.include_dom, req.include_iocs)
        return ok(result)
    finally:
        conn.close()
