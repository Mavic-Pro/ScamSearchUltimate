from backend.src.utils.time import utcnow


def insert_yara_match(
    conn,
    target_id: int,
    rule_id: int,
    asset_id: int | None = None,
    verified: bool | None = None,
    confidence: int | None = None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO yara_matches (target_id, asset_id, rule_id, verified, confidence, created_at) VALUES (%s, %s, %s, %s, %s, %s)",
            (target_id, asset_id, rule_id, verified, confidence, utcnow()),
        )
        conn.commit()


def list_yara_matches(conn, target_id: int):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT m.*, r.name, r.target_field FROM yara_matches m "
            "LEFT JOIN yara_rules r ON m.rule_id=r.id "
            "WHERE m.target_id=%s ORDER BY m.id DESC",
            (target_id,),
        )
        return cur.fetchall() or []
