import csv
import io

from fastapi import APIRouter
from fastapi.responses import JSONResponse, StreamingResponse

from backend.src.db.connection import connect, load_db_config
from backend.src.db.dao.graph import list_graph
from backend.src.db.dao.targets import list_targets

router = APIRouter(prefix="/api/export", tags=["export"])


@router.get("/csv")
def export_csv():
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        targets = list_targets(conn, limit=1000)
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["id", "url", "domain", "status", "risk_score", "dom_hash", "headers_hash"])
        for t in targets:
            writer.writerow([
                t["id"],
                t["url"],
                t["domain"],
                t["status"],
                t.get("risk_score"),
                t.get("dom_hash"),
                t.get("headers_hash"),
            ])
        buf.seek(0)
        return StreamingResponse(buf, media_type="text/csv")
    finally:
        conn.close()


@router.get("/graph")
def export_graph():
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        graph = list_graph(conn)
        return JSONResponse(graph)
    finally:
        conn.close()
