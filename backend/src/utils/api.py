from typing import Any, Dict

def ok(data: Any = None) -> Dict[str, Any]:
    return {"ok": True, "data": data}

def fail(message: str, detail: Any = None) -> Dict[str, Any]:
    return {"ok": False, "error": {"message": message, "detail": detail}}
