from typing import List

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
