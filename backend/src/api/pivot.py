from fastapi import APIRouter, Query

from backend.src.core.providers.urlscan import urlscan_search_hash
from backend.src.core.providers.fofa import fofa_search
from backend.src.core.settings import get_setting_value
from backend.src.db.connection import connect, load_db_config
from backend.src.db.dao.assets import find_assets_by_hash
from backend.src.db.dao.targets import find_targets_by_field
from backend.src.utils.api import ok

router = APIRouter(prefix="/api/pivot", tags=["pivot"])


@router.get("/hash")
def pivot_by_hash(value: str = Query(..., min_length=4)):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        local_matches = find_assets_by_hash(conn, value)
        urlscan = urlscan_search_hash(conn, value)
        warning = None
        if not urlscan and not get_setting_value(conn, "URLSCAN_KEY"):
            warning = "URLSCAN_KEY mancante: pivot urlscan disabilitato."
        return ok({"local": local_matches, "urlscan": urlscan, "warning": warning})
    finally:
        conn.close()


@router.get("/target")
def pivot_by_target(field: str = Query(...), value: str = Query(...)):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        local = find_targets_by_field(conn, field, value)
        return ok({"local": local})
    finally:
        conn.close()


@router.get("/fofa")
def pivot_fofa(field: str = Query(...), value: str = Query(...)):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        if field not in {"ip", "jarm", "favicon_hash", "cert", "body"}:
            return ok({"results": [], "warning": "campo_non_supportato"})
        query = _fofa_query(field, value)
        results = fofa_search(conn, query, page=1, size=50)
        warning = None
        if not results and not get_setting_value(conn, "FOFA_KEY"):
            warning = "FOFA_KEY mancante: pivot FOFA disabilitato."
        return ok({"results": results, "query": query, "warning": warning})
    finally:
        conn.close()


@router.get("/reverse-ip")
def reverse_ip(ip: str = Query(...)):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        local = find_targets_by_field(conn, "ip", ip)
        return ok({"local": local})
    finally:
        conn.close()


def _fofa_query(field: str, value: str) -> str:
    if field == "ip":
        return f'ip="{value}"'
    if field == "jarm":
        return f'jarm="{value}"'
    if field == "favicon_hash":
        return f'favicon_hash="{value}"'
    if field == "cert":
        return f'cert="{value}"'
    return f'body="{value}"'
