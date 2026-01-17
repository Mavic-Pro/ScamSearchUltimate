import base64
import re
from io import BytesIO
from typing import Optional, Tuple

import imagehash
import mmh3
from PIL import Image
import requests

DATA_URI_RE = re.compile(r"^data:image/[^;]+;base64,(.+)$", re.IGNORECASE)


def favicon_hash_from_data_uri(data_uri: str) -> Tuple[Optional[str], Optional[str]]:
    match = DATA_URI_RE.match(data_uri)
    if not match:
        return None, None
    try:
        raw = base64.b64decode(match.group(1))
        mmh = str(mmh3.hash(raw))
        img = Image.open(BytesIO(raw))
        phash = str(imagehash.phash(img))
        return mmh, phash
    except Exception:
        return None, None


def fetch_favicon_bytes(url: str) -> Tuple[Optional[bytes], Optional[str], Optional[str]]:
    try:
        resp = requests.get(url, timeout=5, headers={"User-Agent": "ScamHunter/1.0"})
    except Exception as exc:
        return None, None, f"fetch_error:{exc}"
    ctype = resp.headers.get("Content-Type", "").split(";")[0].strip().lower()
    if not ctype.startswith("image/"):
        return None, None, f"content_type:{ctype}"
    return resp.content, ctype or "image/x-icon", None


def favicon_hash_from_url(url: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    raw, _ctype, err = fetch_favicon_bytes(url)
    if err or raw is None:
        return None, None, err
    try:
        mmh = str(mmh3.hash(raw))
        img = Image.open(BytesIO(raw))
        phash = str(imagehash.phash(img))
        return mmh, phash, None
    except Exception as exc:
        return None, None, f"hash_error:{exc}"
