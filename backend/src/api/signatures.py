from fastapi import APIRouter
from pydantic import BaseModel

from backend.src.db.connection import connect, load_db_config
from backend.src.db.dao.signatures import create_signature, list_signatures
from backend.src.db.dao.search import search_regex
from backend.src.utils.api import ok

router = APIRouter(prefix="/api/signatures", tags=["signatures"])


class SignatureRequest(BaseModel):
    name: str
    pattern: str
    target_field: str
    enabled: bool = True


@router.get("")
def get_signatures():
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        return ok(list_signatures(conn))
    finally:
        conn.close()


@router.post("")
def create_signature_rule(req: SignatureRequest):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        sig_id = create_signature(conn, req.name, req.pattern, req.target_field, req.enabled)
        return ok({"id": sig_id})
    finally:
        conn.close()


class SearchRequest(BaseModel):
    pattern: str
    target_field: str


@router.post("/search")
def search_signatures(req: SearchRequest):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        results = search_regex(conn, req.pattern, req.target_field)
        return ok({"results": results})
    finally:
        conn.close()
