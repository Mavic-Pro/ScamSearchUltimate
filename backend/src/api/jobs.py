from fastapi import APIRouter

from backend.src.db.connection import connect, load_db_config
from backend.src.db.dao.jobs import list_jobs
from backend.src.utils.api import ok

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("")
def get_jobs():
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        return ok(list_jobs(conn))
    finally:
        conn.close()
