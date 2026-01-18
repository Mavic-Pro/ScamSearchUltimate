import json
from pathlib import Path
from typing import Any, Dict, List, Tuple

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


def _normalize_provider(provider: str | None) -> str:
    if not provider:
        return "openai"
    raw = provider.strip().lower()
    if raw in {"anthropic", "claude"}:
        return "claude"
    if raw in {"gemini", "google"}:
        return "gemini"
    if raw in {"nexos", "nexos.ai"}:
        return "nexos"
    if raw in {"ollama", "local-ollama"}:
        return "ollama"
    if raw in {"openai", "openai-compatible", "openai_compatible"}:
        return "openai"
    return raw


def _default_base(provider: str) -> str | None:
    defaults = {
        "openai": "https://api.openai.com",
        "gemini": "https://generativelanguage.googleapis.com",
        "nexos": "https://api.nexos.ai",
        "claude": "https://api.anthropic.com",
        "ollama": "http://localhost:11434",
    }
    return defaults.get(provider)


def _openai_endpoint(base: str | None) -> str | None:
    if not base:
        return None
    trimmed = base.rstrip("/")
    if trimmed.endswith("/chat/completions"):
        return trimmed
    if trimmed.endswith("/v1"):
        return f"{trimmed}/chat/completions"
    return f"{trimmed}/v1/chat/completions"


def _gemini_payload(messages: list[dict]) -> Tuple[dict, str | None]:
    system_parts: List[str] = []
    contents: List[dict] = []
    for msg in messages:
        role = msg.get("role")
        content = str(msg.get("content", ""))
        if not content:
            continue
        if role == "system":
            system_parts.append(content)
            continue
        gemini_role = "user" if role == "user" else "model"
        contents.append({"role": gemini_role, "parts": [{"text": content}]})
    payload: Dict[str, Any] = {"contents": contents or [{"role": "user", "parts": [{"text": ""}]}]}
    system_text = "\n\n".join(system_parts).strip() or None
    if system_text:
        payload["systemInstruction"] = {"parts": [{"text": system_text}]}
    payload["generationConfig"] = {"maxOutputTokens": 1024}
    return payload, system_text


def _claude_payload(messages: list[dict]) -> Tuple[dict, str | None]:
    system_parts: List[str] = []
    content_messages: List[dict] = []
    for msg in messages:
        role = msg.get("role")
        content = str(msg.get("content", ""))
        if not content:
            continue
        if role == "system":
            system_parts.append(content)
            continue
        claude_role = "user" if role == "user" else "assistant"
        content_messages.append({"role": claude_role, "content": [{"type": "text", "text": content}]})
    system_text = "\n\n".join(system_parts).strip() or None
    payload = {"messages": content_messages or [{"role": "user", "content": [{"type": "text", "text": ""}]}]}
    if system_text:
        payload["system"] = system_text
    payload["max_tokens"] = 1024
    return payload, system_text


def _extract_openai_content(data: dict) -> str:
    return data["choices"][0]["message"]["content"]


def _extract_gemini_content(data: dict) -> str:
    return data["candidates"][0]["content"]["parts"][0]["text"]


def _extract_claude_content(data: dict) -> str:
    parts = data.get("content") or []
    texts = [part.get("text", "") for part in parts if isinstance(part, dict)]
    return "".join(texts).strip()


def _api_error(resp: requests.Response, data: dict | None) -> str:
    if data and isinstance(data, dict):
        err = data.get("error")
        if isinstance(err, dict):
            msg = err.get("message") or err.get("detail") or err.get("type")
            if msg:
                return str(msg)
        if isinstance(err, str):
            return err
    return f"AI API error ({resp.status_code})"


def ai_configured(conn) -> bool:
    provider = _normalize_provider(get_setting_value(conn, "AI_PROVIDER", ""))
    endpoint = get_setting_value(conn, "AI_ENDPOINT")
    api_key = get_setting_value(conn, "AI_KEY")
    if provider == "ollama":
        return True
    if api_key:
        return True
    if endpoint:
        return True
    return False


