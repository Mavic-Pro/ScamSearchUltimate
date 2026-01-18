import hashlib
from typing import Optional, Tuple
from urllib.parse import urlparse

import requests

DANGEROUS_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
    ".zip",
    ".exe",
    ".dll",
    ".msi",
    ".rar",
    ".7z",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".mp4",
    ".mov",
    ".avi",
    ".mp3",
}

ALLOWED_HTML = {"text/html", "application/xhtml+xml"}
ALLOWED_ASSET = {"text/css", "text/javascript", "application/javascript", "application/x-javascript"}


class FetchResult:
    def __init__(
        self,
        ok: bool,
        status: str,
        reason: str | None,
        content: bytes | None,
        headers: dict,
        redirect_chain: list[dict] | None = None,
    ):
        self.ok = ok
        self.status = status
        self.reason = reason
        self.content = content
        self.headers = headers
        self.redirect_chain = redirect_chain or []


def is_dangerous_url(url: str) -> bool:
    parsed = urlparse(url)
    path = parsed.path.lower()
    for ext in DANGEROUS_EXTENSIONS:
        if path.endswith(ext):
            return True
    return False


def safe_fetch_html(url: str, timeout: int = 8) -> FetchResult:
    if is_dangerous_url(url):
        return FetchResult(False, "SKIPPED_FILE", "dangerous_extension", None, {}, [])
    try:
        resp = requests.get(url, timeout=timeout, headers={"User-Agent": "ScamHunter/1.0"})
    except Exception as exc:
        return FetchResult(False, "FAILED", str(exc), None, {}, [])

    ctype = resp.headers.get("Content-Type", "").split(";")[0].strip().lower()
    if ctype not in ALLOWED_HTML:
        return FetchResult(False, "SKIPPED_FILE", f"content_type:{ctype}", None, dict(resp.headers), _redirect_chain(resp))

    return FetchResult(True, "DONE", None, resp.content, dict(resp.headers), _redirect_chain(resp))


def safe_fetch_asset(url: str, timeout: int = 6) -> Tuple[str, Optional[bytes], Optional[str]]:
    if is_dangerous_url(url):
        return "SKIPPED_FILE", None, "dangerous_extension"
    try:
        resp = requests.get(url, timeout=timeout, headers={"User-Agent": "ScamHunter/1.0"})
    except Exception as exc:
        return "FAILED", None, str(exc)

    ctype = resp.headers.get("Content-Type", "").split(";")[0].strip().lower()
    if ctype not in ALLOWED_ASSET:
        return "SKIPPED_FILE", None, f"content_type:{ctype}"

    return "DONE", resp.content, None


def hash_bytes(data: bytes) -> Tuple[str, str]:
    md5 = hashlib.md5(data).hexdigest()
    sha256 = hashlib.sha256(data).hexdigest()
    return md5, sha256


def _redirect_chain(resp: requests.Response) -> list[dict]:
    chain: list[dict] = []
    for item in resp.history or []:
        chain.append(
            {
                "url": item.url,
                "status": item.status_code,
                "location": item.headers.get("Location"),
            }
        )
    chain.append({"url": resp.url, "status": resp.status_code, "location": None})
    return chain
