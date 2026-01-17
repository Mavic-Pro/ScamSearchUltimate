from fastapi import APIRouter
from pydantic import BaseModel

from backend.src.core.discovery import discover_targets
from backend.src.db.connection import connect, load_db_config
from backend.src.utils.api import ok

router = APIRouter(prefix="/api/discovery", tags=["discovery"])


class DiscoveryRequest(BaseModel):
    keyword: str | None = None
    fofa_query: str | None = None


@router.post("")
def run_discovery(req: DiscoveryRequest):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        targets = discover_targets(conn, req.keyword, req.fofa_query)
        return ok({"targets": targets})
    finally:
        conn.close()
