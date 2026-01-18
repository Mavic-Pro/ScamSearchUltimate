import re
from typing import Dict, List

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"\+?\d[\d\s().-]{7,}\d")
WALLET_RE = re.compile(
    r"\b(?:"
    r"bc1[ac-hj-np-z02-9]{11,71}|"
    r"[13][a-km-zA-HJ-NP-Z1-9]{25,34}|"
    r"ltc1[ac-hj-np-z02-9]{11,71}|"
    r"[LM][a-km-zA-HJ-NP-Z1-9]{26,33}|"
    r"D[5-9A-HJ-NP-Ua-km-z1-9]{25,34}|"
    r"X[1-9A-HJ-NP-Za-km-z]{33}"
    r")\b"
)


def extract_indicators(text: str) -> Dict[str, List[str]]:
    emails = list(set(EMAIL_RE.findall(text)))
    phones = list(set(PHONE_RE.findall(text)))
    wallets = list(set(WALLET_RE.findall(text)))
    return {"email": emails, "phone": phones, "wallet": wallets}
