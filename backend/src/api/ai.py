from fastapi import APIRouter
from pydantic import BaseModel

from backend.src.core.ai import chat, run_task, suggest_rules
from backend.src.db.connection import connect, load_db_config
from backend.src.utils.api import ok, fail

router = APIRouter(prefix="/api/ai", tags=["ai"])


class ChatRequest(BaseModel):
    messages: list[dict]
    target_id: int | None = None
    target_ids: list[int] | None = None
    include_dom: bool = False
    include_iocs: bool = False


@router.post("/chat")
def chat_endpoint(req: ChatRequest):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        result = chat(
            conn,
            req.messages,
            req.target_id,
            req.include_dom,
            req.include_iocs,
            target_ids=req.target_ids,
        )
        if "error" in result:
            return fail(result["error"])
        return ok(result)
    finally:
        conn.close()


class SuggestRequest(BaseModel):
    prompt: str
    target_id: int | None = None
    target_ids: list[int] | None = None
    include_dom: bool = False
    include_iocs: bool = False


@router.post("/suggest")
def suggest_endpoint(req: SuggestRequest):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        result = suggest_rules(
            conn,
            req.prompt,
            req.target_id,
            req.include_dom,
            req.include_iocs,
            target_ids=req.target_ids,
        )
        return ok(result)
    finally:
        conn.close()


class TaskRequest(BaseModel):
    task: str
    prompt: str | None = None
    data: dict | None = None
    target_id: int | None = None
    target_ids: list[int] | None = None
    include_dom: bool = False
    include_iocs: bool = False


@router.post("/task")
def task_endpoint(req: TaskRequest):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        result = run_task(
            conn,
            req.task,
            prompt=req.prompt,
            data=req.data,
            target_id=req.target_id,
            target_ids=req.target_ids,
            include_dom=req.include_dom,
            include_iocs=req.include_iocs,
        )
        if "error" in result:
            return fail(result["error"])
        return ok(result)
    finally:
        conn.close()
