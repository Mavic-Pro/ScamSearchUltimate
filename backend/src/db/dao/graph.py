from backend.src.utils.time import utcnow


def upsert_node(conn, kind: str, value: str) -> int:
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM graph_nodes WHERE kind=%s AND value=%s", (kind, value))
        row = cur.fetchone()
        if row:
            return row["id"]
        cur.execute(
            "INSERT INTO graph_nodes (kind, value, created_at) VALUES (%s, %s, %s) RETURNING id",
            (kind, value, utcnow()),
        )
        node_id = cur.fetchone()["id"]
        conn.commit()
        return node_id


def create_edge(conn, from_node: int, to_node: int, kind: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO graph_edges (from_node, to_node, kind, created_at) VALUES (%s, %s, %s, %s)",
            (from_node, to_node, kind, utcnow()),
        )
        conn.commit()


def list_graph(conn, limit: int = 200):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM graph_nodes ORDER BY id DESC LIMIT %s", (limit,))
        nodes = cur.fetchall() or []
        cur.execute("SELECT * FROM graph_edges ORDER BY id DESC LIMIT %s", (limit,))
        edges = cur.fetchall() or []
        return {"nodes": nodes, "edges": edges}
