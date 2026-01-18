from backend.src.utils.time import utcnow


def create_signature(conn, name: str, pattern: str, target_field: str, enabled: bool = True):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO signatures (name, pattern, target_field, enabled, created_at) VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (name, pattern, target_field, enabled, utcnow()),
        )
        sig_id = cur.fetchone()["id"]
        conn.commit()
        return sig_id


def list_signatures(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM signatures ORDER BY id DESC")
        return cur.fetchall() or []


def insert_match(conn, target_id: int, signature_id: int):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO signature_matches (target_id, signature_id, created_at) VALUES (%s, %s, %s)",
            (target_id, signature_id, utcnow()),
        )
        conn.commit()


def list_matches(conn, target_id: int):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT m.*, s.name, s.pattern, s.target_field FROM signature_matches m JOIN signatures s ON m.signature_id = s.id WHERE m.target_id=%s",
            (target_id,),
        )
        return cur.fetchall() or []


def count_matches(conn, target_id: int) -> int:
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) as cnt FROM signature_matches WHERE target_id=%s", (target_id,))
        row = cur.fetchone()
        return int(row["cnt"]) if row else 0


def ensure_default_signatures(conn) -> None:
    defaults = [
        ("DSA Private Key", r"-----BEGIN DSA PRIVATE KEY-----", "html"),
        ("DSA Private Key (asset)", r"-----BEGIN DSA PRIVATE KEY-----", "asset"),
        ("RSA Private Key", r"-----BEGIN RSA PRIVATE KEY-----", "html"),
        ("RSA Private Key (asset)", r"-----BEGIN RSA PRIVATE KEY-----", "asset"),
        ("EC Private Key", r"-----BEGIN EC PRIVATE KEY-----", "html"),
        ("EC Private Key (asset)", r"-----BEGIN EC PRIVATE KEY-----", "asset"),
        ("OpenSSH Private Key", r"-----BEGIN OPENSSH PRIVATE KEY-----", "html"),
        ("OpenSSH Private Key (asset)", r"-----BEGIN OPENSSH PRIVATE KEY-----", "asset"),
        ("Private Key (PKCS8)", r"-----BEGIN PRIVATE KEY-----", "html"),
        ("Private Key (PKCS8) (asset)", r"-----BEGIN PRIVATE KEY-----", "asset"),
        ("Encrypted Private Key", r"-----BEGIN ENCRYPTED PRIVATE KEY-----", "html"),
        ("Encrypted Private Key (asset)", r"-----BEGIN ENCRYPTED PRIVATE KEY-----", "asset"),
        ("PGP Private Key Block", r"-----BEGIN PGP PRIVATE KEY BLOCK-----", "html"),
        ("PGP Private Key Block (asset)", r"-----BEGIN PGP PRIVATE KEY BLOCK-----", "asset"),
        ("Bitcoin Address", r"\\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\\b", "html"),
        ("Bitcoin Address (bech32)", r"\\bbc1[ac-hj-np-z02-9]{11,71}\\b", "html"),
        ("Bitcoin Address (asset)", r"\\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\\b", "asset"),
        ("Bitcoin Address (bech32) (asset)", r"\\bbc1[ac-hj-np-z02-9]{11,71}\\b", "asset"),
        ("Ethereum Address", r"\\b0x[a-fA-F0-9]{40}\\b", "html"),
        ("Ethereum Address (asset)", r"\\b0x[a-fA-F0-9]{40}\\b", "asset"),
        ("Solana Address", r"\\b[1-9A-HJ-NP-Za-km-z]{32,44}\\b", "html"),
        ("Solana Address (asset)", r"\\b[1-9A-HJ-NP-Za-km-z]{32,44}\\b", "asset"),
        ("Monero Address", r"\\b[48][0-9A-HJ-NP-Za-km-z]{94,105}\\b", "html"),
        ("Monero Address (asset)", r"\\b[48][0-9A-HJ-NP-Za-km-z]{94,105}\\b", "asset"),
    ]
    with conn.cursor() as cur:
        cur.execute("SELECT name FROM signatures")
        existing = {row["name"] for row in (cur.fetchall() or [])}
        for name, pattern, target_field in defaults:
            if name in existing:
                continue
            cur.execute(
                "INSERT INTO signatures (name, pattern, target_field, enabled, created_at) VALUES (%s, %s, %s, %s, %s)",
                (name, pattern, target_field, True, utcnow()),
            )
        conn.commit()
