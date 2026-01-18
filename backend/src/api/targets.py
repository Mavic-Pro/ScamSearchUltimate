from fastapi import APIRouter
from pathlib import Path
from pydantic import BaseModel

from backend.src.db.connection import connect, load_db_config
from backend.src.db.dao.jobs import delete_jobs_by_url
from backend.src.db.dao.targets import delete_target_and_related, get_target, resolve_target
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


@router.post("/{target_id}/delete")
def delete_target(target_id: int):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        target = get_target(conn, target_id)
        if target and target.get("url"):
            delete_jobs_by_url(conn, target["url"])
        delete_target_and_related(conn, target_id)
        if target:
            for path_key in ("html_path", "screenshot_path"):
                path_value = target.get(path_key)
                if path_value:
                    try:
                        Path(path_value).unlink(missing_ok=True)
                    except Exception:
                        pass
        return ok({"id": target_id, "deleted": True})
    finally:
        conn.close()
