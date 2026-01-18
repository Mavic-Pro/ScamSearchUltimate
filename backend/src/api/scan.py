from fastapi import APIRouter
from pydantic import BaseModel

from backend.src.core.discovery import discover_targets_verbose
from backend.src.db.connection import connect, load_db_config
from backend.src.db.dao.jobs import create_job
from backend.src.utils.api import ok

router = APIRouter(prefix="/api/scan", tags=["scan"])


class ScanRequest(BaseModel):
    url: str | None = None
    keyword: str | None = None
    fofa_query: str | None = None


class BulkScanRequest(BaseModel):
    urls: list[str]


@router.post("")
def submit_scan(req: ScanRequest):
    cfg = load_db_config()
    conn = connect(cfg)
    jobs = []
    try:
        warning = None
        if req.url:
            jobs.append(create_job(conn, "scan", {"url": req.url}))
        if req.keyword or req.fofa_query:
            targets, warnings = discover_targets_verbose(conn, req.keyword, req.fofa_query)
            for url in targets:
                jobs.append(create_job(conn, "scan", {"url": url}))
            warning = "; ".join(warnings) if warnings else None
        return ok({"queued": jobs, "warning": warning})
    finally:
        conn.close()


@router.post("/bulk")
def submit_bulk_scan(req: BulkScanRequest):
    cfg = load_db_config()
    conn = connect(cfg)
    jobs = []
    try:
        urls = [u for u in req.urls if u]
        for url in urls[:200]:
            jobs.append(create_job(conn, "scan", {"url": url}))
        return ok({"queued": jobs})
    finally:
        conn.close()
