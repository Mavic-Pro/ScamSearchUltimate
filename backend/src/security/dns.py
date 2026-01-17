import socket
from typing import Optional


def resolve_ip(hostname: str, timeout: float = 2.0) -> Optional[str]:
    try:
        socket.setdefaulttimeout(timeout)
        infos = socket.getaddrinfo(hostname, 443)
        for info in infos:
            addr = info[4][0]
            if addr:
                return addr
    except Exception:
        return None
    return None
