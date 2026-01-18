import base64
from typing import List, Tuple

import requests

from backend.src.core.settings import get_setting_value
from backend.src.utils.logging import log_error


def _qbase64(q: str) -> str:
    return base64.b64encode(q.encode("utf-8")).decode("utf-8")


def fofa_search(conn, query: str, page: int = 1, size: int = 10) -> List[str]:
    results, _ = fofa_search_verbose(conn, query, page=page, size=size)
    return results


def fofa_search_verbose(conn, query: str, page: int = 1, size: int = 10) -> Tuple[List[str], str | None]:
    email = get_setting_value(conn, "FOFA_EMAIL")
    key = get_setting_value(conn, "FOFA_KEY")
    if not email or not key:
        return [], "FOFA_EMAIL/FOFA_KEY mancante"
    params = {
        "email": email,
        "key": key,
        "qbase64": _qbase64(query),
        "page": page,
        "size": size,
        "fields": "host",
    }
    try:
        resp = requests.get("https://fofa.info/api/v1/search/all", params=params, timeout=8)
        if resp.status_code >= 400:
            log_error("FOFA HTTP error", f"{resp.status_code}")
            return [], f"FOFA HTTP {resp.status_code}"
        data = resp.json()
    except Exception as exc:
        log_error("FOFA request failed", str(exc))
        return [], "FOFA errore di rete"
    if data.get("error"):
        errmsg = data.get("errmsg") or data.get("error")
        log_error("FOFA response error", str(errmsg))
        return [], f"FOFA errore: {errmsg}"
    results = data.get("results") or []
    if not isinstance(results, list):
        log_error("FOFA results type invalid", f"{type(results).__name__}")
        return [], "FOFA risposta non valida"
    hosts: list[str] = []
    for row in results:
        if not row:
            continue
        if isinstance(row, (list, tuple)) and row:
            hosts.append(str(row[0]))
            continue
        if isinstance(row, str):
            hosts.append(row)
            continue
    return hosts, None
