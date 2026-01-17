# ScamHunter Ultimate Cheat Sheet (EN)

This is a super fast (1-page) guide to use the tool without friction.

---

## Quick start

```bash
cp .env.example .env
# (optional) generate encryption key
python3 - <<'PY'
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
PY

docker compose up --build
```

Open `http://localhost:5173`.

---

## 3 main use cases (minimal steps)

### 1) Single site scan
1. **Scan**: paste a URL (e.g. `https://example.com`).
2. **Start Scan**.
3. **Queue**: wait for DONE.
4. **Lab**: load target and review hashes/indicators/screenshot.

### 2) Dork hunting (web search)
1. **Hunt**: type `dork`.
2. Rule: e.g. `"slotnusa" "casino" "login"`.
3. **Run Hunt**.
4. **Queue**: check new jobs.

### 3) FOFA hunting (exposed infra)
1. **Hunt**: type `fofa`.
2. Rule: `cert="381691609147718260459780208541489433626802"`.
3. **Run Hunt**.
4. **Campaigns**: check clustering for similarity.

---

## Where to put dorks

- Dorks are used **only in Hunt**.
- Scan is for URL, keyword, or FOFA query.

---

## Main tabs (one line each)

- **Scan**: create jobs and scan targets.
- **Hunt**: repeated rules with TTL/budget.
- **Urlscan**: local search on scans.
- **Lab**: target details.
- **Campaigns**: clusters of similar sites.
- **Signatures**: regex and DB search.
- **Alerts**: events and history.
- **Graph**: Maltego-style relationships.
- **Export**: CSV + graph JSON.
- **AI Chat**: rule/signature suggestions.
- **Settings**: keys and options.

---

## Fast troubleshooting

- **Failed to fetch**: backend not reachable -> `docker compose ps`.
- **Buttons do nothing**: check `http://localhost:8000/`.
- **Settings not saved**: set `APP_SECRET_KEY` in `.env`.
- **Missing screenshot**: verify `PLAYWRIGHT_ENABLED=1`.

---

## Export

- CSV: target list
- JSON: nodes/edges graph

---

## Safety notes

- The tool never downloads non-HTML files.
- If a URL is not HTML, it is marked `SKIPPED_FILE`.
