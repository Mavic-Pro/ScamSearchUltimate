from fastapi import APIRouter
from pydantic import BaseModel

from backend.src.db.connection import connect, load_db_config
from backend.src.db.dao.settings import get_setting, set_setting
from backend.src.security.secrets import generate_key, get_key_status
from backend.src.utils.api import fail, ok

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SettingRequest(BaseModel):
    key: str
    value: str


@router.get("/key-status")
def key_status():
    return ok({"status": get_key_status()})


@router.get("/keygen")
def keygen():
    return ok({"key": generate_key()})


@router.get("/{key}")
def get_value(key: str):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        return ok({"key": key, "value": get_setting(conn, key)})
    finally:
        conn.close()


@router.post("")
def set_value(req: SettingRequest):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        set_setting(conn, req.key, req.value)
        return ok({"key": req.key})
    except Exception as exc:
        return fail("Failed to save setting", str(exc))
    finally:
        conn.close()

