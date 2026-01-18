# ScamHunter Ultimate

ScamHunter Ultimate is a production-grade defensive scanning and hunting platform for scam/phishing sites. It supports batch scans, discovery, scheduled hunts, campaigns clustering, signatures, alerts, a Maltego-style graph, local urlscan-like search, redirect chains, automation workflows, advanced pivots, and exports.

## Step-by-step plan
1) Start PostgreSQL and services via Docker Compose.
2) Initialize DB schema and validate with the built-in validator.
3) Run the worker process for jobs queue.
4) Use the UI to submit scans, hunts, and manage rules.
5) Review campaigns, lab details, graph exploration, and exports.

## Quick start
```bash
cp .env.example .env

docker compose up --build
```

Open the UI at `http://localhost:5173`.

## 60-second quick guide
1) Open `http://localhost:5173`.
2) Go to **Settings** and save `APP_SECRET_KEY` (see below).
3) Go to **Scan** and submit `https://example.com`.
4) Check **Queue** for DONE status.
5) Open **Lab**, load the last target, and inspect hashes/indicators.

## Cheat sheet (1 page)
- IT: `docs/cheatsheet-it.md`
- EN: `docs/cheatsheet-en.md`

## What each main part does (simple explanation)
- **Scan**: you give a URL, a keyword, or a FOFA query. The system creates jobs, fetches the page safely, extracts indicators, hashes content, and stores results.
- **Hunt**: you save a rule (FOFA, urlscan, or dork), then run it with TTL, delay, and budget so it repeats in a controlled loop. Auto-run is configurable.
- **Lab**: detail view for a target. You can see headers, assets, indicators, signature matches, screenshots, redirect chains, timeline, diffs, and pivot actions (Blockcypher, CRT.sh, DomainsDB, Holehe). Includes manual spider.
- **Campaigns**: groups similar targets by hashes (DOM, favicon, screenshot), JARM, and assets.
- **Graph**: visualizes relationships between domains, IPs, hashes, indicators, and campaigns.
- **Urlscan Local**: a local index of scans with search and pivot by hashes, domains, IP, and JARM. Redirect chains can be viewed and saved as IOCs.
- **IOCs**: saved indicators with filters and multi-format export (CSV/JSON/STIX/OpenIOC/MISP).
- **YARA**: YARA rules for HTML/assets (optional, requires yara-python).
- **AI Chat**: optional assistant to propose rules/signatures and suggest IOC pivots. Supports multiple Target IDs for context.
- **Automation**: visual workflow builder with conditional logic, event/schedule triggers, playbooks, and job orchestration across pivots.

## Defensive FOFA examples
- `title="login" && country="IT" && port="443"`
- `body="pagamento" && cert.subject="*"`
- `favicon_hash="-247388890" && title="Wallet"`
- `jarm="29d29d29d00029d29d29d29d29d29d29d29d29d29d29d29d29d29d29d29d"`

## Workflow
1) Scan tab: submit a URL, keyword, or FOFA query. Discovery providers are enabled when keys are configured.
2) Hunt tab: create rules with TTL, delay, and budget; launch or auto-run hunts.
3) Lab tab: inspect headers, assets, indicators, redirect chains, and timeline.
4) Campaigns tab: review clusters built from hashes and JARM.
5) Signatures tab: manage regex rules and run DB search.
6) YARA tab: add YARA rules for HTML/assets (requires yara-python).
7) Alerts tab: review alerts and configure custom alert rules.
8) IOCs tab: review saved indicators with filters and export formats.
9) Graph tab: explore relationships and expand nodes.
10) Export tab: export CSV/graph JSON + IOC formats and TAXII push.
11) AI Chat tab: generate rules/signatures and IOC pivots with context.
12) Automation tab: create playbooks, design conditional workflows, and trigger runs.
13) Settings tab: configure keys, scheduler, confidence filter, and update checks.

## Automation JSON examples
Example graph: queue a scan when a scan finishes and risk >= 50.
```json
{
  "trigger_type": "event",
  "trigger_config": {
    "event": "scan_done",
    "risk_gte": 50
  },
  "graph": {
    "nodes": [
      { "id": "start", "type": "start", "label": "Start" },
      { "id": "q1", "type": "queue_scan", "label": "Queue", "config": { "urls": ["{{event.url}}"], "limit": 1 } }
    ],
    "edges": [
      { "from": "start", "to": "q1", "condition": "always" }
    ]
  }
}
```

