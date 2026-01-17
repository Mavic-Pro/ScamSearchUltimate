from fastapi import APIRouter

from backend.src.db.connection import connect, load_db_config
from backend.src.db.dao.alerts import list_alerts
from backend.src.utils.api import ok

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("")
def get_alerts():
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        return ok(list_alerts(conn))
    finally:
        conn.close()
