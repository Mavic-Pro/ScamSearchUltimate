from fastapi import APIRouter
from pydantic import BaseModel

from backend.src.db.connection import connect, load_db_config
from backend.src.db.dao.alert_rules import create_alert_rule, list_alert_rules
from backend.src.db.dao.alerts import list_alerts
from backend.src.utils.api import ok

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("")
def get_alerts():
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        return ok(list_alerts(conn))
    finally:
        conn.close()


class AlertRuleRequest(BaseModel):
    name: str
    pattern: str
    target_field: str
    enabled: bool = True


@router.get("/rules")
def get_rules():
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        return ok(list_alert_rules(conn))
    finally:
        conn.close()


@router.post("/rules")
def create_rule(req: AlertRuleRequest):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        rule_id = create_alert_rule(conn, req.name, req.pattern, req.target_field, req.enabled)
        return ok({"id": rule_id})
    finally:
        conn.close()
