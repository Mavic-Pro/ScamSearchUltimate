from backend.src.utils.time import utcnow


def create_signature(conn, name: str, pattern: str, target_field: str, enabled: bool = True):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO signatures (name, pattern, target_field, enabled, created_at) VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (name, pattern, target_field, enabled, utcnow()),
        )
        sig_id = cur.fetchone()["id"]
        conn.commit()
        return sig_id


def list_signatures(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM signatures ORDER BY id DESC")
        return cur.fetchall() or []


def insert_match(conn, target_id: int, signature_id: int):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO signature_matches (target_id, signature_id, created_at) VALUES (%s, %s, %s)",
            (target_id, signature_id, utcnow()),
        )
        conn.commit()


def list_matches(conn, target_id: int):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT m.*, s.name, s.pattern FROM signature_matches m JOIN signatures s ON m.signature_id = s.id WHERE m.target_id=%s",
            (target_id,),
        )
        return cur.fetchall() or []


def count_matches(conn, target_id: int) -> int:
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) as cnt FROM signature_matches WHERE target_id=%s", (target_id,))
        row = cur.fetchone()
        return int(row["cnt"]) if row else 0
