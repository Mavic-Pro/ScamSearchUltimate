import base64
from typing import List

import requests

from backend.src.core.settings import get_setting_value


def _qbase64(q: str) -> str:
    return base64.b64encode(q.encode("utf-8")).decode("utf-8")


def fofa_search(conn, query: str, page: int = 1, size: int = 10) -> List[str]:
    email = get_setting_value(conn, "FOFA_EMAIL")
    key = get_setting_value(conn, "FOFA_KEY")
    if not email or not key:
        return []
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
        data = resp.json()
    except Exception:
        return []
    results = data.get("results") or []
    return [row[0] for row in results if row]
