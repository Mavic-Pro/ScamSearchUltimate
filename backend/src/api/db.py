from fastapi import APIRouter

from backend.src.db.connection import connect, load_db_config
from backend.src.db.validator import validate_and_migrate
from backend.src.utils.api import ok

router = APIRouter(prefix="/api/db", tags=["db"])

_RESET_TABLES = [
    "assets",
    "indicators",
    "signature_matches",
    "hunts",
    "alerts",
    "campaign_members",
    "campaigns",
    "graph_edges",
    "graph_nodes",
    "iocs",
    "yara_matches",
    "yara_rules",
    "urlscan_local",
    "targets",
    "jobs",
    "logs",
]


@router.post("/repair")
def repair_db():
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        rep = validate_and_migrate(conn)
        return ok(rep.to_dict())
    finally:
        conn.close()


@router.post("/reset")
def reset_db():
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        with conn.cursor() as cur:
            tables = ", ".join(_RESET_TABLES)
            cur.execute(f"TRUNCATE {tables} RESTART IDENTITY CASCADE")
            conn.commit()
        return ok({"reset": True})
    finally:
        conn.close()
