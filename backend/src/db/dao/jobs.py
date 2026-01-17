from datetime import timedelta

from psycopg2.extras import Json

from backend.src.utils.time import utcnow


def create_job(conn, job_type: str, payload: dict) -> int:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO jobs (type, status, payload, created_at, updated_at) VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (job_type, "QUEUED", Json(payload), utcnow(), utcnow()),
        )
        job_id = cur.fetchone()["id"]
        conn.commit()
        return job_id


def list_jobs(conn, limit: int = 100):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM jobs ORDER BY id DESC LIMIT %s", (limit,))
        return cur.fetchall() or []


def lease_next_job(conn, lease_seconds: int = 30):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT * FROM jobs WHERE status IN ('QUEUED', 'RUNNING') AND (lease_until IS NULL OR lease_until < %s) ORDER BY id ASC LIMIT 1",
            (utcnow(),),
        )
        job = cur.fetchone()
        if not job:
            return None
        cur.execute(
            "UPDATE jobs SET status='RUNNING', lease_until=%s, attempts=attempts+1, updated_at=%s WHERE id=%s",
            (utcnow() + timedelta(seconds=lease_seconds), utcnow(), job["id"]),
        )
        conn.commit()
        return job


def update_job_status(conn, job_id: int, status: str, last_error: str | None = None):
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE jobs SET status=%s, last_error=%s, updated_at=%s WHERE id=%s",
            (status, last_error, utcnow(), job_id),
        )
        conn.commit()


def requeue_stuck(conn):
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE jobs SET status='QUEUED', lease_until=NULL WHERE status='RUNNING' AND lease_until < %s",
            (utcnow(),),
        )
        conn.commit()
