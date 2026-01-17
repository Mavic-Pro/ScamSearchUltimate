from dataclasses import dataclass, field
from typing import Dict, List

from backend.src.db.connection import connect, load_db_config
from backend.src.db.schema.definitions import SCHEMA_VERSION, TABLES, INDEXES, VIEWS
from backend.src.utils.time import utcnow


@dataclass
class ValidationReport:
    ok: bool
    actions: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, object]:
        return {"ok": self.ok, "actions": self.actions}


def ensure_db_ready() -> None:
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        validate_and_migrate(conn)
    finally:
        conn.close()


def validate_and_migrate(conn) -> ValidationReport:
    report = ValidationReport(ok=True)
    with conn.cursor() as cur:
        cur.execute("SELECT schema_name FROM information_schema.schemata WHERE schema_name='public'")
        if not cur.fetchone():
            cur.execute("CREATE SCHEMA public")
            report.actions.append("create_schema_public")

        cur.execute("SET search_path TO public")
        if not _table_exists(cur, "schema_version"):
            _create_all(cur, report)
            _upsert_schema_version(cur, report)
            conn.commit()
            return report

        inconsistent = False
        for table, columns in TABLES.items():
            if not _table_exists(cur, table):
                report.actions.append(f"missing_table:{table}")
                inconsistent = True
                break
            existing = _get_columns(cur, table)
            for col, col_type in columns.items():
                if col not in existing:
                    cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")
                    report.actions.append(f"add_column:{table}.{col}")
            if inconsistent:
                break

        if inconsistent:
            _backup_and_recreate(cur, report)
        else:
            _ensure_indexes(cur, report)
            _ensure_views(cur, report)
            _upsert_schema_version(cur, report)

        conn.commit()
    return report


def _backup_and_recreate(cur, report: ValidationReport) -> None:
    ts = utcnow().strftime("%Y%m%d%H%M%S")
    backup_schema = f"backup_{ts}"
    cur.execute(f"ALTER SCHEMA public RENAME TO {backup_schema}")
    cur.execute("CREATE SCHEMA public")
    cur.execute("SET search_path TO public")
    report.actions.append(f"backup_schema:{backup_schema}")
    _create_all(cur, report)
    _upsert_schema_version(cur, report)


def _create_all(cur, report: ValidationReport) -> None:
    for table, columns in TABLES.items():
        cols = ", ".join([f"{name} {ctype}" for name, ctype in columns.items()])
        cur.execute(f"CREATE TABLE IF NOT EXISTS {table} ({cols})")
        report.actions.append(f"create_table:{table}")
    _ensure_indexes(cur, report)
    _ensure_views(cur, report)


def _ensure_indexes(cur, report: ValidationReport) -> None:
    for table, cols in INDEXES.items():
        for col in cols:
            name = f"idx_{table}_{col}"
            cur.execute(
                "SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename=%s AND indexname=%s",
                (table, name),
            )
            if not cur.fetchone():
                cur.execute(f"CREATE INDEX {name} ON {table} ({col})")
                report.actions.append(f"create_index:{name}")


def _ensure_views(cur, report: ValidationReport) -> None:
    for view, sql in VIEWS.items():
        cur.execute("SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name=%s", (view,))
        if not cur.fetchone():
            cur.execute(f"CREATE VIEW {view} AS {sql}")
            report.actions.append(f"create_view:{view}")


def _upsert_schema_version(cur, report: ValidationReport) -> None:
    cur.execute("SELECT version FROM schema_version WHERE id=1")
    if cur.fetchone():
        cur.execute("UPDATE schema_version SET version=%s, updated_at=%s WHERE id=1", (SCHEMA_VERSION, utcnow()))
        report.actions.append("update_schema_version")
    else:
        cur.execute(
            "INSERT INTO schema_version (id, version, updated_at) VALUES (1, %s, %s)",
            (SCHEMA_VERSION, utcnow()),
        )
        report.actions.append("insert_schema_version")


def _table_exists(cur, table: str) -> bool:
    cur.execute(
        "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=%s",
        (table,),
    )
    return cur.fetchone() is not None


def _get_columns(cur, table: str) -> Dict[str, str]:
    cur.execute(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=%s",
        (table,),
    )
    rows = cur.fetchall()
    return {row["column_name"]: row["data_type"] for row in rows}
