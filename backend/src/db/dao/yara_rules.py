from backend.src.utils.time import utcnow


def list_yara_rules(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM yara_rules ORDER BY id DESC")
        return cur.fetchall() or []


def create_yara_rule(conn, name: str, rule_text: str, target_field: str, enabled: bool = True) -> int:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO yara_rules (name, rule_text, target_field, enabled, created_at) VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (name, rule_text, target_field, enabled, utcnow()),
        )
        rule_id = cur.fetchone()["id"]
        conn.commit()
        return rule_id
