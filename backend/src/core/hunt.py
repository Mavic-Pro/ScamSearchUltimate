from typing import Dict, List, Tuple

from backend.src.core.providers.ddg import ddg_search
from backend.src.core.providers.fofa import fofa_search_verbose
from backend.src.core.providers.serpapi import serp_search_verbose
from backend.src.core.providers.urlscan import urlscan_search
from backend.src.core.settings import get_setting_value
from backend.src.db.dao.hunts import list_enabled_hunts, update_hunt_last_run
from backend.src.db.dao.jobs import create_job
from backend.src.db.dao.targets import filter_new_urls
from backend.src.db.dao.jobs import filter_new_job_urls
from backend.src.db.dao.hunt_runs import create_hunt_run
from backend.src.utils.time import utcnow


def run_hunt_targets(conn, rule_type: str, rule: str, only_new: bool = True) -> Tuple[List[str], Dict[str, int], List[str]]:
    debug: Dict[str, int] = {}
    warnings: List[str] = []
    urls: List[str] = []
    if not rule or not str(rule).strip():
        return [], debug, ["query_empty"]
    if rule_type == "fofa":
        fofa_urls, fofa_err = fofa_search_verbose(conn, rule)
        if fofa_err:
            warnings.append(fofa_err)
        debug["fofa"] = len(fofa_urls)
        urls.extend(fofa_urls)
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
        serp_google, _ = serp_search_verbose(conn, rule, engine="google")
        ddg_urls = ddg_search(rule)
        debug["serpapi_google"] = len(serp_google)
        debug["ddg"] = len(ddg_urls)
        urls.extend(serp_google)
        urls.extend(ddg_urls)

    deduped = []
    seen = set()
    for url in urls:
        if not url or url in seen:
            continue
        seen.add(url)
        deduped.append(url)

    if only_new:
        fresh = filter_new_urls(conn, deduped)
        fresh = filter_new_job_urls(conn, fresh)
        return fresh[:200], debug, warnings
    return deduped[:200], debug, warnings


def run_scheduled_hunts(conn) -> Dict[str, int]:
    queued_total = 0
    hunts = list_enabled_hunts(conn)
    for hunt in hunts:
        last_run = hunt.get("last_run_at")
        delay = int(hunt.get("delay_seconds") or 0)
        if last_run and delay > 0:
            elapsed = (utcnow() - last_run).total_seconds()
            if elapsed < delay:
                continue
        targets, _debug, _warnings = run_hunt_targets(conn, hunt["rule_type"], hunt["rule"])
        for url in targets[: hunt["budget"]]:
            create_job(conn, "scan", {"url": url})
            queued_total += 1
        create_hunt_run(conn, hunt["id"], "auto", min(len(targets), hunt["budget"]), None)
        update_hunt_last_run(conn, hunt["id"])
    return {"queued": queued_total}
