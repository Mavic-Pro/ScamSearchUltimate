from backend.src.utils.time import utcnow


def insert_local(
    conn,
    target_id: int,
    url: str,
    domain: str,
    ip: str | None,
    title: str | None,
    status: str,
    content_type: str | None,
    dom_hash: str | None,
    headers_hash: str | None,
    favicon_hash: str | None,
    jarm: str | None,
):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO urlscan_local (target_id, url, domain, ip, title, status, content_type, dom_hash, headers_hash, favicon_hash, jarm, created_at) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
            (target_id, url, domain, ip, title, status, content_type, dom_hash, headers_hash, favicon_hash, jarm, utcnow()),
        )
        conn.commit()

def search_local(
    conn,
    query: str | None,
    domain: str | None,
    dom_hash: str | None,
    headers_hash: str | None,
    ip: str | None,
    jarm: str | None,
    favicon_hash: str | None,
    limit: int = 100,
):
    clauses = []
    params = []
    if query:
        like = f"%{query}%"
        clauses.append("(url ILIKE %s OR domain ILIKE %s OR title ILIKE %s)")
        params.extend([like, like, like])
    if domain:
        clauses.append("domain ILIKE %s")
        params.append(f"%{domain}%")
    if dom_hash:
        clauses.append("dom_hash=%s")
        params.append(dom_hash)
    if headers_hash:
        clauses.append("headers_hash=%s")
        params.append(headers_hash)
    if ip:
        clauses.append("ip=%s")
        params.append(ip)
    if jarm:
        clauses.append("jarm=%s")
        params.append(jarm)
    if favicon_hash:
        clauses.append("favicon_hash=%s")
        params.append(favicon_hash)
    where = " AND ".join(clauses) if clauses else "TRUE"
    params.append(limit)
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT * FROM urlscan_local WHERE {where} ORDER BY id DESC LIMIT %s",
            tuple(params),
        )
        return cur.fetchall() or []
