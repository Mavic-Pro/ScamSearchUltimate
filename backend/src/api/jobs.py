from fastapi import APIRouter

from backend.src.db.connection import connect, load_db_config
from backend.src.db.dao.jobs import delete_job, list_jobs, requeue_job, update_job_status
from backend.src.utils.api import ok

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("")
def get_jobs():
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        return ok(list_jobs(conn))
    finally:
        conn.close()


@router.post("/{job_id}/stop")
def stop_job(job_id: int):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        update_job_status(conn, job_id, "STOPPED", "user_stop")
        return ok({"id": job_id, "status": "STOPPED"})
    finally:
        conn.close()


@router.post("/{job_id}/skip")
def skip_job(job_id: int):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        update_job_status(conn, job_id, "SKIPPED", "user_skip")
        return ok({"id": job_id, "status": "SKIPPED"})
    finally:
        conn.close()


@router.post("/{job_id}/requeue")
def requeue(job_id: int):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        requeue_job(conn, job_id)
        return ok({"id": job_id, "status": "QUEUED"})
    finally:
        conn.close()


@router.post("/{job_id}/remove")
def remove(job_id: int):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        delete_job(conn, job_id)
        return ok({"id": job_id, "removed": True})
    finally:
        conn.close()
