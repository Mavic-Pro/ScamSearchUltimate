from typing import Dict, List

import requests

from backend.src.core.settings import get_setting_value


def urlscan_search(conn, query: str) -> List[str]:
    api_key = get_setting_value(conn, "URLSCAN_KEY")
    if not api_key:
        return []
    headers = {"API-Key": api_key}
    params = {"q": query}
    try:
        resp = requests.get("https://urlscan.io/api/v1/search/", headers=headers, params=params, timeout=8)
        data = resp.json()
    except Exception:
        return []
    results = data.get("results") or []
    urls = []
    for item in results:
        task = item.get("task") or {}
        url = task.get("url")
        if url:
            urls.append(url)
    return urls


def urlscan_search_hash(conn, hash_value: str) -> List[str]:
    api_key = get_setting_value(conn, "URLSCAN_KEY")
    if not api_key:
        return []
    headers = {"API-Key": api_key}
    params = {"q": f'hash:\"{hash_value}\"'}
    try:
        resp = requests.get("https://urlscan.io/api/v1/search/", headers=headers, params=params, timeout=8)
        data = resp.json()
    except Exception:
        return []
    results = data.get("results") or []
    urls = []
    for item in results:
        task = item.get("task") or {}
        url = task.get("url")
        if url:
            urls.append(url)
    return urls


def urlscan_get_redirects(conn, url: str) -> Dict[str, object]:
    api_key = get_setting_value(conn, "URLSCAN_KEY")
    if not api_key:
        return {"error": "URLSCAN_KEY mancante"}
    headers = {"API-Key": api_key}
    params = {"q": f'task.url:"{url}"', "size": 1}
    try:
        resp = requests.get("https://urlscan.io/api/v1/search/", headers=headers, params=params, timeout=8)
        data = resp.json()
    except Exception as exc:
        return {"error": str(exc)}
    results = data.get("results") or []
    if not results:
        return {"error": "Nessun risultato urlscan per questo URL."}
    result_url = results[0].get("result")
    if not result_url:
        return {"error": "Risultato urlscan non disponibile."}
    try:
        detail = requests.get(result_url, headers=headers, timeout=8)
        result_data = detail.json()
    except Exception as exc:
        return {"error": str(exc)}
    chain = _extract_redirect_chain(result_data)
    return {
        "chain": chain,
        "page_url": result_data.get("page", {}).get("url"),
        "result": result_url,
    }


def _extract_redirect_chain(result_data: Dict[str, object]) -> List[Dict[str, object]]:
    chain: List[Dict[str, object]] = []
    data = result_data.get("data") or {}
    requests_list = data.get("requests") or []
    for item in requests_list:
        req = item.get("request") or {}
        resp = item.get("response") or {}
        url = req.get("url")
        status = resp.get("status")
        headers = resp.get("headers") or {}
        location = headers.get("location") or headers.get("Location")
        if url:
            chain.append({"url": url, "status": status, "location": location})
    page_url = result_data.get("page", {}).get("url")
    if page_url and (not chain or chain[-1].get("url") != page_url):
        chain.append({"url": page_url, "status": None, "location": None})
    return chain