def verify_signature_match(
    conn,
    signature_name: str,
    target_field: str,
    pattern: str,
    snippet: str,
) -> tuple[bool | None, str | None]:
    system = (
        "You verify if a regex match is a real sensitive key or crypto wallet address. "
        "Return JSON only: {\"verified\": true|false, \"reason\": \"...\"}."
    )
    user = (
        f"Signature: {signature_name}\n"
        f"Target: {target_field}\n"
        f"Pattern: {pattern}\n"
        f"Snippet:\n{snippet}\n"
    )
    result = chat(conn, [{"role": "system", "content": system}, {"role": "user", "content": user}])
    if "error" in result:
        return None, result.get("error")
    parsed = _safe_json(result.get("reply", ""))
    if not parsed or "verified" not in parsed:
        return None, None
    return bool(parsed.get("verified")), str(parsed.get("reason") or "")


def chat(conn, messages: list[dict], target_id: int | None = None, include_dom: bool = False, include_iocs: bool = False) -> dict:
    provider = _normalize_provider(get_setting_value(conn, "AI_PROVIDER", ""))
    endpoint = get_setting_value(conn, "AI_ENDPOINT")
    api_key = get_setting_value(conn, "AI_KEY")
    model_override = get_setting_value(conn, "AI_MODEL", "")

    final_messages = list(messages)
    if target_id:
        ctx = _load_context(conn, target_id, include_dom, include_iocs)
        final_messages = [
            {"role": "system", "content": "Context from target analysis is provided below."},
            {"role": "system", "content": ctx},
            *final_messages,
        ]

    payload = {
        "model": model_override or "gpt-4o-mini",
        "messages": final_messages,
    }

    try:
        if provider == "gemini":
            base = endpoint or _default_base(provider)
            if not base:
                return {"error": "AI_ENDPOINT non configurato"}
            if not api_key:
                return {"error": "AI_KEY mancante"}
            model = model_override or "gemini-1.5-flash"
            if ":generateContent" in base:
                url = base
            else:
                url = f"{base.rstrip('/')}/v1beta/models/{model}:generateContent"
            separator = "&" if "?" in url else "?"
            url = f"{url}{separator}key={api_key}"
            payload, _ = _gemini_payload(final_messages)
            headers = {"Content-Type": "application/json"}
            resp = requests.post(url, json=payload, headers=headers, timeout=20)
            data = resp.json()
            if not resp.ok or data.get("error"):
                return {"error": _api_error(resp, data)}
            content = _extract_gemini_content(data)
            return {"reply": content, "provider": provider}

        if provider == "claude":
            base = endpoint or _default_base(provider)
            if not base:
                return {"error": "AI_ENDPOINT non configurato"}
            if not api_key:
                return {"error": "AI_KEY mancante"}
            if base.rstrip("/").endswith("/v1/messages"):
                url = base.rstrip("/")
            else:
                url = f"{base.rstrip('/')}/v1/messages"
            payload, _ = _claude_payload(final_messages)
            payload["model"] = model_override or "claude-3-5-sonnet-20240620"
            headers = {
                "Content-Type": "application/json",
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
            }
            resp = requests.post(url, json=payload, headers=headers, timeout=20)
            data = resp.json()
            if not resp.ok or data.get("error"):
                return {"error": _api_error(resp, data)}
            content = _extract_claude_content(data)
            return {"reply": content, "provider": provider}

        base = endpoint or _default_base(provider)
        openai_endpoint = _openai_endpoint(base)
        if not openai_endpoint:
            return {"error": "AI_ENDPOINT non configurato"}
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        resp = requests.post(openai_endpoint, json=payload, headers=headers, timeout=20)
        data = resp.json()
        if not resp.ok or data.get("error"):
            return {"error": _api_error(resp, data)}
        content = _extract_openai_content(data)
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


