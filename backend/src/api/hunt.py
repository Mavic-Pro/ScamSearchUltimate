from fastapi import APIRouter
from pydantic import BaseModel

from backend.src.core.providers.ddg import ddg_search
from backend.src.core.providers.fofa import fofa_search
from backend.src.core.providers.serpapi import serp_search_verbose
from backend.src.core.providers.urlscan import urlscan_search
from backend.src.core.settings import get_setting_value
from backend.src.db.connection import connect, load_db_config
from backend.src.db.dao.hunts import create_hunt, get_hunt, list_hunts
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


def _run_hunt_targets(conn, rule_type: str, rule: str) -> tuple[list[str], dict, list[str]]:
    debug: dict = {}
    warnings: list[str] = []
    urls: list[str] = []
    if rule_type == "fofa":
        fofa_urls = fofa_search(conn, rule)
        urlscan_urls = urlscan_search(conn, rule)
        debug["fofa"] = len(fofa_urls)
        debug["urlscan"] = len(urlscan_urls)
        urls.extend(fofa_urls)
        urls.extend(urlscan_urls)
    elif rule_type == "urlscan":
        urlscan_urls = urlscan_search(conn, rule)
        debug["urlscan"] = len(urlscan_urls)
        urls.extend(urlscan_urls)
    elif rule_type == "dork":
        serp_google, err_g = serp_search_verbose(conn, rule, engine="google")
        serp_bing, err_b = serp_search_verbose(conn, rule, engine="bing")
        serp_yandex, err_y = serp_search_verbose(conn, rule, engine="yandex")
        ddg_urls = ddg_search(rule)
        debug["serpapi_google"] = len(serp_google)
        debug["serpapi_bing"] = len(serp_bing)
        debug["serpapi_yandex"] = len(serp_yandex)
        debug["ddg"] = len(ddg_urls)
        for err in (err_g, err_b, err_y):
            if err and err not in warnings:
                warnings.append(err)
        urls.extend(serp_google)
        urls.extend(serp_bing)
        urls.extend(serp_yandex)
        urls.extend(ddg_urls)
        if not urls:
            serp_key = get_setting_value(conn, "SERPAPI_KEY")
            if not serp_key:
                warnings.append("SERPAPI_KEY mancante: la dork puo' restituire zero risultati.")
    else:
        # Fallback: treat as keyword search
        serp_google, _ = serp_search_verbose(conn, rule, engine="google")
        ddg_urls = ddg_search(rule)
        debug["serpapi_google"] = len(serp_google)
        debug["ddg"] = len(ddg_urls)
        urls.extend(serp_google)
        urls.extend(ddg_urls)
    # Dedup
    deduped = []
    seen = set()
    for url in urls:
        if not url or url in seen:
            continue
        seen.add(url)
        deduped.append(url)
    return deduped[:200], debug, warnings


@router.get("")
def get_hunts():
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        return ok(list_hunts(conn))
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
        targets, debug, warnings = _run_hunt_targets(conn, req.rule_type, req.rule)
        for url in targets[: req.budget]:
            jobs.append(create_job(conn, "scan", {"url": url}))
        warning = "; ".join(warnings) if warnings else None
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
        targets, debug, warnings = _run_hunt_targets(conn, hunt["rule_type"], hunt["rule"])
        for url in targets[: hunt["budget"]]:
            jobs.append(create_job(conn, "scan", {"url": url}))
        warning = "; ".join(warnings) if warnings else None
        return ok({"queued": jobs, "warning": warning, "debug": debug})
    finally:
        conn.close()
