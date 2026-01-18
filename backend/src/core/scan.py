import hashlib
import json
import os
from pathlib import Path
from typing import Dict, List
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from backend.src.core.ai import ai_configured, suggest_tags, verify_signature_match
from backend.src.core.extractors.indicators import extract_indicators
from backend.src.core.settings import get_setting_value
from backend.src.db.dao.assets import insert_asset
from backend.src.db.dao.campaigns import add_member, create_campaign, get_campaign_by_key
from backend.src.db.dao.graph import create_edge, upsert_node
from backend.src.db.dao.indicators import insert_indicator
from backend.src.db.dao.urlscan_local import insert_local
from backend.src.db.dao.alerts import create_alert
from backend.src.db.dao.alert_rules import list_alert_rules
from backend.src.db.dao.signatures import count_matches, insert_match, list_signatures
from backend.src.db.dao.yara_rules import list_yara_rules
from backend.src.db.dao.yara_matches import insert_yara_match
from backend.src.db.dao.targets import create_target, update_target
from backend.src.db.dao.jobs import create_job
from backend.src.security.safe_fetch import hash_bytes, safe_fetch_asset, safe_fetch_html
from backend.src.security.screenshot import capture_screenshot
from backend.src.security.dns import resolve_ip
from backend.src.security.favicon import favicon_hash_from_data_uri, favicon_hash_from_url
from backend.src.security.jarm import calculate_jarm
from backend.src.utils.logging import log_info
from backend.src.core.yara_rules import match_yara


def _normalize_domain(url: str) -> str:
    parsed = urlparse(url)
    return parsed.netloc.lower()


def _hash_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8", errors="ignore")).hexdigest()


def _headers_hash(headers: Dict[str, str]) -> str:
    items = sorted([f"{k.lower()}={v}" for k, v in headers.items()])
    return _hash_text("\n".join(items))


def _extract_title(html: str) -> str | None:
    try:
        soup = BeautifulSoup(html, "html.parser")
        title = soup.title.string if soup.title else None
        if title:
            return title.strip()[:200]
    except Exception:
        return None
    return None


def scan_url(conn, url: str) -> Dict[str, object]:
    domain = _normalize_domain(url)
    target_id = create_target(conn, url=url, domain=domain, status="RUNNING")

    fetch = safe_fetch_html(url)
    if not fetch.ok:
        _capture_screenshot(conn, target_id, url)
        update_target(
            conn,
            target_id,
            status=fetch.status,
            reason=fetch.reason,
            redirect_chain=json.dumps(fetch.redirect_chain, ensure_ascii=True) if fetch.redirect_chain else None,
        )
        return {"id": target_id, "status": fetch.status, "reason": fetch.reason}

    html = fetch.content.decode("utf-8", errors="ignore")
    title = _extract_title(html)
    dom_hash = _hash_text(html)
    headers_hash = _headers_hash(fetch.headers)
    ip = resolve_ip(domain)
    jarm = calculate_jarm(domain)
    favicon_hash, _favicon_phash = _extract_favicon_hash(conn, html, url)

    header_text = "\n".join([f"{k}:{v}" for k, v in fetch.headers.items()])[:20000]
    html_excerpt = html[:20000]
    html_path = _save_full_html(target_id, html)
    update_target(
        conn,
        target_id,
        status="DONE",
        redirect_chain=json.dumps(fetch.redirect_chain, ensure_ascii=True) if fetch.redirect_chain else None,
        dom_hash=dom_hash,
        headers_hash=headers_hash,
        headers_text=header_text,
        html_excerpt=html_excerpt,
        html_path=html_path,
        ip=ip,
        favicon_hash=favicon_hash,
        jarm=jarm,
        reason=None,
    )
    tags = suggest_tags(conn, {"url": url, "domain": domain, "title": title}, html_excerpt, header_text)
    if tags:
        update_target(conn, target_id, tags=", ".join(tags))

    insert_local(
        conn,
        target_id,
        url,
        domain,
        ip,
        title,
        "DONE",
        fetch.headers.get("Content-Type"),
        json.dumps(fetch.redirect_chain, ensure_ascii=True) if fetch.redirect_chain else None,
        dom_hash,
        headers_hash,
        favicon_hash,
        jarm,
    )

    indicators = _extract_and_store_indicators(conn, target_id, html)
    signatures = list_signatures(conn)
    yara_rules = list_yara_rules(conn)
    asset_hashes = _process_assets(conn, target_id, html, url, signatures, yara_rules)
    _apply_signatures(conn, target_id, html, fetch.headers, url, signatures)
    _apply_alert_rules(conn, target_id, html, fetch.headers, url)
    _apply_yara_html(conn, target_id, html, yara_rules)
    screenshot = _capture_screenshot(conn, target_id, url)
    _update_risk_and_alerts(conn, target_id)
    _materialize_graph(
        conn,
        domain,
        url,
        dom_hash,
        ip,
        jarm,
        favicon_hash,
        indicators,
        asset_hashes,
        screenshot,
    )
    _assign_campaign(conn, target_id, dom_hash)
    _assign_campaigns_extra(conn, target_id, favicon_hash, jarm, screenshot)
    risk_score = count_matches(conn, target_id) * 20
    _emit_automation_event(
        conn,
        {
            "event": "scan_done",
            "target_id": target_id,
            "url": url,
            "domain": domain,
            "ip": ip,
            "risk_score": risk_score,
            "indicators": indicators,
        },
    )

    log_info(f"scan complete target={target_id} url={url}")
    return {"id": target_id, "status": "DONE"}


