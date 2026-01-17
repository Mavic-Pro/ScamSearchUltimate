from fastapi import APIRouter
from pydantic import BaseModel

from backend.src.core.providers.urlscan import urlscan_search
from backend.src.core.settings import get_setting_value
from backend.src.db.connection import connect, load_db_config
from backend.src.db.dao.urlscan_local import search_local
from backend.src.utils.api import ok

router = APIRouter(prefix="/api/urlscan", tags=["urlscan"])


class UrlscanQuery(BaseModel):
    query: str | None = None
    domain: str | None = None
    dom_hash: str | None = None
    headers_hash: str | None = None
    ip: str | None = None
    jarm: str | None = None
    favicon_hash: str | None = None
    limit: int = 100


@router.post("/search")
def search(req: UrlscanQuery):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        local = search_local(
            conn,
            req.query,
            req.domain,
            req.dom_hash,
            req.headers_hash,
            req.ip,
            req.jarm,
            req.favicon_hash,
            req.limit,
        )
        remote = []
        if req.query or req.domain:
            remote = urlscan_search(conn, req.query or req.domain or "")
        warning = None
        if not remote and not get_setting_value(conn, "URLSCAN_KEY"):
            warning = "URLSCAN_KEY mancante: search remoto disabilitato."
        return ok({"local": local, "remote": remote, "warning": warning})
    finally:
        conn.close()
