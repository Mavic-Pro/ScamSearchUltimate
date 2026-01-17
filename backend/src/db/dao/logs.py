from backend.src.utils.time import utcnow


def insert_log(conn, level: str, message: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO logs (level, message, created_at) VALUES (%s, %s, %s)",
            (level, message[:2000], utcnow()),
        )
        conn.commit()


def tail_logs(conn, limit: int = 100):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT * FROM logs ORDER BY id DESC LIMIT %s",
            (limit,),
        )
        rows = cur.fetchall()
        return list(reversed(rows or []))
