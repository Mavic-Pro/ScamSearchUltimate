from typing import List, Tuple

import requests

from backend.src.core.settings import get_setting_value
from backend.src.utils.logging import log_error


def serp_search(conn, query: str, engine: str = "google") -> List[str]:
    urls, _ = serp_search_verbose(conn, query, engine)
    return urls


def serp_search_verbose(conn, query: str, engine: str = "google") -> Tuple[List[str], str | None]:
    api_key = get_setting_value(conn, "SERPAPI_KEY")
    if not api_key:
        return [], "SERPAPI_KEY mancante"
    if engine == "yandex":
        params = {
            "engine": "yandex",
            "text": query,
            "yandex_domain": "yandex.com",
            "api_key": api_key
        }
    else:
        params = {"engine": engine, "q": query, "api_key": api_key}
    try:
        resp = requests.get("https://serpapi.com/search.json", params=params, timeout=8)
        if resp.status_code >= 400:
            log_error("SerpAPI HTTP error", f"{engine} {resp.status_code}")
            return [], f"SerpAPI {engine} HTTP {resp.status_code}"
        data = resp.json()
    except Exception as exc:
        log_error("SerpAPI request failed", f"{engine} {exc}")
        return [], f"SerpAPI {engine} errore di rete"
    if data.get("error"):
        log_error("SerpAPI response error", f"{engine} {data.get('error')}")
        return [], f"SerpAPI {engine} errore: {data.get('error')}"
    results = data.get("organic_results") or []
    return [r.get("link") for r in results if r.get("link")], None
