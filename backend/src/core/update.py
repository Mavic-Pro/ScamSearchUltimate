import os
import subprocess
import threading
import time
from typing import Dict, Optional, Tuple

import requests


def _run_git(args: list[str]) -> Tuple[bool, str]:
    try:
        out = subprocess.check_output(["git", *args], stderr=subprocess.STDOUT).decode("utf-8", errors="ignore")
        return True, out.strip()
    except Exception as exc:
        return False, str(exc)


def _repo_dirty() -> bool:
    ok, out = _run_git(["status", "--porcelain"])
    if not ok:
        return False
    return bool(out.strip())


def get_local_version() -> str:
    env_version = os.getenv("APP_VERSION")
    if env_version:
        return env_version
    ok, out = _run_git(["rev-parse", "--short", "HEAD"])
    return out if ok else "unknown"


def _github_latest_release(repo: str) -> Optional[Dict[str, str]]:
    url = f"https://api.github.com/repos/{repo}/releases/latest"
    try:
        resp = requests.get(url, timeout=8)
        data = resp.json()
        tag = data.get("tag_name")
        if tag:
            return {"version": tag, "url": data.get("html_url", "")}
    except Exception:
        return None
    return None


def _github_latest_commit(repo: str, branch: str) -> Optional[Dict[str, str]]:
    url = f"https://api.github.com/repos/{repo}/commits/{branch}"
    try:
        resp = requests.get(url, timeout=8)
        data = resp.json()
        sha = data.get("sha")
        if sha:
            return {"version": sha[:7], "url": data.get("html_url", "")}
    except Exception:
        return None
    return None


def check_update() -> Dict[str, object]:
    repo = os.getenv("GITHUB_REPO", "").strip()
    branch = os.getenv("GITHUB_BRANCH", "main")
    if not repo:
        return {"ok": False, "error": "GITHUB_REPO non configurato"}

    local = get_local_version()
    latest = _github_latest_release(repo) or _github_latest_commit(repo, branch)
    if not latest:
        return {"ok": False, "error": "Impossibile contattare GitHub"}

    return {
        "ok": True,
        "local_version": local,
        "latest_version": latest.get("version"),
        "latest_url": latest.get("url"),
        "dirty": _repo_dirty(),
        "update_available": local != latest.get("version"),
    }


def run_update() -> Dict[str, object]:
    if _repo_dirty():
        return {"ok": False, "error": "Repo con modifiche locali. Auto-update disabilitato."}
    ok, out = _run_git(["fetch", "--all"])
    if not ok:
        return {"ok": False, "error": out}
    ok, out = _run_git(["pull", "--ff-only"])
    if not ok:
        return {"ok": False, "error": out}
    restart_cmd = os.getenv("APP_UPDATE_RESTART_COMMAND", "").strip()
    if restart_cmd:
        try:
            subprocess.Popen(restart_cmd, shell=True)
        except Exception as exc:
            return {"ok": True, "message": f"Aggiornato. Riavvio non riuscito: {exc}"}
    return {"ok": True, "message": "Aggiornato. Riavvia il servizio per applicare le modifiche."}


def _auto_update_loop(interval_seconds: int) -> None:
    while True:
        try:
            status = check_update()
            if status.get("ok") and status.get("update_available"):
                run_update()
        except Exception:
            pass
        time.sleep(max(30, interval_seconds))


def start_auto_update_if_enabled() -> None:
    enabled = os.getenv("AUTO_UPDATE_ENABLED", "0") == "1"
    if not enabled:
        return
    interval = int(os.getenv("AUTO_UPDATE_INTERVAL_SECONDS", "3600"))
    thread = threading.Thread(target=_auto_update_loop, args=(interval,), daemon=True)
    thread.start()
