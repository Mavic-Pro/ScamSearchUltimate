from backend.src.utils.time import utcnow


def create_target(conn, url: str, domain: str, status: str = "QUEUED") -> int:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO targets (url, domain, status, created_at, updated_at) VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (url, domain, status, utcnow(), utcnow()),
        )
        target_id = cur.fetchone()["id"]
        conn.commit()
        return target_id


def update_target(conn, target_id: int, **fields):
    if not fields:
        return
    columns = ", ".join([f"{k}=%s" for k in fields.keys()])
    values = list(fields.values())
    values.append(utcnow())
    values.append(target_id)
    with conn.cursor() as cur:
        cur.execute(
            f"UPDATE targets SET {columns}, updated_at=%s WHERE id=%s",
            values,
        )
        conn.commit()


def list_targets(conn, limit: int = 100):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM targets ORDER BY id DESC LIMIT %s", (limit,))
        return cur.fetchall() or []


def get_target(conn, target_id: int):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM targets WHERE id=%s", (target_id,))
        return cur.fetchone()


def find_targets_by_field(conn, field: str, value: str):
    if field not in {"ip", "jarm", "favicon_hash", "screenshot_ahash", "screenshot_phash", "screenshot_dhash"}:
        return []
    with conn.cursor() as cur:
        cur.execute(f"SELECT * FROM targets WHERE {field}=%s ORDER BY id DESC LIMIT 200", (value,))
        return cur.fetchall() or []


def resolve_target(conn, field: str, value: str):
    if field not in {"url", "domain"}:
        return None
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT * FROM targets WHERE {field}=%s ORDER BY id DESC LIMIT 1",
            (value,),
        )
        return cur.fetchone()
