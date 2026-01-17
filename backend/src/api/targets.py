from fastapi import APIRouter
from pydantic import BaseModel

from backend.src.db.connection import connect, load_db_config
from backend.src.db.dao.targets import resolve_target
from backend.src.utils.api import ok

router = APIRouter(prefix="/api/targets", tags=["targets"])


class ResolveRequest(BaseModel):
    field: str
    value: str


@router.get("/resolve")
def resolve(field: str, value: str):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        target = resolve_target(conn, field, value)
        return ok({"target": target})
    finally:
        conn.close()