Example graph: extract emails and run Holehe + save IOC.
```json
{
  "trigger_type": "event",
  "trigger_config": { "event": "scan_done" },
  "graph": {
    "nodes": [
      { "id": "start", "type": "start", "label": "Start" },
      { "id": "emails", "type": "select_indicators", "label": "Emails", "config": { "kind": "email" } },
      { "id": "holehe", "type": "pivot_holehe", "label": "Holehe", "config": { "emails": "{{last}}" } },
      { "id": "save", "type": "save_iocs", "label": "Save", "config": { "kind": "email", "values": "{{last}}", "source": "automation" } }
    ],
    "edges": [
      { "from": "start", "to": "emails", "condition": "always" },
      { "from": "emails", "to": "holehe", "condition": "always" },
      { "from": "holehe", "to": "save", "condition": "always" }
    ]
  }
}
```
## Settings and secrets (important)
- All API keys are stored encrypted in the DB.
- The encryption key is `APP_SECRET_KEY` (Fernet). Put it in `.env`.
- If you do not set `APP_SECRET_KEY`, the app still works but secrets are not stable across restarts.
- TAXII push uses `TAXII_URL` and `TAXII_COLLECTION` (optional `TAXII_API_KEY`).
- Update checker uses `GITHUB_REPO` and optional `GITHUB_BRANCH`.
- Optional pivot tokens: `BLOCKCYPHER_TOKEN`.
- Automation scheduler uses `AUTOMATION_AUTORUN_ENABLED` and `AUTOMATION_AUTORUN_POLL_SECONDS`.

Generate a key:
```bash
python - <<'PY'
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
PY
```

## Screenshots and safety
- The scanner never downloads non-HTML files.
- Screenshots use Playwright when enabled, with timeouts and a safe fallback.
- If screenshots fail, the UI still works and the reason is stored.

## Where to put dorks (common confusion)
- **Dorks belong to the Hunt tab**, not the Scan tab.
- In **Hunt**, choose `rule_type: dork`, paste the dork, and click **Avvia Hunt**.
- The Scan tab is for URL, keyword, or FOFA query only.
- Playbooks are in **Automation**.

## Required commands before release
```bash
python -m compileall backend/src tools
pytest -q
docker compose build
python tools/selfcheck.py
python tools/smoke_test.py --base-url http://localhost:8000
cd frontend && npm i && npm run build
```

## Tab tour (what to click, in order)
1) **Scan**: paste a URL, then click **Start Scan**. Use keyword/FOFA only when you want discovery.
2) **Hunt**: add a rule (dork/fofa/urlscan), then **Start Hunt** to run it.
3) **Urlscan**: search by domain/hash/IP; check redirect chains and save IOCs.
4) **Lab**: load a target ID; inspect headers, assets, indicators, timeline, screenshot.
5) **Campaigns**: review clusters and members; use it to spot linked infra.
6) **Signatures**: add a regex and test it with scans; use DB search.
7) **YARA**: add YARA rules for HTML/assets and review matches in Lab.
8) **Alerts**: review triggered alerts; webhook is optional.
9) **IOCs**: filter and export IOC in CSV/JSON/STIX/OpenIOC/MISP.
10) **Graph**: choose a node type and expand to explore relationships.
11) **Export**: download CSV/graph + IOC formats and TAXII push.
12) **AI Chat**: generate rules/signatures and extract IOC pivots across multiple targets.
13) **Automation**: run playbooks, create workflows, and manage triggers.
14) **Settings**: configure keys, AI provider, scheduler, confidence filters, and update checks.

## Troubleshooting (advanced)
- **Buttons do nothing**: confirm backend is reachable at `http://localhost:8000` and frontend at `http://localhost:5173`.
- **Failed to fetch**: CORS or backend down. Check `docker compose ps` and `docker compose logs -f backend`.
- **Settings save error**: ensure `APP_SECRET_KEY` is set; if not, set it in `.env` and restart.
- **Playwright build fails**: rebuild after pulling the latest images (`docker compose build backend worker`).
- **No screenshot**: check `PLAYWRIGHT_ENABLED=1` and see **Lab** for `screenshot_reason`.
