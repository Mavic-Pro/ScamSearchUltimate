from __future__ import annotations

import json
import shutil
import subprocess
from typing import Any, Dict


def holehe_lookup(email: str, timeout_seconds: int = 25) -> Dict[str, Any]:
    binary = shutil.which("holehe")
    if not binary:
        return {"warning": "holehe_not_installed"}
    cmd = [binary, email, "--json"]
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            check=False,
        )
    except Exception as exc:
        return {"warning": str(exc)}
    output = (proc.stdout or proc.stderr or "").strip()
    if not output:
        return {"warning": "empty_output"}
    results: Any = None
    try:
        results = json.loads(output)
    except Exception:
        return {"raw": output[:10000]}
    return {"results": results, "raw": output[:10000]}
