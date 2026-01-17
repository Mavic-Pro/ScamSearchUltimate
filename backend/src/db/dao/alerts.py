from backend.src.utils.time import utcnow


def create_alert(conn, target_id: int, kind: str, message: str):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO alerts (target_id, kind, message, created_at) VALUES (%s, %s, %s, %s)",
            (target_id, kind, message, utcnow()),
        )
        conn.commit()


def list_alerts(conn, limit: int = 100):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT a.*, t.url, t.domain FROM alerts a "
            "LEFT JOIN targets t ON a.target_id=t.id "
            "ORDER BY a.id DESC LIMIT %s",
            (limit,),
        )
        return cur.fetchall() or []
