from backend.src.utils.time import utcnow


def get_remote_redirects(conn, url: str):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT * FROM urlscan_remote WHERE url=%s ORDER BY id DESC LIMIT 1",
            (url,),
        )
        return cur.fetchone()


def upsert_remote_redirects(conn, url: str, redirect_chain: str | None, result_url: str | None):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO urlscan_remote (url, redirect_chain, result_url, created_at) VALUES (%s, %s, %s, %s)",
            (url, redirect_chain, result_url, utcnow()),
        )
        conn.commit()
