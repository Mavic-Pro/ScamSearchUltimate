import re
from typing import Dict, List

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"\+?\d[\d\s().-]{7,}\d")
WALLET_RE = re.compile(r"\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b")


def extract_indicators(text: str) -> Dict[str, List[str]]:
    emails = list(set(EMAIL_RE.findall(text)))
    phones = list(set(PHONE_RE.findall(text)))
    wallets = list(set(WALLET_RE.findall(text)))
    return {"email": emails, "phone": phones, "wallet": wallets}
