from __future__ import annotations

import re
import time
from typing import Any, Dict, Iterable, List

import requests

from backend.src.core.providers.blockcypher import blockcypher_address_summary
from backend.src.core.providers.crtsh import crtsh_subdomains
from backend.src.core.providers.domainsdb import domainsdb_search
from backend.src.core.providers.holehe import holehe_lookup
from backend.src.db.dao.automation_runs import create_automation_run, update_automation_run
from backend.src.db.dao.automations import get_automation, list_automations, update_automation_last_run
from backend.src.db.dao.jobs import create_job
from backend.src.db.dao.iocs import create_ioc


def run_scheduled_automations(conn) -> Dict[str, int]:
    queued = 0
    for automation in list_automations(conn):
        if not automation.get("enabled"):
            continue
        if automation.get("trigger_type") != "schedule":
            continue
        config = automation.get("trigger_config") or {}
        interval = int(config.get("interval_seconds") or 0)
        if interval <= 0:
            continue
        last_run = automation.get("last_run_at")
        if last_run:
            elapsed = (utcnow() - last_run).total_seconds()
            if elapsed < interval:
                continue
        create_job(conn, "automation_run", {"automation_id": automation["id"], "reason": "schedule"})
        queued += 1
        update_automation_last_run(conn, automation["id"])
    return {"queued": queued}


def run_event_automations(conn, event: str, payload: dict) -> Dict[str, int]:
    queued = 0
    for automation in list_automations(conn):
        if not automation.get("enabled"):
            continue
        if automation.get("trigger_type") != "event":
            continue
        config = automation.get("trigger_config") or {}
        if config.get("event") and config.get("event") != event:
            continue
        if not _match_trigger_filters(config, payload):
            continue
        create_job(
            conn,
            "automation_run",
            {"automation_id": automation["id"], "reason": f"event:{event}", "event": event, "payload": payload},
        )
        queued += 1
    return {"queued": queued}


def run_automation(conn, automation: dict, event: str | None = None, payload: dict | None = None, dry_run: bool = False) -> Dict[str, Any]:
    context = {"event": payload or {}, "vars": {}, "last": None, "dry_run": dry_run, "event_name": event}
    run_id = create_automation_run(conn, automation["id"], "RUNNING", context, {"steps": []})
    try:
        log = _execute_graph(conn, automation.get("graph") or {}, context)
        update_automation_run(conn, run_id, "DONE", log=log)
        update_automation_last_run(conn, automation["id"])
        return {"status": "DONE", "run_id": run_id, "log": log}
    except Exception as exc:
        update_automation_run(conn, run_id, "FAILED", log={"error": str(exc)}, reason=str(exc))
        return {"status": "FAILED", "run_id": run_id, "error": str(exc)}


def run_automation_job(conn, _job_id: int, payload: dict) -> Dict[str, Any]:
    automation_id = payload.get("automation_id")
    if not automation_id:
        return {"status": "FAILED", "reason": "missing_automation_id"}
    automation = get_automation(conn, int(automation_id))
    if not automation:
        return {"status": "FAILED", "reason": "automation_not_found"}
    context_payload = payload.get("payload") or {}
    result = run_automation(
        conn,
        automation,
        event=payload.get("event"),
        payload=context_payload,
        dry_run=bool(payload.get("dry_run", False)),
    )
    return result


def run_automation_event_job(conn, _job_id: int, payload: dict) -> Dict[str, Any]:
    event = payload.get("event")
    if not event:
        return {"status": "FAILED", "reason": "missing_event"}
    data = payload.get("payload") or {}
    return run_event_automations(conn, event, data)


