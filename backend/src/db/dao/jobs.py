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


def get_job_status(conn, job_id: int) -> str | None:
    with conn.cursor() as cur:
        cur.execute("SELECT status FROM jobs WHERE id=%s", (job_id,))
        row = cur.fetchone()
        return row["status"] if row else None


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


def requeue_job(conn, job_id: int):
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE jobs SET status='QUEUED', lease_until=NULL, last_error=NULL, updated_at=%s WHERE id=%s",
            (utcnow(), job_id),
        )
        conn.commit()


def delete_job(conn, job_id: int):
    with conn.cursor() as cur:
        cur.execute("DELETE FROM jobs WHERE id=%s", (job_id,))
        conn.commit()


def delete_jobs_by_url(conn, url: str):
    with conn.cursor() as cur:
        cur.execute("DELETE FROM jobs WHERE payload->>'url'=%s", (url,))
        conn.commit()


def requeue_stuck(conn):
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE jobs SET status='QUEUED', lease_until=NULL WHERE status='RUNNING' AND lease_until < %s",
            (utcnow(),),
        )
        conn.commit()
