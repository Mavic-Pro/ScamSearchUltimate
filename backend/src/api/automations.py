from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from backend.src.core.automation import run_automation
from backend.src.db.connection import connect, load_db_config
from backend.src.db.dao.automations import delete_automation, get_automation, insert_automation, list_automations, update_automation
from backend.src.db.dao.automation_runs import list_automation_runs
from backend.src.db.dao.jobs import create_job
from backend.src.utils.api import ok

router = APIRouter(prefix="/api/automations", tags=["automations"])


class AutomationRequest(BaseModel):
    name: str
    enabled: bool = True
    trigger_type: str = Field(default="manual")
    trigger_config: dict = Field(default_factory=dict)
    graph: dict = Field(default_factory=dict)


@router.get("")
def list_all():
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        return ok(list_automations(conn))
    finally:
        conn.close()


@router.get("/{automation_id}")
def get_one(automation_id: int):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        item = get_automation(conn, automation_id)
        if not item:
            raise HTTPException(status_code=404, detail="automation_not_found")
        runs = list_automation_runs(conn, automation_id)
        return ok({"automation": item, "runs": runs})
    finally:
        conn.close()


@router.post("")
def create_one(req: AutomationRequest):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        automation_id = insert_automation(conn, req.model_dump())
        return ok({"id": automation_id})
    finally:
        conn.close()


@router.put("/{automation_id}")
def update_one(automation_id: int, req: AutomationRequest):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        if not get_automation(conn, automation_id):
            raise HTTPException(status_code=404, detail="automation_not_found")
        update_automation(conn, automation_id, req.model_dump())
        return ok({"id": automation_id})
    finally:
        conn.close()


@router.delete("/{automation_id}")
def delete_one(automation_id: int):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        delete_automation(conn, automation_id)
        return ok({"id": automation_id, "deleted": True})
    finally:
        conn.close()


@router.post("/{automation_id}/run")
def manual_run(automation_id: int, dry_run: bool = Query(False)):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        automation = get_automation(conn, automation_id)
        if not automation:
            raise HTTPException(status_code=404, detail="automation_not_found")
        result = run_automation(conn, automation, event="manual", payload={}, dry_run=dry_run)
        return ok(result)
    finally:
        conn.close()


class AutomationEventRequest(BaseModel):
    event: str
    payload: dict = Field(default_factory=dict)


@router.post("/event")
def push_event(req: AutomationEventRequest):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        job_id = create_job(conn, "automation_event", {"event": req.event, "payload": req.payload})
        return ok({"job_id": job_id})
    finally:
        conn.close()
