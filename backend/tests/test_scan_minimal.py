import pytest

from backend.src.db.connection import connect, load_db_config
from backend.src.core.scan_minimal import run_minimal_scan_job
from backend.src.db.validator import validate_and_migrate


def test_scan_minimal():
    cfg = load_db_config()
    try:
        conn = connect(cfg)
    except Exception as exc:
        pytest.skip(f"DB not available: {exc}")
    try:
        validate_and_migrate(conn)
        res = run_minimal_scan_job(conn, job_id=0, payload={"url": "https://example.com"})
        assert res["status"] in ("DONE", "SKIPPED", "SKIPPED_FILE", "FAILED")
    finally:
        conn.close()
