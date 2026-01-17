import json
import os
from pathlib import Path
from typing import Any, Dict, List

import requests

from backend.src.core.settings import get_setting_value
from backend.src.db.dao.targets import get_target
from backend.src.db.dao.iocs import list_iocs_for_target


def _load_context(conn, target_id: int, include_dom: bool, include_iocs: bool) -> str:
    target = get_target(conn, target_id)
    if not target:
        return "No target found for context."
    context_lines = [
        f"Target ID: {target_id}",
        f"URL: {target.get('url')}",
        f"Domain: {target.get('domain')}",
        f"IP: {target.get('ip')}",
        f"JARM: {target.get('jarm')}",
        f"DOM hash: {target.get('dom_hash')}",
        f"Headers hash: {target.get('headers_hash')}",
        f"Favicon hash: {target.get('favicon_hash')}",
    ]
    if include_dom:
        html_path = target.get("html_path")
        if html_path:
            try:
                text = Path(html_path).read_text(encoding="utf-8", errors="ignore")
                max_len = 20000
                snippet = text[:max_len]
                context_lines.append("FULL_DOM_START")
                context_lines.append(snippet)
                context_lines.append("FULL_DOM_END")
            except Exception:
                context_lines.append("FULL_DOM: unavailable")
    if include_iocs:
        iocs = list_iocs_for_target(conn, target_id)
        if iocs:
            context_lines.append("IOCS:")
            for ioc in iocs[:50]:
                context_lines.append(f"- {ioc.get('kind')}: {ioc.get('value')}")
    return "\n".join(context_lines)


def chat(conn, messages: list[dict], target_id: int | None = None, include_dom: bool = False, include_iocs: bool = False) -> dict:
    provider = get_setting_value(conn, "AI_PROVIDER", "")
    endpoint = get_setting_value(conn, "AI_ENDPOINT")
    api_key = get_setting_value(conn, "AI_KEY")
    if not endpoint:
        return {"error": "AI_ENDPOINT non configurato"}

    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    final_messages = list(messages)
    if target_id:
        ctx = _load_context(conn, target_id, include_dom, include_iocs)
        final_messages = [
            {"role": "system", "content": "Context from target analysis is provided below."},
            {"role": "system", "content": ctx},
            *final_messages,
        ]

    payload = {
        "model": os.getenv("AI_MODEL", "gpt-4o-mini"),
        "messages": final_messages,
    }

    try:
        resp = requests.post(endpoint.rstrip("/") + "/v1/chat/completions", json=payload, headers=headers, timeout=20)
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        return {"reply": content, "provider": provider or "openai-compatible"}
    except Exception as exc:
        return {"error": str(exc)}


def suggest_rules(conn, prompt: str, target_id: int | None = None, include_dom: bool = False, include_iocs: bool = False) -> Dict[str, Any]:
    heuristic = _heuristic_suggestions(prompt)
    endpoint = get_setting_value(conn, "AI_ENDPOINT")
    if not endpoint:
        return {"source": "heuristic", **heuristic}

    system = (
        "Generate JSON only with keys: hunts (list), signatures (list). "
        "hunts item: {name, rule_type, rule, ttl_seconds, delay_seconds, budget, enabled}. "
        "signatures item: {name, pattern, target_field, enabled}. "
        "No extra keys."
    )
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": f"Goal: {prompt}"},
    ]
    result = chat(conn, messages, target_id=target_id, include_dom=include_dom, include_iocs=include_iocs)
    if "error" in result:
        return {"source": "heuristic", **heuristic}
    parsed = _safe_json(result.get("reply", ""))
    if not parsed:
        return {"source": "heuristic", **heuristic}
    return {
        "source": "ai",
        "hunts": _validate_hunts(parsed.get("hunts", [])),
        "signatures": _validate_signatures(parsed.get("signatures", [])),
    }


def _safe_json(text: str) -> Dict[str, Any] | None:
    try:
        return json.loads(text)
    except Exception:
        return None


def _validate_hunts(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    valid = []
    for item in items:
        if not isinstance(item, dict):
            continue
        rule_type = item.get("rule_type")
        rule = item.get("rule")
        name = item.get("name")
        if set(item.keys()) - {"name", "rule_type", "rule", "ttl_seconds", "delay_seconds", "budget", "enabled"}:
            continue
        if rule_type not in {"fofa", "urlscan", "dork"} or not rule or not name:
            continue
        valid.append(
            {
                "name": name,
                "rule_type": rule_type,
                "rule": rule,
                "ttl_seconds": int(item.get("ttl_seconds", 3600)),
                "delay_seconds": int(item.get("delay_seconds", 60)),
                "budget": int(item.get("budget", 50)),
                "enabled": bool(item.get("enabled", True)),
            }
        )
    return valid


def _validate_signatures(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    valid = []
    for item in items:
        if not isinstance(item, dict):
            continue
        target_field = item.get("target_field")
        pattern = item.get("pattern")
        name = item.get("name")
        if set(item.keys()) - {"name", "pattern", "target_field", "enabled"}:
            continue
        if target_field not in {"html", "headers", "url", "asset"} or not pattern or not name:
            continue
        valid.append(
            {
                "name": name,
                "pattern": pattern,
                "target_field": target_field,
                "enabled": bool(item.get("enabled", True)),
            }
        )
    return valid


def _heuristic_suggestions(prompt: str) -> Dict[str, Any]:
    p = prompt.lower()
    hunts = []
    signatures = []
    if "login" in p or "signin" in p:
        hunts.append(
            {
                "name": "login-dork",
                "rule_type": "dork",
                "rule": "\"login\" \"password\"",
                "ttl_seconds": 3600,
                "delay_seconds": 60,
                "budget": 50,
                "enabled": True,
            }
        )
        signatures.append(
            {
                "name": "login-form",
                "pattern": "<form[^>]+(login|signin)",
                "target_field": "html",
                "enabled": True,
            }
        )
    if "wallet" in p or "crypto" in p:
        hunts.append(
            {
                "name": "wallet-fofa",
                "rule_type": "fofa",
                "rule": "title=\"Connect Wallet\" && body=\"wallet\"",
                "ttl_seconds": 3600,
                "delay_seconds": 60,
                "budget": 50,
                "enabled": True,
            }
        )
        signatures.append(
            {
                "name": "wallet-js",
                "pattern": "eth_requestAccounts|wallet_switchEthereumChain",
                "target_field": "asset",
                "enabled": True,
            }
        )
    if "office" in p or "o365" in p or "microsoft" in p:
        signatures.append(
            {
                "name": "o365-header",
                "pattern": "set-cookie:.*ESTSAUTH",
                "target_field": "headers",
                "enabled": True,
            }
        )
    return {"hunts": hunts, "signatures": signatures}
