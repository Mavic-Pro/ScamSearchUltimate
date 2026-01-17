import logging
from typing import Optional

from backend.src.db.dao.logs import insert_log
from backend.src.db.connection import connect, load_db_config

_LOGGER = None


def get_logger(name: str) -> logging.Logger:
    global _LOGGER
    if _LOGGER is None:
        logger = logging.getLogger(name)
        if not logger.handlers:
            logger.setLevel(logging.INFO)
            handler = logging.StreamHandler()
            formatter = logging.Formatter("[%(levelname)s] %(name)s: %(message)s")
            handler.setFormatter(formatter)
            logger.addHandler(handler)
        _LOGGER = logger
    return _LOGGER


def log_event(level: str, message: str) -> None:
    try:
        cfg = load_db_config()
        conn = connect(cfg)
        try:
            insert_log(conn, level, message)
        finally:
            conn.close()
    except Exception:
        logger = get_logger("scamhunter")
        logger.info("log fallback: %s", message)


def log_info(message: str) -> None:
    log_event("INFO", message)


def log_error(message: str, detail: Optional[str] = None) -> None:
    msg = message if detail is None else f"{message} | {detail}"
    log_event("ERROR", msg)
