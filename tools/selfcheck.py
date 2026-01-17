import os
import sys

ROOT = os.path.dirname(os.path.dirname(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from backend.src.db.connection import connect, load_db_config
from backend.src.db.validator import validate_and_migrate
from backend.src.core.scan_minimal import run_minimal_scan_job


def main() -> int:
    print("[*] Selfcheck starting...")
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        rep = validate_and_migrate(conn)
        if not rep.ok:
            print("[!] DB validation failed")
            return 1

        res = run_minimal_scan_job(conn, job_id=0, payload={"url": "https://example.com"})
        if res.get("status") not in ("DONE", "SKIPPED", "SKIPPED_FILE"):
            print("[!] Scan failed:", res)
            return 1

        print("[+] Selfcheck OK")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
