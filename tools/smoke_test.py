#!/usr/bin/env python3
import argparse
import json
import sys
import time
from typing import Any, Dict, Tuple

import requests


def _request(method: str, url: str, **kwargs) -> Tuple[int, Any]:
    resp = requests.request(method, url, timeout=15, **kwargs)
    ctype = resp.headers.get("Content-Type", "")
    if "application/json" in ctype:
        return resp.status_code, resp.json()
    return resp.status_code, resp.text


def _expect_ok(payload: Dict[str, Any], label: str) -> None:
    if not isinstance(payload, dict) or not payload.get("ok"):
        raise AssertionError(f"{label} failed: {payload}")


def _wait_for_job(base_url: str, job_id: int, desired: str = "DONE", timeout_s: int = 30) -> None:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        _, data = _request("GET", f"{base_url}/api/jobs")
        _expect_ok(data, "jobs_list")
        for job in data["data"]:
            if job.get("id") == job_id:
                status = job.get("status")
                if status == desired:
                    return
                if status in {"FAILED", "SKIPPED", "STOPPED"}:
                    raise AssertionError(f"job {job_id} failed: {status} {job.get('last_error')}")
        time.sleep(1)
    raise AssertionError(f"job {job_id} timeout waiting for {desired}")


def main() -> int:
    parser = argparse.ArgumentParser(description="ScamHunter Ultimate smoke tests")
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--frontend-url", default="")
    parser.add_argument("--skip-holehe", action="store_true")
    parser.add_argument("--ui", action="store_true")
    parser.add_argument("--report", default="")
    args = parser.parse_args()

    # Backend health
    status, payload = _request("GET", f"{args.base_url}/")
    assert status == 200, f"root status {status}"

    # Settings health
    status, payload = _request("GET", f"{args.base_url}/api/settings/key-status")
    _expect_ok(payload, "settings_key_status")

    # Automations list
    status, payload = _request("GET", f"{args.base_url}/api/automations")
    _expect_ok(payload, "automations_list")

    # Create automation
    automation = {
        "name": "smoke-test",
        "enabled": True,
        "trigger_type": "manual",
        "trigger_config": {},
        "graph": {
            "nodes": [
                {"id": "start", "type": "start", "label": "Start"},
                {"id": "q1", "type": "queue_scan", "label": "Queue", "config": {"urls": ["https://example.com"], "limit": 1}},
            ],
            "edges": [{"from": "start", "to": "q1", "condition": "always"}],
        },
    }
    status, payload = _request("POST", f"{args.base_url}/api/automations", json=automation)
    _expect_ok(payload, "automations_create")
    automation_id = payload["data"]["id"]

    # Run automation dry-run
    status, payload = _request("POST", f"{args.base_url}/api/automations/{automation_id}/run?dry_run=1", json={})
    _expect_ok(payload, "automation_run")

    # Trigger automation event
    status, payload = _request(
        "POST",
        f"{args.base_url}/api/automations/event",
        json={"event": "scan_done", "payload": {"domain": "example.com", "risk_score": 10}},
    )
    _expect_ok(payload, "automation_event")
    event_job_id = payload["data"]["job_id"]
    _wait_for_job(args.base_url, event_job_id)

    # Spider manual job
    status, payload = _request(
        "POST",
        f"{args.base_url}/api/spider/manual",
        json={"url": "https://example.com", "max_pages": 3, "max_depth": 1, "use_sitemap": False},
    )
    _expect_ok(payload, "spider_manual")
    spider_job_id = payload["data"]["job_id"]
    _wait_for_job(args.base_url, spider_job_id)

    # Pivot: domainsdb
    status, payload = _request("GET", f"{args.base_url}/api/pivot/domainsdb?domain=example.com&limit=5")
    _expect_ok(payload, "pivot_domainsdb")

    # Pivot: crtsh
    status, payload = _request("GET", f"{args.base_url}/api/pivot/crtsh?domain=example.com")
    _expect_ok(payload, "pivot_crtsh")

    # Pivot: blockcypher (unsupported wallet should warn)
    status, payload = _request("GET", f"{args.base_url}/api/pivot/blockcypher?address=invalid")
    _expect_ok(payload, "pivot_blockcypher")

    # Pivot: holehe (optional)
    if not args.skip_holehe:
        status, payload = _request("GET", f"{args.base_url}/api/pivot/holehe?email=test@example.com")
        _expect_ok(payload, "pivot_holehe")

    # Frontend smoke (optional)
    if args.frontend_url:
        status, payload = _request("GET", args.frontend_url)
        if status == 403:
            status, payload = _request("GET", args.frontend_url, headers={"Host": "localhost:5173"})
        if status == 403:
            status, payload = _request("GET", args.frontend_url, headers={"Host": "frontend:5173"})
        assert status == 200, f"frontend status {status}"
    report: Dict[str, Any] = {"checks": [], "ui": {"mode": None, "screenshots": []}}
    def record(name: str, ok: bool, detail: Any = None) -> None:
        report["checks"].append({"name": name, "ok": ok, "detail": detail})

    if args.ui and args.frontend_url:
        try:
            from playwright.sync_api import sync_playwright
        except Exception as exc:
            raise AssertionError(f"playwright_not_available: {exc}")
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch()
                page = browser.new_page()
                response = page.goto(args.frontend_url, wait_until="networkidle", timeout=20000)
                if response and response.status >= 400:
                    raise AssertionError(f"frontend status {response.status}")
                page.wait_for_selector("text=ScamHunter Ultimate", timeout=10000)
                tab_locator = page.locator("text=Automation").first
                if tab_locator.count() == 0:
                    tab_locator = page.locator("text=Automazione").first
                tab_locator.click()
                builder_locator = page.locator("text=Automation Builder").first
                if builder_locator.count() == 0:
                    builder_locator = page.locator("text=Builder Automazioni").first
                builder_locator.wait_for(timeout=10000)
                screenshot_path = "/app/backend/storage/smoke-ui.png"
                page.screenshot(path=screenshot_path, full_page=True)
                report["ui"]["mode"] = "playwright"
                report["ui"]["screenshots"].append(screenshot_path)
                browser.close()
                record("ui_playwright", True)
        except Exception:
            status, html = _request("GET", args.frontend_url, headers={"Host": "localhost:5173"})
            if status >= 400:
                status, html = _request("GET", args.frontend_url, headers={"Host": "frontend:5173"})
            ok = status == 200 and "ScamHunter Ultimate" in str(html)
            if not ok:
                raise AssertionError("frontend_html_check_failed")
            report["ui"]["mode"] = "html"
            record("ui_html", True)

    if args.report:
        try:
            with open(args.report, "w", encoding="utf-8") as handle:
                json.dump(report, handle, indent=2, ensure_ascii=True)
        except Exception as exc:
            print(f"report write failed: {exc}")
    print("smoke tests: OK")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"smoke tests: FAIL ({exc})")
        sys.exit(1)
