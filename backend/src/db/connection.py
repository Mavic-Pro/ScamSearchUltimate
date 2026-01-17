import os
from dataclasses import dataclass

import psycopg2
from psycopg2.extras import RealDictCursor


@dataclass
class DbConfig:
    host: str
    port: int
    name: str
    user: str
    password: str


def load_db_config() -> DbConfig:
    return DbConfig(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "5432")),
        name=os.getenv("DB_NAME", "scamhunter"),
        user=os.getenv("DB_USER", "scamhunter"),
        password=os.getenv("DB_PASSWORD", "scamhunter"),
    )


def connect(cfg: DbConfig):
    return psycopg2.connect(
        host=cfg.host,
        port=cfg.port,
        dbname=cfg.name,
        user=cfg.user,
        password=cfg.password,
        connect_timeout=5,
        cursor_factory=RealDictCursor,
    )