TASK_PROMPTS: Dict[str, str] = {
    "scan_queue_summary": (
        "You are an OSINT analyst. Summarize the scan queue status, highlight risks, "
        "and recommend next actions. Keep it short, bullet points allowed."
    ),
    "hunt_suggest": (
        "You are an OSINT analyst. Return JSON only with keys: name, rule_type, rule, "
        "ttl_seconds, delay_seconds, budget, enabled, rationale. "
        "rule_type must be one of: fofa, urlscan, dork. No extra keys."
    ),
    "urlscan_cluster": (
        "You are an OSINT analyst. Cluster results by likely campaign/theme and flag outliers. "
        "Return a short summary and a list of suspicious items with reasons."
    ),
    "campaigns_summary": (
        "You are an OSINT analyst. Summarize the campaign clusters and suggest next pivots "
        "(e.g., domain, ASN, registrar, hash, IP). Keep it concise."
    ),
    "lab_analysis": (
        "You are an OSINT analyst. Analyze the target context and data; identify phishing traits, "
        "suggest high-value IOCs, and propose next pivots."
    ),
    "signatures_suggest": (
        "You are an OSINT analyst. Return JSON only with keys: name, pattern, target_field, enabled, rationale. "
        "target_field must be one of: html, headers, url, asset. No extra keys."
    ),
    "yara_suggest": (
        "You are a YARA expert. Return JSON only with keys: name, target_field, rule_text, rationale. "
        "target_field must be one of: html, asset. No extra keys."
    ),
    "alerts_triage": (
        "You are an OSINT analyst. Triage the alerts, group by type, and list top-priority items "
        "with a brief rationale and suggested action."
    ),
    "iocs_prioritize": (
        "You are an OSINT analyst. Deduplicate and prioritize IOCs. Provide the top items with "
        "reasoning and export suitability."
    ),
    "graph_insights": (
        "You are an OSINT analyst. Summarize the graph clusters, identify bridge nodes, "
        "and suggest which nodes to expand next."
    ),
    "export_helper": (
        "You are an OSINT analyst. Recommend export filters, format, and TAXII mapping based on "
        "current IOC filters and goals."
    ),
}


def _validate_yara_rule(item: Dict[str, Any]) -> Dict[str, Any] | None:
    if not isinstance(item, dict):
        return None
    name = item.get("name")
    target_field = item.get("target_field")
    rule_text = item.get("rule_text")
    if set(item.keys()) - {"name", "target_field", "rule_text", "rationale"}:
        return None
    if target_field not in {"html", "asset"} or not name or not rule_text:
        return None
    return {
        "name": name,
        "target_field": target_field,
        "rule_text": rule_text,
        "rationale": item.get("rationale", ""),
    }


def run_task(
    conn,
    task: str,
    prompt: str | None = None,
    data: Dict[str, Any] | None = None,
    target_id: int | None = None,
    include_dom: bool = False,
    include_iocs: bool = False,
) -> Dict[str, Any]:
    system = TASK_PROMPTS.get(task)
    if not system:
        return {"error": "Unsupported AI task"}

    payload_lines: List[str] = []
    if prompt:
        payload_lines.append(f"User prompt: {prompt}")
    if data:
        payload_lines.append("Data (JSON):")
        payload_lines.append(json.dumps(data, ensure_ascii=True))
    if not payload_lines:
        payload_lines.append("Provide insights.")
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": "\n".join(payload_lines)},
    ]

    result = chat(conn, messages, target_id=target_id, include_dom=include_dom, include_iocs=include_iocs)
    if "error" in result:
        return result
    reply = result.get("reply", "")
    if task == "hunt_suggest":
        parsed = _safe_json(reply)
        if not parsed:
            return {"reply": reply}
        hunts = _validate_hunts([parsed])
        if not hunts:
            return {"reply": reply}
        return {"reply": parsed.get("rationale", ""), "data": hunts[0]}
    if task == "signatures_suggest":
        parsed = _safe_json(reply)
        if not parsed:
            return {"reply": reply}
        sigs = _validate_signatures([parsed])
        if not sigs:
            return {"reply": reply}
        data_out = sigs[0]
        data_out["rationale"] = parsed.get("rationale", "")
        return {"reply": parsed.get("rationale", ""), "data": data_out}
    if task == "yara_suggest":
        parsed = _safe_json(reply)
        if not parsed:
            return {"reply": reply}
        validated = _validate_yara_rule(parsed)
        if not validated:
            return {"reply": reply}
        return {"reply": validated.get("rationale", ""), "data": validated}
    return {"reply": reply}
