from fastapi import APIRouter
from pydantic import BaseModel
from pathlib import Path
import os
import requests

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


@router.get("/storage-audit")
def storage_audit():
    storage_dir = Path(os.getenv("STORAGE_DIR", "storage"))
    if not storage_dir.exists():
        return ok({"path": str(storage_dir), "size_bytes": 0, "files": 0})
    total_size = 0
    files = 0
    for path in storage_dir.rglob("*"):
        if path.is_file():
            files += 1
            try:
                total_size += path.stat().st_size
            except Exception:
                pass
    return ok({"path": str(storage_dir), "size_bytes": total_size, "files": files})


@router.get("/key-health")
def key_health(mode: str = "config"):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        status = {}
        status["FOFA"] = _check_fofa(conn, mode)
        status["URLSCAN"] = _check_urlscan(conn, mode)
        status["SERPAPI"] = _check_serpapi(conn, mode)
        return ok(status)
    finally:
        conn.close()


def _check_fofa(conn, mode: str) -> dict:
    email = get_setting(conn, "FOFA_EMAIL")
    key = get_setting(conn, "FOFA_KEY")
    if not email or not key:
        return {"status": "missing"}
    if mode != "live":
        return {"status": "configured"}
    try:
        params = {"email": email, "key": key, "qbase64": "dGl0bGU9ImxvZ2luIg==", "size": 1, "page": 1}
        resp = requests.get("https://fofa.info/api/v1/search/all", params=params, timeout=6)
        data = resp.json()
        if data.get("error"):
            return {"status": "error", "message": str(data.get("errmsg") or data.get("error"))}
        return {"status": "ok"}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


def _check_urlscan(conn, mode: str) -> dict:
    key = get_setting(conn, "URLSCAN_KEY")
    if not key:
        return {"status": "missing"}
    if mode != "live":
        return {"status": "configured"}
    try:
        headers = {"API-Key": key}
        resp = requests.get("https://urlscan.io/api/v1/search/", headers=headers, params={"q": "example.com"}, timeout=6)
        if resp.status_code >= 400:
            return {"status": "error", "message": f"HTTP {resp.status_code}"}
        return {"status": "ok"}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


def _check_serpapi(conn, mode: str) -> dict:
    key = get_setting(conn, "SERPAPI_KEY")
    if not key:
        return {"status": "missing"}
    if mode != "live":
        return {"status": "configured"}
    try:
        resp = requests.get(
            "https://serpapi.com/search.json",
            params={"q": "login", "engine": "google", "api_key": key, "num": 1},
            timeout=6,
        )
        data = resp.json()
        if data.get("error"):
            return {"status": "error", "message": str(data.get("error"))}
        return {"status": "ok"}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}