def _extract_and_store_indicators(conn, target_id: int, html: str) -> list[tuple[str, str]]:
    indicators = extract_indicators(html)
    out: list[tuple[str, str]] = []
    for kind, values in indicators.items():
        for value in values:
            insert_indicator(conn, target_id, kind, value)
            out.append((kind, value))
    return out


def _process_assets(conn, target_id: int, html: str, base_url: str, signatures: List[dict], yara_rules: List[dict]) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    assets: List[tuple[str, str]] = []
    hashes: list[str] = []
    for script in soup.find_all("script"):
        src = script.get("src")
        if src:
            assets.append(("js", src))
    for link in soup.find_all("link"):
        if link.get("rel") and "stylesheet" in link.get("rel"):
            href = link.get("href")
            if href:
                assets.append(("css", href))

    seen = set()
    for asset_type, raw_url in assets:
        asset_url = urljoin(base_url, raw_url)
        if asset_url in seen:
            continue
        seen.add(asset_url)
        if len(seen) > 40:
            break
        status, content, _reason = safe_fetch_asset(asset_url)
        if status != "DONE" or content is None:
            insert_asset(conn, target_id, asset_url, asset_type, status)
            continue
        md5, sha256 = hash_bytes(content)
        asset_id = insert_asset(conn, target_id, asset_url, asset_type, "DONE", md5=md5, sha256=sha256)
        hashes.append(md5)
        hashes.append(sha256)
        _apply_asset_signatures(conn, target_id, content, signatures)
        if asset_id:
            _apply_yara_asset(conn, target_id, asset_id, content, yara_rules)
    return hashes


def _apply_signatures(conn, target_id: int, html: str, headers: Dict[str, str], url: str, signatures: List[dict]) -> None:
    header_text = "\n".join([f"{k}:{v}" for k, v in headers.items()])
    for sig in signatures:
        if not sig["enabled"]:
            continue
        pattern = sig["pattern"]
        target_field = sig["target_field"]
        haystack = ""
        if target_field == "html":
            haystack = html
        elif target_field == "headers":
            haystack = header_text
        elif target_field == "url":
            haystack = url
        if not haystack:
            continue
        matched, snippet = _regex_search(pattern, haystack)
        if not matched:
            continue
        verified_flag: bool | None = None
        confidence: int | None = 40
        if _should_verify_signature(sig.get("name", "")) and ai_configured(conn):
            verified, _reason = verify_signature_match(
                conn,
                sig.get("name", "signature"),
                target_field,
                pattern,
                snippet or "",
            )
            if verified is False:
                continue
            verified_flag = True
            confidence = 90
        insert_match(conn, target_id, sig["id"], verified_flag, confidence)