def _execute_graph(conn, graph: dict, context: dict) -> dict:
    nodes = graph.get("nodes") or []
    edges = graph.get("edges") or []
    if not nodes:
        return {"steps": [], "warning": "empty_graph"}
    node_map = {node.get("id"): node for node in nodes if node.get("id")}
    incoming = {node_id: 0 for node_id in node_map}
    for edge in edges:
        to_id = edge.get("to")
        if to_id in incoming:
            incoming[to_id] += 1
    queue = [node_id for node_id, count in incoming.items() if count == 0]
    if not queue:
        queue = [nodes[0].get("id")]
    steps: List[dict] = []
    max_steps = 200
    while queue and len(steps) < max_steps:
        node_id = queue.pop(0)
        if not node_id or node_id not in node_map:
            continue
        node = node_map[node_id]
        started = time.monotonic()
        result = _execute_node(conn, node, context)
        duration_ms = int((time.monotonic() - started) * 1000)
        steps.append({"node": node_id, "type": node.get("type"), "result": result, "duration_ms": duration_ms})
        context["last"] = result
        for edge in edges:
            if edge.get("from") != node_id:
                continue
            if _edge_allows(edge, result, context):
                queue.append(edge.get("to"))
    return {"steps": steps, "final": context.get("last")}


def _execute_node(conn, node: dict, context: dict) -> Any:
    node_type = node.get("type") or "action"
    config = node.get("config") or {}
    dry_run = bool(context.get("dry_run"))
    if node_type == "start":
        return True
    if node_type == "condition":
        return _eval_condition(config, context)
    if node_type == "switch":
        return _resolve_value(config.get("value"), context)
    if node_type == "set_var":
        key = str(config.get("key") or "").strip()
        value = _resolve_value(config.get("value"), context)
        if key:
            context["vars"][key] = value
        return value
    if node_type == "queue_scan":
        urls = _resolve_value(config.get("urls"), context)
        limit = int(config.get("limit") or 200)
        coerce_hosts = bool(config.get("coerce_hosts", False))
        queued = _queue_scans(conn, urls, limit=limit, coerce_hosts=coerce_hosts, dry_run=dry_run)
        return {"queued": queued}
    if node_type == "pivot_crtsh":
        domain = _resolve_value(config.get("domain"), context)
        subdomains = crtsh_subdomains(str(domain))
        if config.get("queue_scans"):
            _queue_scans(conn, _hosts_to_urls(subdomains), limit=200, dry_run=dry_run)
        return subdomains
    if node_type == "pivot_domainsdb":
        domain = _resolve_value(config.get("domain"), context)
        result = domainsdb_search(str(domain), limit=int(config.get("limit") or 50))
        domains = result.get("domains") or []
        if config.get("queue_scans"):
            _queue_scans(conn, _hosts_to_urls(domains), limit=200, dry_run=dry_run)
        return domains
    if node_type == "pivot_blockcypher":
        addresses = _resolve_value(config.get("addresses") or config.get("address"), context)
        addr_list = _normalize_list(addresses)
        related: list[str] = []
        for addr in addr_list[:10]:
            data = blockcypher_address_summary(conn, addr, limit=int(config.get("limit") or 20))
            for item in data.get("related_addresses") or []:
                if item not in related:
                    related.append(item)
        return related
    if node_type == "pivot_holehe":
        emails = _resolve_value(config.get("emails") or config.get("email"), context)
        email_list = _normalize_list(emails)
        results = []
        for email in email_list[:10]:
            results.append({"email": email, "data": holehe_lookup(email)})
        return results
    if node_type == "spider":
        url = _resolve_value(config.get("url"), context)
        if not url:
            return {"error": "missing_url"}
        payload = {
            "url": url,
            "max_pages": int(config.get("max_pages") or 200),
            "max_depth": int(config.get("max_depth") or 2),
            "use_sitemap": "1" if config.get("use_sitemap", True) else "0",
        }
        if dry_run:
            return {"dry_run": True, "payload": payload}
        job_id = create_job(conn, "spider", payload)
        return {"job_id": job_id}
    if node_type == "normalize":
        values = _resolve_value(config.get("values") or config.get("value"), context)
        return _normalize_values(values, config)
    if node_type == "dedupe":
        values = _resolve_value(config.get("values") or config.get("value"), context)
        return _dedupe_values(values)
    if node_type == "filter_regex":
        values = _resolve_value(config.get("values") or config.get("value"), context)
        pattern = config.get("pattern")
        negate = bool(config.get("negate", False))
        return _filter_regex(values, pattern, negate=negate)
    if node_type == "select_indicators":
        kind = str(config.get("kind") or "").strip()
        pattern = config.get("pattern")
        limit = int(config.get("limit") or 200)
        indicator_map = (context.get("event") or {}).get("indicator_map") or {}
        values = indicator_map.get(kind, [])
        if pattern:
            values = _filter_regex(values, pattern, negate=False)
        return values[:limit]
    if node_type == "extract_domains":
        values = _resolve_value(config.get("values") or config.get("value"), context)
        return _extract_domains(values)
    if node_type == "save_iocs":
        kind = str(config.get("kind") or "").strip()
        values = _resolve_value(config.get("values") or config.get("value"), context)
        source = config.get("source")
        target_id = _resolve_value(config.get("target_id"), context)
        url = _resolve_value(config.get("url"), context)
        domain = _resolve_value(config.get("domain"), context)
        note = _resolve_value(config.get("note"), context)
        count = 0
        for value in _normalize_list(values)[:500]:
            if not kind or not value:
                continue
            if dry_run:
                count += 1
                continue
            create_ioc(conn, kind, str(value), target_id=target_id, url=url, domain=domain, source=source, note=note)
            count += 1
        return {"saved": count, "dry_run": dry_run}
    if node_type == "webhook":
        url = _resolve_value(config.get("url"), context)
        method = (config.get("method") or "POST").upper()
        payload = _resolve_value(config.get("payload") or {}, context)
        headers = config.get("headers") or {}
        if dry_run:
            return {"dry_run": True, "url": url, "method": method}
        try:
            resp = requests.request(method, url, json=payload, headers=headers, timeout=10)
            return {"status": resp.status_code, "ok": resp.status_code < 400}
        except Exception as exc:
            return {"error": str(exc)}
    return {"warning": "unknown_node_type"}


