from backend.src.utils.time import utcnow


def insert_asset(conn, target_id: int, url: str, asset_type: str, status: str, md5: str | None = None, sha256: str | None = None, phash: str | None = None, ahash: str | None = None) -> int | None:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO assets (target_id, url, type, md5, sha256, phash, ahash, status, created_at) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (target_id, url, asset_type, md5, sha256, phash, ahash, status, utcnow()),
        )
        asset_id = cur.fetchone()["id"]
        conn.commit()
        return asset_id


def list_assets(conn, target_id: int):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM assets WHERE target_id=%s ORDER BY id DESC", (target_id,))
        return cur.fetchall() or []


def find_assets_by_hash(conn, value: str):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT * FROM assets WHERE md5=%s OR sha256=%s ORDER BY id DESC LIMIT 200",
            (value, value),
        )
        return cur.fetchall() or []
