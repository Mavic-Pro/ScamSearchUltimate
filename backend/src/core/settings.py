import os

from backend.src.db.dao.settings import get_setting


def get_setting_value(conn, key: str, default: str | None = None) -> str | None:
    value = get_setting(conn, key)
    if value is not None and value != "":
        return value
    return os.getenv(key, default)