def _apply_asset_signatures(conn, target_id: int, content: bytes, signatures: List[dict]) -> None:
    text = content.decode("utf-8", errors="ignore")
    for sig in signatures:
        if not sig["enabled"] or sig["target_field"] != "asset":
            continue
        matched, snippet = _regex_search(sig["pattern"], text)
        if not matched:
            continue
        verified_flag: bool | None = None
        confidence: int | None = 40
        if _should_verify_signature(sig.get("name", "")) and ai_configured(conn):
            verified, _reason = verify_signature_match(
                conn,
                sig.get("name", "signature"),
                "asset",
                sig["pattern"],
                snippet or "",
            )
            if verified is False:
                continue
            verified_flag = True
            confidence = 90
        insert_match(conn, target_id, sig["id"], verified_flag, confidence)


def _apply_alert_rules(conn, target_id: int, html: str, headers: Dict[str, str], url: str) -> None:
    rules = list_alert_rules(conn)
    if not rules:
        return
    header_text = "\n".join([f"{k}:{v}" for k, v in headers.items()])
    for rule in rules:
        if not rule.get("enabled"):
            continue
        target_field = rule.get("target_field")
        pattern = rule.get("pattern") or ""
        haystack = ""
        if target_field == "html":
            haystack = html
        elif target_field == "headers":
            haystack = header_text
        elif target_field == "url":
            haystack = url
        matched, _snippet = _regex_search(pattern, haystack)
        if matched:
            create_alert(conn, target_id, "rule", f"{rule.get('name')} matched")

def _regex_search(pattern: str, text: str) -> tuple[bool, str | None]:
    try:
        import re

        match = re.search(pattern, text, re.IGNORECASE)
        if not match:
            return False, None
        start = max(match.start() - 120, 0)
        end = min(match.end() + 120, len(text))
        return True, text[start:end]
    except Exception:
        return False, None


def _should_verify_signature(name: str) -> bool:
    if not name:
        return False
    lowered = name.lower()
    return "private key" in lowered or "pgp" in lowered or "address" in lowered or "wallet" in lowered


def _apply_yara_html(conn, target_id: int, html: str, yara_rules: List[dict]) -> None:
    if not yara_rules:
        return
    matches = match_yara(html.encode("utf-8", errors="ignore"), yara_rules, "html")
    for rule_id in matches:
        insert_yara_match(conn, target_id, rule_id, None, True, 70)


def _apply_yara_asset(conn, target_id: int, asset_id: int, content: bytes, yara_rules: List[dict]) -> None:
    if not yara_rules:
        return
    matches = match_yara(content, yara_rules, "asset")
    for rule_id in matches:
        insert_yara_match(conn, target_id, rule_id, asset_id, True, 70)


def _materialize_graph(
    conn,
    domain: str,
    url: str,
    dom_hash: str,
    ip: str | None,
    jarm: str | None,
    favicon_hash: str | None,
    indicators: list[tuple[str, str]],
    asset_hashes: list[str],
    screenshot,
) -> None:
    domain_node = upsert_node(conn, "domain", domain)
    url_node = upsert_node(conn, "url", url)
    dom_node = upsert_node(conn, "dom_hash", dom_hash)
    create_edge(conn, domain_node, url_node, "hosts")
    create_edge(conn, url_node, dom_node, "hash")
    if ip:
        ip_node = upsert_node(conn, "ip", ip)
        create_edge(conn, domain_node, ip_node, "resolves_to")
    if jarm:
        jarm_node = upsert_node(conn, "jarm", jarm)
        create_edge(conn, domain_node, jarm_node, "fingerprint")
    if favicon_hash:
        fav_node = upsert_node(conn, "favicon_hash", favicon_hash)
        create_edge(conn, domain_node, fav_node, "favicon")
    for kind, value in indicators:
        node = upsert_node(conn, kind, value)
        create_edge(conn, url_node, node, "indicator")
    for h in asset_hashes:
        node = upsert_node(conn, "asset_hash", h)
        create_edge(conn, url_node, node, "asset")
    if screenshot and screenshot.phash:
        node = upsert_node(conn, "screenshot_phash", screenshot.phash)
        create_edge(conn, url_node, node, "screenshot")


