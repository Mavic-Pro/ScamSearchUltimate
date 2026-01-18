from __future__ import annotations

from typing import Any, Dict, List

import requests

from backend.src.core.settings import get_setting_value


def detect_blockcypher_chain(address: str) -> str | None:
    addr = address.strip()
    if _is_btc_address(addr):
        return "btc/main"
    if _is_ltc_address(addr):
        return "ltc/main"
    if _is_doge_address(addr):
        return "doge/main"
    if _is_dash_address(addr):
        return "dash/main"
    return None


def blockcypher_address_summary(conn, address: str, limit: int = 20) -> Dict[str, Any]:
    chain = detect_blockcypher_chain(address)
    if not chain:
        return {"warning": "unsupported_address"}
    token = get_setting_value(conn, "BLOCKCYPHER_TOKEN")
    params = {"limit": max(1, min(limit, 50))}
    if token:
        params["token"] = token
    try:
        resp = requests.get(
            f"https://api.blockcypher.com/v1/{chain}/addrs/{address}/full",
            params=params,
            timeout=12,
        )
        data = resp.json()
    except Exception as exc:
        return {"warning": str(exc)}
    if isinstance(data, dict) and data.get("error"):
        return {"warning": str(data.get("error"))}
    txs = data.get("txs") or []
    transactions = []
    related = set()
    for tx in txs:
        tx_hash = tx.get("hash")
        confirmed = tx.get("confirmed")
        total = tx.get("total")
        fees = tx.get("fees")
        inputs = tx.get("inputs") or []
        outputs = tx.get("outputs") or []
        for inp in inputs:
            for addr in inp.get("addresses") or []:
                if addr != address:
                    related.add(addr)
        for out in outputs:
            for addr in out.get("addresses") or []:
                if addr != address:
                    related.add(addr)
        if tx_hash:
            transactions.append(
                {"hash": tx_hash, "confirmed": confirmed, "total": total, "fees": fees}
            )
    summary = {
        "address": data.get("address"),
        "total_received": data.get("total_received"),
        "total_sent": data.get("total_sent"),
        "balance": data.get("balance"),
        "tx_count": data.get("n_tx"),
    }
    return {
        "chain": chain,
        "summary": summary,
        "transactions": transactions[:50],
        "related_addresses": sorted(related)[:200],
    }


def _is_btc_address(address: str) -> bool:
    return bool(
        _match_any(
            address,
            [
                r"^bc1[ac-hj-np-z02-9]{11,71}$",
                r"^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$",
            ],
        )
    )


def _is_ltc_address(address: str) -> bool:
    return bool(
        _match_any(
            address,
            [
                r"^ltc1[ac-hj-np-z02-9]{11,71}$",
                r"^[LM][a-km-zA-HJ-NP-Z1-9]{26,33}$",
            ],
        )
    )


def _is_doge_address(address: str) -> bool:
    return bool(_match_any(address, [r"^D[5-9A-HJ-NP-Ua-km-z1-9]{25,34}$"]))


def _is_dash_address(address: str) -> bool:
    return bool(_match_any(address, [r"^X[1-9A-HJ-NP-Za-km-z]{33}$"]))


def _match_any(value: str, patterns: List[str]) -> bool:
    import re

    for pattern in patterns:
        if re.match(pattern, value):
            return True
    return False
