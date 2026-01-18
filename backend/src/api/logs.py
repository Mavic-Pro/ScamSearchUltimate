from fastapi import APIRouter

from backend.src.db.connection import connect, load_db_config
from backend.src.db.dao.logs import clear_logs, tail_logs
from backend.src.utils.api import ok

router = APIRouter(prefix="/api/logs", tags=["logs"])


@router.get("/tail")
def get_logs():
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        return ok(tail_logs(conn, limit=200))
    finally:
        conn.close()


@router.post("/clear")
def clear():
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        clear_logs(conn)
        return ok({"cleared": True})
    finally:
        conn.close()
