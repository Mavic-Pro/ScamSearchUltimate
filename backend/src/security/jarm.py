import hashlib
import socket
import ssl
from typing import Optional


def calculate_jarm(hostname: str, port: int = 443, timeout: float = 3.0) -> Optional[str]:
    # Best-effort: try external jarm module, fallback to simple TLS fingerprint
    try:
        import jarm  # type: ignore

        if hasattr(jarm, "jarm"):
            return jarm.jarm(hostname, port)
    except Exception:
        pass
    return _simple_tls_fingerprint(hostname, port, timeout)


def _simple_tls_fingerprint(hostname: str, port: int, timeout: float) -> Optional[str]:
    try:
        ctx = ssl.create_default_context()
        ctx.set_alpn_protocols(["h2", "http/1.1"])
        with socket.create_connection((hostname, port), timeout=timeout) as sock:
            with ctx.wrap_socket(sock, server_hostname=hostname) as ssock:
                version = ssock.version() or ""
                cipher = ssock.cipher()[0] if ssock.cipher() else ""
                alpn = ssock.selected_alpn_protocol() or ""
                raw = f"{version}|{cipher}|{alpn}"
                return hashlib.sha256(raw.encode("utf-8")).hexdigest()
    except Exception:
        return None
