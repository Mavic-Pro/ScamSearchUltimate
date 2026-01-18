from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.src.db.connection import connect, load_db_config
from backend.src.db.dao.jobs import create_job
from backend.src.utils.api import ok

router = APIRouter(prefix="/api/spider", tags=["spider"])


class SpiderRequest(BaseModel):
    url: str
    max_pages: int = Field(default=200, ge=1, le=2000)
    max_depth: int = Field(default=2, ge=0, le=6)
    use_sitemap: bool = True


@router.post("/manual")
def manual_spider(req: SpiderRequest):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        payload = {
            "url": req.url,
            "max_pages": req.max_pages,
            "max_depth": req.max_depth,
            "use_sitemap": "1" if req.use_sitemap else "0",
        }
        job_id = create_job(conn, "spider", payload)
        return ok({"job_id": job_id})
    finally:
        conn.close()
