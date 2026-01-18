from __future__ import annotations

from collections import deque
from typing import Iterable
from urllib.parse import urljoin, urlparse, urldefrag
import xml.etree.ElementTree as ET

import requests
from bs4 import BeautifulSoup

from backend.src.db.dao.jobs import create_job, filter_new_job_urls, get_job_status
from backend.src.security.safe_fetch import safe_fetch_html


def run_spider_job(conn, job_id: int, payload: dict) -> dict:
    seed = (payload or {}).get("url") or ""
    seed = seed.strip()
    if not seed:
        return {"status": "FAILED", "reason": "missing_url"}

    max_pages = int(payload.get("max_pages", 200) or 200)
    max_depth = int(payload.get("max_depth", 2) or 2)
    use_sitemap = str(payload.get("use_sitemap", "1")).lower() in {"1", "true", "yes"}
    timeout = int(payload.get("timeout", 8) or 8)
    same_domain = str(payload.get("same_domain", "1")).lower() in {"1", "true", "yes"}

    seed_parsed = urlparse(seed)
    seed_host = seed_parsed.netloc.lower()

    visited: set[str] = set()
    to_visit = deque([(seed, 0)])
    discovered: set[str] = set()

    if use_sitemap:
        sitemap_urls = _load_sitemap(seed, timeout)
        for url in sitemap_urls:
            if _allowed(url, seed_host, same_domain):
                to_visit.append((url, 1))

    while to_visit and len(visited) < max_pages:
        current_status = get_job_status(conn, job_id)
        if current_status in {"STOPPED", "SKIPPED"}:
            return {"status": current_status, "reason": "user_stop"}

        url, depth = to_visit.popleft()
        url = _normalize_url(url)
        if not url or url in visited:
            continue
        if same_domain and not _allowed(url, seed_host, same_domain):
            continue
        visited.add(url)
        discovered.add(url)

        if depth >= max_depth:
            continue

        fetch = safe_fetch_html(url, timeout=timeout)
        if not fetch.ok or not fetch.content:
            continue
        html = fetch.content.decode("utf-8", errors="ignore")
        for link in _extract_links(html, url):
            if link in visited:
                continue
            if same_domain and not _allowed(link, seed_host, same_domain):
                continue
            to_visit.append((link, depth + 1))

    new_urls = filter_new_job_urls(conn, list(discovered))
    queued_ids = []
    for url in new_urls:
        queued_ids.append(create_job(conn, "scan", {"url": url}))
    return {
        "status": "DONE",
        "queued": len(queued_ids),
        "visited": len(visited),
        "discovered": len(discovered),
    }


def _extract_links(html: str, base_url: str) -> Iterable[str]:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup.find_all("a"):
        href = tag.get("href")
        if not href:
            continue
        yield _normalize_url(urljoin(base_url, href))


def _normalize_url(url: str) -> str:
    if not url:
        return ""
    url, _fragment = urldefrag(url.strip())
    return url


def _allowed(url: str, seed_host: str, same_domain: bool) -> bool:
    if not same_domain:
        return True
    try:
        host = urlparse(url).netloc.lower()
    except Exception:
        return False
    return host == seed_host


def _load_sitemap(seed_url: str, timeout: int) -> list[str]:
    base = seed_url.rstrip("/")
    candidates = [f"{base}/sitemap.xml"]
    out: list[str] = []
    for candidate in candidates:
        try:
            resp = requests.get(candidate, timeout=timeout, headers={"User-Agent": "ScamHunter/1.0"})
            if resp.status_code >= 400:
                continue
            out.extend(_parse_sitemap(resp.text))
        except Exception:
            continue
    return out[:500]


def _parse_sitemap(text: str) -> list[str]:
    urls: list[str] = []
    try:
        root = ET.fromstring(text)
    except Exception:
        return []
    for elem in root.iter():
        if elem.tag.endswith("loc") and elem.text:
            urls.append(elem.text.strip())
    return urls
