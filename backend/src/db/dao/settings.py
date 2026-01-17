from backend.src.security.secrets import decrypt_value, encrypt_value
from backend.src.utils.time import utcnow


def get_setting(conn, key: str) -> str | None:
    with conn.cursor() as cur:
        cur.execute("SELECT value_encrypted FROM settings WHERE key=%s", (key,))
        row = cur.fetchone()
        if not row:
            return None
        return decrypt_value(row["value_encrypted"])


def set_setting(conn, key: str, value: str) -> None:
    enc = encrypt_value(value)
    with conn.cursor() as cur:
        cur.execute("SELECT key FROM settings WHERE key=%s", (key,))
        if cur.fetchone():
            cur.execute(
                "UPDATE settings SET value_encrypted=%s, updated_at=%s WHERE key=%s",
                (enc, utcnow(), key),
            )
        else:
            cur.execute(
                "INSERT INTO settings (key, value_encrypted, updated_at) VALUES (%s, %s, %s)",
                (key, enc, utcnow()),
            )
        conn.commit()
