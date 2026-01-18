from __future__ import annotations

from psycopg2.extras import Json

from backend.src.utils.time import utcnow


def create_automation_run(conn, automation_id: int, status: str, context: dict | None, log: dict | None, reason: str | None = None) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO automation_runs (automation_id, status, reason, context, log, started_at, finished_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                automation_id,
                status,
                reason,
                Json(context or {}),
                Json(log or {}),
                utcnow(),
                utcnow() if status in {"DONE", "FAILED"} else None,
            ),
        )
        run_id = cur.fetchone()["id"]
        conn.commit()
        return run_id


def update_automation_run(conn, run_id: int, status: str, log: dict | None = None, reason: str | None = None) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE automation_runs
            SET status=%s,
                reason=%s,
                log=%s,
                finished_at=%s
            WHERE id=%s
            """,
            (status, reason, Json(log or {}), utcnow(), run_id),
        )
        conn.commit()


def list_automation_runs(conn, automation_id: int, limit: int = 50):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT * FROM automation_runs WHERE automation_id=%s ORDER BY id DESC LIMIT %s",
            (automation_id, limit),
        )
        return cur.fetchall() or []
