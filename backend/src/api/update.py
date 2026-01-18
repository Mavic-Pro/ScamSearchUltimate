from fastapi import APIRouter

from backend.src.core.update import check_update, get_local_version, run_update
from backend.src.utils.api import fail, ok

router = APIRouter(prefix="/api/update", tags=["update"])


@router.get("/status")
def status():
    return ok(check_update())


@router.get("/version")
def version():
    return ok({"version": get_local_version()})


@router.post("/run")
def run():
    result = run_update()
    if not result.get("ok"):
        return fail(result.get("error", "update_failed"))
    return ok(result)
