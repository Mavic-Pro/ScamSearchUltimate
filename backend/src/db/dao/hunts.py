from backend.src.utils.time import utcnow


def create_hunt(conn, name: str, rule_type: str, rule: str, ttl_seconds: int, delay_seconds: int, budget: int, enabled: bool):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO hunts (name, rule_type, rule, ttl_seconds, delay_seconds, budget, enabled, created_at) VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (name, rule_type, rule, ttl_seconds, delay_seconds, budget, enabled, utcnow()),
        )
        hunt_id = cur.fetchone()["id"]
        conn.commit()
        return hunt_id


def list_hunts(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM hunts ORDER BY id DESC")
        return cur.fetchall() or []


def get_hunt(conn, hunt_id: int):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM hunts WHERE id=%s", (hunt_id,))
        return cur.fetchone()


def list_enabled_hunts(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM hunts WHERE enabled=true ORDER BY id ASC")
        return cur.fetchall() or []


def update_hunt_last_run(conn, hunt_id: int):
    with conn.cursor() as cur:
        cur.execute("UPDATE hunts SET last_run_at=%s WHERE id=%s", (utcnow(), hunt_id))
        conn.commit()
