from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import FileResponse
from bs4 import BeautifulSoup
from pathlib import Path
from urllib.parse import urljoin
import os

from backend.src.db.connection import connect, load_db_config
from backend.src.db.dao.assets import list_assets
from backend.src.db.dao.indicators import list_indicators
from backend.src.db.dao.signatures import list_matches
from backend.src.db.dao.yara_matches import list_yara_matches
from backend.src.db.dao.targets import get_target
from backend.src.core.settings import get_setting_value
from backend.src.core.whois import rdap_domain, rdap_ip
from backend.src.security.favicon import fetch_favicon_bytes
import requests
from backend.src.utils.api import ok

router = APIRouter(prefix="/api/lab", tags=["lab"])


@router.get("/{target_id}")
def get_lab(target_id: int):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        target = get_target(conn, target_id)
        assets = list_assets(conn, target_id) if target else []
        indicators = list_indicators(conn, target_id) if target else []
        matches = list_matches(conn, target_id) if target else []
        yara = list_yara_matches(conn, target_id) if target else []
        return ok({"target": target, "assets": assets, "indicators": indicators, "matches": matches, "yara": yara})
    finally:
        conn.close()


@router.get("/{target_id}/screenshot")
def get_screenshot(target_id: int):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        target = get_target(conn, target_id)
        if not target:
            raise HTTPException(status_code=404, detail="screenshot_not_found")
        path = None
        if target.get("screenshot_path"):
            path = Path(target["screenshot_path"])
        if not path or not path.exists():
            base = Path(os.getenv("STORAGE_DIR", "storage")) / "screenshots"
            fallback = base / f"target_{target_id}.png"
            if fallback.exists():
                path = fallback
        if not path or not path.exists():
            raise HTTPException(status_code=404, detail="screenshot_missing")
        return FileResponse(path)
    finally:
        conn.close()


@router.get("/{target_id}/dom")
def get_dom(target_id: int):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        target = get_target(conn, target_id)
        if not target:
            raise HTTPException(status_code=404, detail="dom_not_found")
        path = None
        if target.get("html_path"):
            path = Path(target["html_path"])
        if not path or not path.exists():
            base = Path(os.getenv("STORAGE_DIR", "storage")) / "html"
            fallback = base / f"{target_id}.html"
            if fallback.exists():
                path = fallback
        if not path or not path.exists():
            raise HTTPException(status_code=404, detail="dom_missing")
        return FileResponse(path, media_type="text/html")
    finally:
        conn.close()


@router.get("/{target_id}/favicon")
def get_favicon(target_id: int):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        enabled = get_setting_value(conn, "REMOTE_FAVICON_ENABLED", "0") == "1"
        if not enabled:
            raise HTTPException(status_code=403, detail="remote_favicon_disabled")
        target = get_target(conn, target_id)
        if not target or not target.get("url"):
            raise HTTPException(status_code=404, detail="target_not_found")
        candidates: list[str] = []
        html_path = target.get("html_path")
        if html_path and Path(html_path).exists():
            try:
                html = Path(html_path).read_text(encoding="utf-8", errors="ignore")
                soup = BeautifulSoup(html, "html.parser")
                icon = soup.find("link", rel=lambda x: x and "icon" in x)
                if icon and icon.get("href"):
                    candidates.append(urljoin(target["url"], icon.get("href")))
            except Exception:
                pass
        if not candidates:
            try:
                resp = requests.get(target["url"], timeout=5, headers={"User-Agent": "ScamHunter/1.0"})
                html = resp.text
                soup = BeautifulSoup(html, "html.parser")
                icon = soup.find("link", rel=lambda x: x and "icon" in x)
                if icon and icon.get("href"):
                    candidates.append(urljoin(target["url"], icon.get("href")))
            except Exception:
                pass
        candidates.append(urljoin(target["url"], "/favicon.ico"))
        for fav_url in candidates:
            raw, ctype, err = fetch_favicon_bytes(fav_url)
            if not err and raw is not None:
                return Response(content=raw, media_type=ctype or "image/x-icon")
        raise HTTPException(status_code=404, detail="favicon_not_found")
    finally:
        conn.close()


@router.get("/{target_id}/whois")
def get_whois(target_id: int):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        target = get_target(conn, target_id)
        if not target:
            return ok({"domain": None, "ip": None, "rdap_domain": None, "rdap_ip": None})
        domain = target.get("domain")
        ip = target.get("ip")
        rdap_d, err_d = (None, None)
        rdap_i, err_i = (None, None)
        warnings = []
        if domain:
            rdap_d, err_d = rdap_domain(domain)
            if err_d:
                warnings.append(err_d)
        if ip:
            rdap_i, err_i = rdap_ip(ip)
            if err_i:
                warnings.append(err_i)
        warning = "; ".join(warnings) if warnings else None
        return ok({"domain": domain, "ip": ip, "rdap_domain": rdap_d, "rdap_ip": rdap_i, "warning": warning})
    finally:
        conn.close()