def _assign_campaign(conn, target_id: int, dom_hash: str) -> None:
    key = f"dom:{dom_hash}"
    existing = get_campaign_by_key(conn, key)
    if existing:
        add_member(conn, existing["id"], target_id)
        return
    campaign_id = create_campaign(conn, key)
    add_member(conn, campaign_id, target_id)


def _assign_campaigns_extra(
    conn,
    target_id: int,
    favicon_hash: str | None,
    jarm: str | None,
    screenshot,
) -> None:
    keys = []
    if favicon_hash:
        keys.append(f"favicon:{favicon_hash}")
    if jarm:
        keys.append(f"jarm:{jarm}")
    if screenshot and screenshot.phash:
        keys.append(f"screenshot_phash:{screenshot.phash}")
    for key in keys:
        existing = get_campaign_by_key(conn, key)
        if existing:
            add_member(conn, existing["id"], target_id)
            continue
        campaign_id = create_campaign(conn, key)
        add_member(conn, campaign_id, target_id)


def _update_risk_and_alerts(conn, target_id: int) -> None:
    matches = count_matches(conn, target_id)
    risk_score = matches * 20
    if risk_score >= 50:
        create_alert(conn, target_id, "risk", f"Risk score {risk_score} exceeds threshold")
    update_target(conn, target_id, risk_score=risk_score)


def _capture_screenshot(conn, target_id: int, url: str):
    result = capture_screenshot(url, target_id, storage_dir=str(_storage_path("screenshots")))
    update_target(
        conn,
        target_id,
        screenshot_path=result.path,
        screenshot_ahash=result.ahash,
        screenshot_phash=result.phash,
        screenshot_dhash=result.dhash,
        screenshot_status=result.status,
        screenshot_reason=result.reason,
    )
    return result


def _save_full_html(target_id: int, html: str) -> str | None:
    try:
        base = _storage_path("html")
        base.mkdir(parents=True, exist_ok=True)
        path = base / f"{target_id}.html"
        # Limit to 2MB to avoid oversized storage while keeping full DOM for most cases.
        max_len = 2_000_000
        data = html if len(html) <= max_len else html[:max_len]
        path.write_text(data, encoding="utf-8", errors="ignore")
        return str(path)
    except Exception:
        return None


def _storage_path(subdir: str) -> Path:
    base = os.getenv("STORAGE_DIR", "storage")
    return Path(base) / subdir


def _emit_automation_event(conn, payload: dict) -> None:
    indicators = payload.get("indicators") or []
    indicators = [[kind, value] for kind, value in indicators]
    grouped: dict[str, list[str]] = {}
    for kind, value in indicators:
        grouped.setdefault(kind, []).append(value)
    payload["indicator_map"] = grouped
    payload["emails"] = grouped.get("email", [])
    payload["wallets"] = grouped.get("wallet", [])
    payload["phones"] = grouped.get("phone", [])
    create_job(conn, "automation_event", {"event": payload.get("event"), "payload": payload})


def _extract_favicon_hash(conn, html: str, base_url: str) -> tuple[str | None, str | None]:
    try:
        soup = BeautifulSoup(html, "html.parser")
        icon = soup.find("link", rel=lambda x: x and "icon" in x)
        if icon and icon.get("href", "").startswith("data:image"):
            return favicon_hash_from_data_uri(icon.get("href", ""))
        if icon and icon.get("href"):
            enabled = get_setting_value(conn, "REMOTE_FAVICON_ENABLED", "0") == "1"
            if enabled:
                fav_url = urljoin(base_url, icon.get("href"))
                mmh, phash, _err = favicon_hash_from_url(fav_url)
                return mmh, phash
    except Exception:
        return None, None
    return None, None
