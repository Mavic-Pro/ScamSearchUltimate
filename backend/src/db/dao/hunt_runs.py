from backend.src.utils.time import utcnow


def create_hunt_run(conn, hunt_id: int, trigger: str, queued: int, warning: str | None = None) -> int:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO hunt_runs (hunt_id, trigger, queued, warning, created_at) VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (hunt_id, trigger, queued, warning, utcnow()),
        )
        run_id = cur.fetchone()["id"]
        conn.commit()
        return run_id


def list_hunt_runs(conn, limit: int = 50):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT r.*, h.name FROM hunt_runs r LEFT JOIN hunts h ON r.hunt_id=h.id ORDER BY r.id DESC LIMIT %s",
            (limit,),
        )
        return cur.fetchall() or []
