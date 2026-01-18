from fastapi import APIRouter
from pydantic import BaseModel

from backend.src.core.hunt import run_hunt_targets
from backend.src.db.connection import connect, load_db_config
from backend.src.db.dao.hunts import create_hunt, get_hunt, list_hunts
from backend.src.db.dao.hunt_runs import create_hunt_run, list_hunt_runs
from backend.src.db.dao.jobs import create_job
from backend.src.utils.api import ok

router = APIRouter(prefix="/api/hunt", tags=["hunt"])


class HuntRequest(BaseModel):
    name: str
    rule_type: str
    rule: str
    ttl_seconds: int = 3600
    delay_seconds: int = 60
    budget: int = 50
    enabled: bool = True


@router.get("")
def get_hunts():
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        return ok(list_hunts(conn))
    finally:
        conn.close()


@router.get("/runs")
def get_hunt_runs(limit: int = 50):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        return ok(list_hunt_runs(conn, limit=limit))
    finally:
        conn.close()


@router.post("")
def create_hunt_rule(req: HuntRequest):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        hunt_id = create_hunt(
            conn,
            req.name,
            req.rule_type,
            req.rule,
            req.ttl_seconds,
            req.delay_seconds,
            req.budget,
            req.enabled,
        )
        return ok({"id": hunt_id})
    finally:
        conn.close()


@router.post("/run")
def run_hunt(req: HuntRequest):
    cfg = load_db_config()
    conn = connect(cfg)
    jobs = []
    try:
        targets, debug, warnings = run_hunt_targets(conn, req.rule_type, req.rule, only_new=False)
        for url in targets[: req.budget]:
            jobs.append(create_job(conn, "scan", {"url": url}))
        warning = "; ".join(warnings) if warnings else None
        create_hunt_run(conn, 0, "manual", len(jobs), warning)
        return ok({"queued": jobs, "warning": warning, "debug": debug})
    finally:
        conn.close()


@router.post("/run/{hunt_id}")
def run_hunt_by_id(hunt_id: int):
    cfg = load_db_config()
    conn = connect(cfg)
    jobs = []
    try:
        hunt = get_hunt(conn, hunt_id)
        if not hunt:
            return ok({"queued": []})
        targets, debug, warnings = run_hunt_targets(conn, hunt["rule_type"], hunt["rule"], only_new=False)
        for url in targets[: hunt["budget"]]:
            jobs.append(create_job(conn, "scan", {"url": url}))
        warning = "; ".join(warnings) if warnings else None
        create_hunt_run(conn, hunt_id, "manual", len(jobs), warning)
        return ok({"queued": jobs, "warning": warning, "debug": debug})
    finally:
        conn.close()
