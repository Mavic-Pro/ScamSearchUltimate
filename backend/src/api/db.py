from fastapi import APIRouter

from backend.src.db.connection import connect, load_db_config
from backend.src.db.validator import validate_and_migrate
from backend.src.utils.api import ok

router = APIRouter(prefix="/api/db", tags=["db"])


@router.post("/repair")
def repair_db():
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        rep = validate_and_migrate(conn)
        return ok(rep.to_dict())
    finally:
        conn.close()
