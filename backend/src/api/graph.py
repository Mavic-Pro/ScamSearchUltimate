from fastapi import APIRouter
from pydantic import BaseModel

from backend.src.db.connection import connect, load_db_config
from backend.src.db.dao.graph import list_graph
from backend.src.utils.api import ok

router = APIRouter(prefix="/api/graph", tags=["graph"])


@router.get("")
def get_graph():
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        return ok(list_graph(conn))
    finally:
        conn.close()


class ExpandRequest(BaseModel):
    kind: str
    value: str


@router.post("/expand")
def expand_node(req: ExpandRequest):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        data = list_graph(conn)
        nodes = [n for n in data["nodes"] if n["kind"] == req.kind or n["value"] == req.value]
        return ok({"nodes": nodes, "edges": data["edges"]})
    finally:
        conn.close()
