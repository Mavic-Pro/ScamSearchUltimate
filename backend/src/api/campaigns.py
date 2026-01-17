from fastapi import APIRouter

from backend.src.db.connection import connect, load_db_config
from backend.src.db.dao.campaigns import list_campaigns
from backend.src.utils.api import ok

router = APIRouter(prefix="/api/campaigns", tags=["campaigns"])


@router.get("")
def get_campaigns():
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        return ok(list_campaigns(conn))
    finally:
        conn.close()
