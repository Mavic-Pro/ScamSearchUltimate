import time

from backend.src.core.scan_minimal import run_minimal_scan_job
from backend.src.db.connection import connect, load_db_config
from backend.src.db.dao.jobs import lease_next_job, requeue_stuck, update_job_status
from backend.src.utils.logging import log_error, log_info


JOB_HANDLERS = {
    "scan": run_minimal_scan_job,
}


def run_worker(poll_seconds: int = 2, lease_seconds: int = 30) -> None:
    cfg = load_db_config()
    while True:
        conn = connect(cfg)
        try:
            requeue_stuck(conn)
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
