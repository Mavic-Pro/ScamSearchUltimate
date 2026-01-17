from typing import List


def search_regex(conn, pattern: str, target_field: str) -> List[dict]:
    with conn.cursor() as cur:
        if target_field == "url":
            cur.execute(
                "SELECT id, url, domain, status FROM targets WHERE url ~* %s OR domain ~* %s LIMIT 200",
                (pattern, pattern),
            )
        elif target_field == "headers":
            cur.execute(
                "SELECT id, url, domain FROM targets WHERE headers_text ~* %s LIMIT 200",
                (pattern,),
            )
        elif target_field == "html":
            cur.execute(
                "SELECT id, url, domain FROM targets WHERE html_excerpt ~* %s LIMIT 200",
                (pattern,),
            )
        elif target_field == "asset":
            cur.execute(
                "SELECT a.id, a.target_id, a.url, a.md5, a.sha256, t.domain, t.url as target_url "
                "FROM assets a LEFT JOIN targets t ON a.target_id=t.id "
                "WHERE a.url ~* %s LIMIT 200",
                (pattern,),
            )
        else:
            return []
        return cur.fetchall() or []
