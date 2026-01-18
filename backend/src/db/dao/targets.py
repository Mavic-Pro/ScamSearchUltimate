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


def filter_new_urls(conn, urls: list[str]) -> list[str]:
    if not urls:
        return []
    with conn.cursor() as cur:
        cur.execute("SELECT url FROM targets WHERE url = ANY(%s)", (urls,))
        existing = {row["url"] for row in (cur.fetchall() or [])}
    return [url for url in urls if url not in existing]


def delete_target_and_related(conn, target_id: int):
    with conn.cursor() as cur:
        cur.execute("DELETE FROM assets WHERE target_id=%s", (target_id,))
        cur.execute("DELETE FROM indicators WHERE target_id=%s", (target_id,))
        cur.execute("DELETE FROM signature_matches WHERE target_id=%s", (target_id,))
        cur.execute("DELETE FROM yara_matches WHERE target_id=%s", (target_id,))
        cur.execute("DELETE FROM alerts WHERE target_id=%s", (target_id,))
        cur.execute("DELETE FROM campaign_members WHERE target_id=%s", (target_id,))
        cur.execute("DELETE FROM urlscan_local WHERE target_id=%s", (target_id,))
        cur.execute("DELETE FROM iocs WHERE target_id=%s", (target_id,))
        cur.execute("DELETE FROM targets WHERE id=%s", (target_id,))
        cur.execute("DELETE FROM campaigns WHERE id NOT IN (SELECT campaign_id FROM campaign_members)")
        conn.commit()
