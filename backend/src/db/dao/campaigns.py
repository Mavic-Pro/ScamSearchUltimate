from backend.src.utils.time import utcnow


def get_campaign_by_key(conn, key: str):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM campaigns WHERE key=%s", (key,))
        return cur.fetchone()


def create_campaign(conn, key: str) -> int:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO campaigns (key, created_at) VALUES (%s, %s) RETURNING id",
            (key, utcnow()),
        )
        campaign_id = cur.fetchone()["id"]
        conn.commit()
        return campaign_id


def add_member(conn, campaign_id: int, target_id: int) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO campaign_members (campaign_id, target_id) VALUES (%s, %s)",
            (campaign_id, target_id),
        )
        conn.commit()


def list_campaigns(conn):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT c.*, COUNT(m.id) as members, "
            "MAX(t.domain) as sample_domain, MAX(t.url) as sample_url, MAX(t.id) as sample_target_id "
            "FROM campaigns c "
            "LEFT JOIN campaign_members m ON c.id=m.campaign_id "
            "LEFT JOIN targets t ON t.id=m.target_id "
            "GROUP BY c.id ORDER BY c.id DESC"
        )
        return cur.fetchall() or []
