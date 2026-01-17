from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import FileResponse
from pathlib import Path
from urllib.parse import urljoin

from backend.src.db.connection import connect, load_db_config
from backend.src.db.dao.assets import list_assets
from backend.src.db.dao.indicators import list_indicators
from backend.src.db.dao.signatures import list_matches
from backend.src.db.dao.yara_matches import list_yara_matches
from backend.src.db.dao.targets import get_target
from backend.src.core.settings import get_setting_value
from backend.src.security.favicon import fetch_favicon_bytes
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
        if not target or not target.get("screenshot_path"):
            raise HTTPException(status_code=404, detail="screenshot_not_found")
        path = Path(target["screenshot_path"])
        if not path.exists():
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
        if not target or not target.get("html_path"):
            raise HTTPException(status_code=404, detail="dom_not_found")
        path = Path(target["html_path"])
        if not path.exists():
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
        fav_url = urljoin(target["url"], "/favicon.ico")
        raw, ctype, err = fetch_favicon_bytes(fav_url)
        if err or raw is None:
            raise HTTPException(status_code=404, detail=err or "favicon_not_found")
        return Response(content=raw, media_type=ctype or "image/x-icon")
    finally:
        conn.close()
