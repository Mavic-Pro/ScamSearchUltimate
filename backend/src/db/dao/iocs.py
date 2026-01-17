from backend.src.utils.time import utcnow


def create_ioc(
    conn,
    kind: str,
    value: str,
    target_id: int | None = None,
    url: str | None = None,
    domain: str | None = None,
    source: str | None = None,
    note: str | None = None,
) -> int:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO iocs (kind, value, target_id, url, domain, source, note, created_at) VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (kind, value, target_id, url, domain, source, note, utcnow()),
        )
        ioc_id = cur.fetchone()["id"]
        conn.commit()
        return ioc_id


def list_iocs(conn, limit: int = 200):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM iocs ORDER BY id DESC LIMIT %s", (limit,))
        return cur.fetchall() or []


def list_iocs_for_target(conn, target_id: int, limit: int = 200):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT * FROM iocs WHERE target_id=%s ORDER BY id DESC LIMIT %s",
            (target_id, limit),
        )
        return cur.fetchall() or []


def list_iocs_filtered(
    conn,
    kind: str | None,
    value: str | None,
    domain: str | None,
    url: str | None,
    source: str | None,
    target_id: int | None,
    date_from: str | None,
    date_to: str | None,
    limit: int,
):
    clauses = []
    params: list = []
    if kind:
        clauses.append("kind=%s")
        params.append(kind)
    if value:
        clauses.append("value ILIKE %s")
        params.append(f"%{value}%")
    if domain:
        clauses.append("domain ILIKE %s")
        params.append(f"%{domain}%")
    if url:
        clauses.append("url ILIKE %s")
        params.append(f"%{url}%")
    if source:
        clauses.append("source ILIKE %s")
        params.append(f"%{source}%")
    if target_id:
        clauses.append("target_id=%s")
        params.append(target_id)
    if date_from:
        clauses.append("created_at >= %s")
        params.append(date_from)
    if date_to:
        clauses.append("created_at <= %s")
        params.append(date_to)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    params.append(limit)
    with conn.cursor() as cur:
        cur.execute(f"SELECT * FROM iocs {where} ORDER BY id DESC LIMIT %s", params)
        return cur.fetchall() or []
