from __future__ import annotations

from psycopg2.extras import Json

from backend.src.utils.time import utcnow


def list_automations(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM automations ORDER BY id DESC")
        return cur.fetchall() or []


def get_automation(conn, automation_id: int):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM automations WHERE id=%s", (automation_id,))
        return cur.fetchone()


def insert_automation(conn, payload: dict) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO automations (name, enabled, trigger_type, trigger_config, graph, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                payload["name"],
                payload.get("enabled", True),
                payload.get("trigger_type", "manual"),
                Json(payload.get("trigger_config") or {}),
                Json(payload.get("graph") or {}),
                utcnow(),
                utcnow(),
            ),
        )
        automation_id = cur.fetchone()["id"]
        conn.commit()
        return automation_id


def update_automation(conn, automation_id: int, payload: dict) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE automations
            SET name=%s,
                enabled=%s,
                trigger_type=%s,
                trigger_config=%s,
                graph=%s,
                updated_at=%s
            WHERE id=%s
            """,
            (
                payload["name"],
                payload.get("enabled", True),
                payload.get("trigger_type", "manual"),
                Json(payload.get("trigger_config") or {}),
                Json(payload.get("graph") or {}),
                utcnow(),
                automation_id,
            ),
        )
        conn.commit()


def delete_automation(conn, automation_id: int) -> None:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM automations WHERE id=%s", (automation_id,))
        conn.commit()


def update_automation_last_run(conn, automation_id: int) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE automations SET last_run_at=%s, updated_at=%s WHERE id=%s",
            (utcnow(), utcnow(), automation_id),
        )
        conn.commit()