def _queue_scans(conn, urls: Any, limit: int = 200, coerce_hosts: bool = False, dry_run: bool = False) -> int:
    url_list = _normalize_list(urls)
    if coerce_hosts:
        url_list = _hosts_to_urls(url_list)
    queued = 0
    for url in url_list[:limit]:
        if not url:
            continue
        if not dry_run:
            create_job(conn, "scan", {"url": url})
        queued += 1
    return queued


def _hosts_to_urls(hosts: Iterable[str]) -> list[str]:
    out: list[str] = []
    for host in hosts:
        host = str(host).strip()
        if not host:
            continue
        if host.startswith("http://") or host.startswith("https://"):
            out.append(host)
        else:
            out.append(f"https://{host}")
    return out


def _normalize_list(value: Any) -> list:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, tuple):
        return list(value)
    return [value]


def _resolve_value(value: Any, context: dict) -> Any:
    if isinstance(value, list):
        return [_resolve_value(item, context) for item in value]
    if not isinstance(value, str):
        return value
    if "{{" not in value:
        return value
    def replace(match: re.Match) -> str:
        path = match.group(1).strip()
        resolved = _resolve_path(path, context)
        return "" if resolved is None else str(resolved)
    return re.sub(r"\{\{([^}]+)\}\}", replace, value)


def _resolve_path(path: str, context: dict) -> Any:
    parts = path.split(".")
    current: Any = context
    for part in parts:
        if isinstance(current, dict) and part in current:
            current = current[part]
        else:
            return None
    return current


def _eval_condition(config: dict, context: dict) -> bool:
    left = _resolve_value(config.get("left"), context)
    right = _resolve_value(config.get("right"), context)
    op = (config.get("operator") or "exists").lower()
    if op == "exists":
        return bool(left)
    if op == "equals":
        return left == right
    if op == "not_equals":
        return left != right
    if op == "contains":
        if isinstance(left, list):
            return right in left
        if isinstance(left, str) and right is not None:
            return str(right) in left
        return False
    if op == "startswith":
        return isinstance(left, str) and right is not None and left.startswith(str(right))
    if op == "endswith":
        return isinstance(left, str) and right is not None and left.endswith(str(right))
    if op == "regex":
        if left is None or right is None:
            return False
        try:
            return re.search(str(right), str(left)) is not None
        except Exception:
            return False
    if op == "in":
        if isinstance(right, list):
            return left in right
        return False
    if op == "not_in":
        if isinstance(right, list):
            return left not in right
        return False
    if op == "count_gte":
        try:
            return len(left or []) >= int(right or 0)
        except Exception:
            return False
    if op == "gte":
        try:
            return float(left) >= float(right)
        except Exception:
            return False
    if op == "lte":
        try:
            return float(left) <= float(right)
        except Exception:
            return False
    return False


