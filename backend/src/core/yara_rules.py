from typing import List

from backend.src.utils.logging import log_error


def match_yara(content: bytes, rules: List[dict], target_field: str) -> List[int]:
    try:
        import yara  # type: ignore
    except Exception:
        log_error("YARA not installed", "Install yara-python to enable YARA rules")
        return []

    matched: List[int] = []
    for rule in rules:
        if not rule.get("enabled"):
            continue
        if rule.get("target_field") != target_field:
            continue
        try:
            compiled = yara.compile(source=str(rule.get("rule_text", "")))
            res = compiled.match(data=content)
            if res:
                matched.append(int(rule["id"]))
        except Exception as exc:
            log_error("YARA rule error", f"{rule.get('name')} {exc}")
            continue
    return matched
