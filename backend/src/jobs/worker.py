import time

from backend.src.core.scan_minimal import run_minimal_scan_job
from backend.src.core.spider import run_spider_job
from backend.src.core.hunt import run_scheduled_hunts
from backend.src.core.automation import run_automation_event_job, run_automation_job, run_scheduled_automations
from backend.src.db.connection import connect, load_db_config
from backend.src.db.validator import ensure_db_ready
from backend.src.db.dao.jobs import get_job_status, lease_next_job, requeue_stuck, update_job_status
from backend.src.core.settings import get_setting_value
from backend.src.utils.logging import log_error, log_info


JOB_HANDLERS = {
    "scan": run_minimal_scan_job,
    "spider": run_spider_job,
    "automation_run": run_automation_job,
    "automation_event": run_automation_event_job,
}


def run_worker(poll_seconds: int = 2, lease_seconds: int = 30) -> None:
    ensure_db_ready()
    cfg = load_db_config()
    last_hunt_check = 0.0
    last_automation_check = 0.0
    while True:
        conn = connect(cfg)
        try:
            requeue_stuck(conn)
            hunt_enabled = get_setting_value(conn, "HUNT_AUTORUN_ENABLED", "1") == "1"
            hunt_poll_seconds = float(get_setting_value(conn, "HUNT_AUTORUN_POLL_SECONDS", "10") or 10)
            if hunt_enabled and time.time() - last_hunt_check >= hunt_poll_seconds:
                run_scheduled_hunts(conn)
                last_hunt_check = time.time()
            automation_enabled = get_setting_value(conn, "AUTOMATION_AUTORUN_ENABLED", "1") == "1"
            automation_poll_seconds = float(get_setting_value(conn, "AUTOMATION_AUTORUN_POLL_SECONDS", "10") or 10)
            if automation_enabled and time.time() - last_automation_check >= automation_poll_seconds:
                run_scheduled_automations(conn)
                last_automation_check = time.time()
            job = lease_next_job(conn, lease_seconds=lease_seconds)
            if not job:
                time.sleep(poll_seconds)
                continue
            job_type = job["type"]
            handler = JOB_HANDLERS.get(job_type)
            if not handler:
                update_job_status(conn, job["id"], "FAILED", "unknown_job_type")
                continue
            try:
                result = handler(conn, job["id"], job["payload"])
                status = result.get("status", "DONE")
                current = get_job_status(conn, job["id"])
                if current in {"STOPPED", "SKIPPED"}:
                    continue
                update_job_status(conn, job["id"], status)
            except Exception as exc:
                log_error("job failed", str(exc))
                update_job_status(conn, job["id"], "FAILED", str(exc))
        finally:
            conn.close()
        time.sleep(poll_seconds)


if __name__ == "__main__":
    log_info("worker starting")
    run_worker()