def _match_trigger_filters(config: dict, payload: dict) -> bool:
    domain = (payload or {}).get("domain") or ""
    url = (payload or {}).get("url") or ""
    risk = payload.get("risk_score") if isinstance(payload, dict) else None
    domain_re = config.get("domain_regex")
    url_re = config.get("url_regex")
    if domain_re:
        try:
            if not re.search(domain_re, domain):
                return False
        except Exception:
            return False
    if url_re:
        try:
            if not re.search(url_re, url):
                return False
        except Exception:
            return False
    risk_gte = config.get("risk_gte")
    if risk_gte is not None:
        try:
            if (risk or 0) < int(risk_gte):
                return False
        except Exception:
            return False
    return True


def _edge_allows(edge: dict, result: Any, context: dict) -> bool:
    condition = (edge.get("condition") or "always").strip()
    if not condition or condition == "always":
        return True
    if condition == "true":
        return result is True
    if condition == "false":
        return result is False
    if ":" not in condition:
        return False
    kind, raw = condition.split(":", 1)
    kind = kind.strip().lower()
    raw = raw.strip()
    if kind == "equals":
        return str(result) == raw
    if kind == "contains":
        if isinstance(result, list):
            return raw in [str(item) for item in result]
        return raw in str(result)
    if kind == "regex":
        try:
            return re.search(raw, str(result)) is not None
        except Exception:
            return False
    if kind == "gte":
        try:
            return float(result) >= float(raw)
        except Exception:
            return False
    if kind == "lte":
        try:
            return float(result) <= float(raw)
        except Exception:
            return False
    return False


def _normalize_values(values: Any, config: dict) -> list:
    items = _normalize_list(values)
    lower = bool(config.get("lower", True))
    strip = bool(config.get("strip", True))
    remove_query = bool(config.get("remove_query", False))
    remove_fragment = bool(config.get("remove_fragment", True))
    out: list[str] = []
    for item in items:
        text = str(item)
        if strip:
            text = text.strip()
        if lower:
            text = text.lower()
        if text.startswith("http://") or text.startswith("https://"):
            try:
                from urllib.parse import urlparse, urlunparse

                parsed = urlparse(text)
                query = "" if remove_query else parsed.query
                fragment = "" if remove_fragment else parsed.fragment
                text = urlunparse(
                    (parsed.scheme, parsed.netloc, parsed.path, parsed.params, query, fragment)
                )
            except Exception:
                pass
        out.append(text)
    return out


def _dedupe_values(values: Any) -> list:
    seen = set()
    out = []
    for item in _normalize_list(values):
        key = str(item)
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


def _filter_regex(values: Any, pattern: str | None, negate: bool = False) -> list:
    if not pattern:
        return _normalize_list(values)
    out: list[str] = []
    for item in _normalize_list(values):
        text = str(item)
        try:
            match = re.search(pattern, text) is not None
        except Exception:
            match = False
        if match and not negate:
            out.append(item)
        if not match and negate:
            out.append(item)
    return out


def _extract_domains(values: Any) -> list:
    from urllib.parse import urlparse

    out: list[str] = []
    for item in _normalize_list(values):
        text = str(item)
        if "://" in text:
            try:
                host = urlparse(text).netloc
            except Exception:
                host = ""
        else:
            host = text
        if host:
            out.append(host)
    return out


def utcnow():
    from backend.src.utils.time import utcnow as _utcnow

    return _utcnow()
