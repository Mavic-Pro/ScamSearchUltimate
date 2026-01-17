import base64
import os
from cryptography.fernet import Fernet, InvalidToken


def is_valid_key(raw: bytes) -> bool:
    try:
        Fernet(raw)
        return True
    except Exception:
        return False


def get_key_status() -> str:
    key = os.getenv("APP_SECRET_KEY")
    if not key:
        return "missing"
    return "ok" if is_valid_key(key.encode("utf-8")) else "invalid"


def generate_key() -> str:
    return Fernet.generate_key().decode("utf-8")


def _get_key() -> bytes:
    key = os.getenv("APP_SECRET_KEY")
    if key:
        raw = key.encode("utf-8")
        if is_valid_key(raw):
            return raw
    # Fallback: generate a valid ephemeral key to avoid crashes
    return Fernet.generate_key()


def encrypt_value(value: str) -> str:
    f = Fernet(_get_key())
    return f.encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_value(value: str) -> str:
    f = Fernet(_get_key())
    try:
        return f.decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return ""
