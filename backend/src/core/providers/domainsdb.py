from __future__ import annotations

import requests


def domainsdb_search(domain: str, limit: int = 50) -> dict:
    domain = domain.strip().lower()
    if not domain:
        return {"domains": []}
    params = {"domain": domain}
    try:
        resp = requests.get(
            "https://api.domainsdb.info/v1/domains/search",
            params=params,
            timeout=10,
        )
        data = resp.json()
    except Exception:
        return {"domains": []}
    domains = data.get("domains") or []
    results = []
    for item in domains[: max(1, min(limit, 200))]:
        name = item.get("domain")
        if name:
            results.append(name)
    return {"domains": results, "count": data.get("count")}
