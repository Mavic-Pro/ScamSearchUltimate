import pytest

from backend.src.db.connection import connect, load_db_config
from backend.src.db.validator import validate_and_migrate


def test_validate_and_migrate():
    cfg = load_db_config()
    try:
        conn = connect(cfg)
    except Exception as exc:
        pytest.skip(f"DB not available: {exc}")
    try:
        rep = validate_and_migrate(conn)
        assert rep.ok
    finally:
        conn.close()
