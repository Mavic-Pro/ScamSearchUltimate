from __future__ import annotations

import requests


def crtsh_subdomains(domain: str) -> list[str]:
    domain = domain.strip().lower()
    if not domain:
        return []
    try:
        resp = requests.get(
            "https://crt.sh/",
            params={"q": f"%.{domain}", "output": "json"},
            timeout=10,
        )
        data = resp.json()
    except Exception:
        return []
    out = set()
    for item in data or []:
        name = item.get("name_value")
        if not name:
            continue
        for raw in str(name).splitlines():
            host = raw.strip().lower()
            if not host:
                continue
            if host.startswith("*."):
                host = host[2:]
            if host == domain or host.endswith(f".{domain}"):
                out.add(host)
    return sorted(out)
