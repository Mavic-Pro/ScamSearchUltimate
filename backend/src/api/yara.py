from fastapi import APIRouter
from pydantic import BaseModel

from backend.src.db.connection import connect, load_db_config
from backend.src.db.dao.yara_rules import create_yara_rule, list_yara_rules
from backend.src.utils.api import ok, fail

router = APIRouter(prefix="/api/yara", tags=["yara"])


class YaraRequest(BaseModel):
    name: str
    rule_text: str
    target_field: str
    enabled: bool = True


@router.get("")
def list_rules():
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        return ok(list_yara_rules(conn))
    finally:
        conn.close()


@router.post("")
def add_rule(req: YaraRequest):
    if req.target_field not in {"html", "asset"}:
        return fail("target_field non valido")
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        rule_id = create_yara_rule(conn, req.name, req.rule_text, req.target_field, req.enabled)
        return ok({"id": rule_id})
    finally:
        conn.close()
