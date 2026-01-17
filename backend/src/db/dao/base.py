from typing import Any, Iterable, List, Optional


def execute(cur, sql: str, params: Optional[Iterable[Any]] = None) -> None:
    cur.execute(sql, params or ())


def fetchall(cur, sql: str, params: Optional[Iterable[Any]] = None) -> List[dict]:
    cur.execute(sql, params or ())
    rows = cur.fetchall()
    return rows or []


def fetchone(cur, sql: str, params: Optional[Iterable[Any]] = None) -> Optional[dict]:
    cur.execute(sql, params or ())
    return cur.fetchone()
