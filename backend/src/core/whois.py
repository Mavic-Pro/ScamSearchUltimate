from typing import Any, Dict, Optional, Tuple

import requests

from backend.src.utils.logging import log_error


def rdap_domain(domain: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    try:
        resp = requests.get(f"https://rdap.org/domain/{domain}", timeout=8)
        if resp.status_code >= 400:
            log_error("RDAP domain HTTP error", f"{resp.status_code}")
            return None, f"RDAP domain HTTP {resp.status_code}"
        return resp.json(), None
    except Exception as exc:
        log_error("RDAP domain lookup failed", str(exc))
        return None, "RDAP domain errore di rete"


def rdap_ip(ip: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    try:
        resp = requests.get(f"https://rdap.org/ip/{ip}", timeout=8)
        if resp.status_code >= 400:
            log_error("RDAP IP HTTP error", f"{resp.status_code}")
            return None, f"RDAP IP HTTP {resp.status_code}"
        return resp.json(), None
    except Exception as exc:
        log_error("RDAP IP lookup failed", str(exc))
        return None, "RDAP IP errore di rete"
