from backend.src.core.scan import scan_url


def run_minimal_scan_job(conn, job_id: int, payload: dict):
    url = payload.get("url")
    if not url:
        return {"status": "FAILED", "reason": "missing_url"}
    return scan_url(conn, url)
