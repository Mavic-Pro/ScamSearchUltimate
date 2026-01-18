from backend.src.utils.time import utcnow


def create_alert_rule(conn, name: str, pattern: str, target_field: str, enabled: bool = True) -> int:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO alert_rules (name, pattern, target_field, enabled, created_at) VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (name, pattern, target_field, enabled, utcnow()),
        )
        rule_id = cur.fetchone()["id"]
        conn.commit()
        return rule_id


def list_alert_rules(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM alert_rules ORDER BY id DESC")
        return cur.fetchall() or []
