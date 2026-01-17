from fastapi import APIRouter

from backend.src.db.connection import connect, load_db_config
from backend.src.db.dao.logs import tail_logs
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
