from backend.src.utils.time import utcnow


def insert_indicator(conn, target_id: int, kind: str, value: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO indicators (target_id, kind, value, created_at) VALUES (%s, %s, %s, %s)",
            (target_id, kind, value, utcnow()),
        )
        conn.commit()


def list_indicators(conn, target_id: int):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM indicators WHERE target_id=%s", (target_id,))
        return cur.fetchall() or []
