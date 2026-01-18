# ScamHunter Ultimate Handbook (EN) - Full Guide

This guide explains every feature step by step in simple language. It is written so anyone can follow it.

---

## 0) What ScamHunter Ultimate is (simple explanation)

ScamHunter Ultimate is a defensive web app that helps you:
- find scam and phishing sites;
- understand if they are related;
- extract indicators (emails, phones, wallets);
- create regex signatures;
- receive alerts;
- explore a relationship graph;
- export results.

Think of it as a radar that looks for suspicious sites and groups similar ones together.

---

## 0.0) Recent additions
- Redirect chains in Urlscan/Lab with “save as IOC” actions.
- AI Chat supports multiple Target IDs and pivot suggestions.
- Auto-run hunts with scheduler log.
- Timeline + diff view in Lab.
- System health checks and update notifications.
- Automation workflows with event/schedule triggers and visual graph editor.
- New pivots: Blockcypher, CRT.sh, DomainsDB, Holehe, plus manual spider.

## 0.1) Basic glossary (simple words)

- **URL**: the full address of a web page, e.g. `https://example.com/login`.
- **Domain**: the main site name, e.g. `example.com`.
- **IP**: a numeric address that identifies a server on the internet.
- **Hash**: a "fingerprint" of content. Similar content often has similar hashes.
- **Regex**: a text rule to search for patterns. Used to build signatures.
- **JARM**: a TLS fingerprint used to link related servers.
- **Dork**: a search-engine query to find specific pages.
- **FOFA**: a search engine for exposed internet infrastructure.
- **urlscan**: a service that analyzes web pages and returns technical data.
- **TTL**: how long a hunt should continue.
- **Budget**: the maximum number of results a hunt can collect.

---

## 1) How to start the app (step by step)

1. Open a shell in the repo.
2. Start everything:
   - `docker compose up --build`
3. Open the frontend:
   - `http://localhost:5173`
4. If any tab shows an error, click **Repair DB**.

If you see "connection refused":
- run `docker compose ps`
- confirm backend and frontend are running.

---

## 1.1) 60-second quick guide

1. Open `http://localhost:5173`.
2. Go to **Settings** and save `APP_SECRET_KEY`.
3. Go to **Scan** and submit `https://example.com`.
4. Check **Queue** until it shows DONE.
5. Open **Lab** and load the last target.

---

## 2) Settings - Why they matter

API keys enable external discovery:
- FOFA: exposed infrastructure search;
- SerpAPI: web search for dorks;
- urlscan: scan search and pivots;
- AI: optional rule/signature generation.
- TAXII: push IOC to a TAXII server (optional).
Other settings:
- Update checks (GitHub repo);
- Auto-run hunts (scheduler);
- Auto-run automations (scheduler);
- Confidence filter for matches.

How to set keys:
1. Go to **Settings**.
2. Enter values (if you have them).
3. Click **Save**.
4. Keys are encrypted and stored in the DB.

If you do not set a key, that feature is OFF (no crash).

### 2.1) Encryption key (APP_SECRET_KEY)

This key protects API keys stored in the database.
If you do not set it, the app still works, but keys may not persist after a restart.

Generate one:
```bash
python - <<'PY'
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
PY
```
Put the result in `.env` as `APP_SECRET_KEY=...`.

### 2.2) Remote favicon (optional, with warning)

By default the tool does NOT download non-HTML files. This includes remote favicons.
If you enable **REMOTE_FAVICON_ENABLED**, the tool can download a favicon to compute its hash.
Only enable if you understand the risks.

---

## 3) Automation (Automation tab) - What it does

Automation is a visual workflow builder for conditional pivoting and job orchestration.

Core concepts:
- **Trigger**: manual, event (e.g. `scan_done`), or schedule (interval seconds).
- **Graph**: nodes and edges with conditions (always/true/false/regex/equals/gte/lte).
- **Dry run**: preview without queueing jobs.

Common nodes:
- `queue_scan`, `spider`
- `pivot_crtsh`, `pivot_domainsdb`, `pivot_blockcypher`, `pivot_holehe`
- `select_indicators`, `save_iocs`, `normalize`, `dedupe`, `filter_regex`
- `webhook` for external calls

Playbooks live here (Scan/Hunt presets were moved to Automation).

## 4) Scan (Scan tab) - What it does

Scan is the core. You can submit:
- a direct URL;
- a keyword;
- a FOFA query.

The system creates jobs in a queue and processes them.

### 4.1 Manual URL scan

1. Open **Scan**.
2. URL field: `https://example.com`.
3. Click **Start Scan**.
4. Watch the **Queue** and status.

What happens internally:
- if content is not HTML, it is skipped (SKIPPED_FILE);
- if HTML, it hashes DOM and headers;
- extracts indicators;
- fetches safe JS/CSS assets;
- creates graph nodes and edges;
- creates/updates campaigns.
- attempts screenshots (Playwright if enabled).

### 4.2 Keyword scan (discovery)

1. Keyword: example `"paypal" login`.
2. Click **Start Scan**.
3. It uses SerpAPI + DuckDuckGo to find URLs.
4. Those URLs become queued jobs.

### 4.3 FOFA scan

1. FOFA Query field.
2. Example defensive queries:
   - `title="login" && country="IT" && port="443"`
   - `body="password" && header="nginx"`
   - `favicon_hash="-247388890" && title="Wallet"`
   - `body="reset password" && country="US"`
3. Click **Start Scan**.

---

## 5) Queue - What to watch

The queue shows:
- job id;
- type (scan);
- status (QUEUED, RUNNING, DONE, FAILED, SKIPPED);
- URL.

If a job is stuck, the system requeues it automatically.

---

## 6) Hunt (Hunt tab) - What it does

Hunt is for repeated discovery with TTL and budgets. You can auto-run enabled hunts.

Fields:
- **Name**: label;
- **Type**: fofa, urlscan, dork;
- **Rule**: the query;
- **TTL**: max duration;
- **Delay**: time between loops;
- **Budget**: max results.

### 6.1 Dork hunting

Simple examples:
- `site:example.com "login"`
- `"Microsoft 365" "sign in" "account"`
- `"reset password" "portal"`
- `"slotnusa" "casino" "login"`

Real example (fake casino scam):
- **Slotnusa** is a fake online casino that imitates legitimate brands to trick users. The dork above searches for domains using the name “slotnusa” with keywords like “casino” and “login”.

Steps:
1. Type: dork
2. Rule: paste query
3. Click **Run Hunt**

### 6.2 FOFA hunting

Examples:
- `title="login" && country="FR" && body="secure"`
- `body="wallet connect" && port="443"`
- `cert="381691609147718260459780208541489433626802"`

Explanation: this FOFA query looks for hosts using a specific certificate. It helps link related infrastructure. In this example it is tied to #Lazarus / #APT38, an APT group known for financially motivated attacks and cybercrime associated with North Korea.

Steps:
1. Type: fofa
2. Rule: query
3. Run Hunt

### 6.3 urlscan hunting

Example:
- `domain:"example.com" AND page.title:"login"`

Steps:
1. Type: urlscan
2. Rule: query
3. Run Hunt

---

## 7) Campaigns (Campaigns tab) - What it does

Campaigns cluster similar targets by:
- DOM hash;
- favicon hash;
- JARM;
- similar assets.

Steps:
1. Open **Campaigns**.
2. Review list and member counts.
3. If a target clusters, it indicates a coordinated campaign.

---

## 8) Lab (Lab tab) - What it does

Lab shows full target detail.

Steps:
1. Enter Target ID.
2. Click **Load**.
3. Review:
   - headers;
   - assets with hashes;
   - extracted indicators;
   - signature matches;
   - redirect chains, timeline, and diffs.

This is where you decide SAFE vs MALICIOUS. It also exposes pivots (Blockcypher, CRT.sh, DomainsDB, Holehe) and a manual spider.

---

## 9) Signatures (Signatures tab) - What it does

Signatures are regex patterns applied to html/headers/url/assets.

Fields:
- name: label;
- pattern: regex;
- target_field: html/headers/url/asset.

Examples:
- HTML login form: `<form[^>]+(login|signin)`
- O365 cookie header: `set-cookie:.*ESTSAUTH`
- Suspicious URL: `https?://[^/]+/secure/`
- JS drainer pattern: `eth_requestAccounts|wallet_switchEthereumChain`

Steps:
1. Create signature.
2. Run scans.
3. Check matches in Lab.

---

## 10) YARA (YARA tab) - What it does

YARA rules let you search for advanced patterns. Useful to:
- detect suspicious strings in HTML;
- detect malicious JS/CSS payloads.

Note: requires `yara-python` to be installed. If missing, rules are skipped.

Steps:
1. Go to **YARA**.
2. Add name, target (html/asset), and full YARA rule.
3. Save the rule.
4. Run scans and check matches in **Lab**.

---

## 11) Alerts (Alerts tab) - What it does

Alerts are created when:
- risk score is high;
- a signature matches;
- a campaign link is created.
You can also create custom alert rules (regex).

Steps:
1. Open **Alerts**.
2. Review entries.
3. (Optional) configure webhook in future.

---

## 12) Urlscan Local (Urlscan tab) - What it does

This tab is a "local urlscan": it does not need internet, it uses your DB.

You can:
- search by domain, hash, IP, JARM, or free text;
- view scan history;
- export CSV results;
- pivot by clicking hashes or IPs;
- view redirect chains and save them as IOCs.

Steps:
1. Open **Urlscan**.
2. Enter a filter (domain or hash).
3. Click **Search**.
4. Click a result to see details and pivots.

---

## 13) Graph (Graph tab) - What it does

Graph shows Maltego-style relationships.

Steps:
1. Choose node kind (domain/url/dom_hash).
2. Enter value.
3. Click **Expand**.
4. Inspect nodes and edges.

---

## 14) Export (Export tab) - What it does

- **CSV**: table of targets.
- **JSON graph**: nodes and edges.
- **IOC export**: CSV/JSON/STIX/OpenIOC/MISP with filters.
- **TAXII push**: send IOC to a TAXII server (if configured).

Steps:
1. Open **Export**.
2. Click a button.
3. Download the file.

---

## 15) AI Chat (AI tab) - What it does

AI chat is optional. If no provider is configured, the app still provides basic suggestions.

Features:
- generates FOFA/urlscan/dork rules;
- proposes regex signatures;
- validates JSON so no fake fields are used.
 - supports multiple Target IDs for context and pivot suggestions.

Steps:
1. Open **AI Chat**.
2. Describe what you want to find (e.g. "scam crypto wallet").
3. Click **Generate**.
4. If you like the output, click **Create rule**.

---

Optional: you can provide target context (full DOM + saved IOC) for better answers.

---

## 16) IOCs (IOCs tab) - What it does

This tab stores the indicators you marked (hash, URL, domain).

You can:
- filter by kind, value, domain, url, source, date range;
- export as CSV/JSON/STIX/OpenIOC/MISP;
- TAXII push (if configured).

---

## 17) Quick tab tour (what to click)

1. **Scan**: paste a URL and click **Start Scan**.
2. **Hunt**: add a rule (dork/fofa/urlscan) and **Run Hunt**.
3. **Urlscan**: search by domain/hash/IP and pivot.
4. **Lab**: load a target ID and inspect details.
5. **Campaigns**: review clusters and members.
6. **Signatures**: create regex and use DB search.
7. **Alerts**: review alert history.
8. **Graph**: expand nodes to explore relationships.
9. **Export**: download CSV and JSON graph.
10. **YARA**: save YARA rules.
11. **AI Chat**: generate rules and create with one click.
12. **Automation**: create workflows and playbooks.
13. **IOCs**: filter and export.
14. **Settings**: save keys and options.

---

## 18) Common errors (simple explanations)

- **Failed to fetch**: frontend cannot reach backend.
  - Fix: start backend and check `docker compose ps`.
- **SKIPPED_FILE**: non-HTML content.
  - This is a safety feature.
- **Repair DB**: recreates DB schema if broken.

---

## 19) Advanced troubleshooting (clear steps)

- **Failed to fetch**: frontend cannot reach backend.
  - Fix: run `docker compose ps` and `docker compose logs -f backend`.
- **Buttons do nothing**: backend not responding or CORS.
  - Fix: open `http://localhost:8000/` and check for `status: ok`.
- **Settings save fails**: missing `APP_SECRET_KEY`.
  - Fix: put it in `.env` and restart.
- **Missing screenshots**: Playwright disabled or failed.
  - Fix: check `PLAYWRIGHT_ENABLED=1` and read `screenshot_reason` in Lab.

---

## 20) Real scenarios (step by step)

### Scenario A: Bank login clone

1. Keyword scan: `"BankName" login`.
2. Create signature for login form.
3. Validate in Lab.
4. Check Campaigns for clusters.

### Scenario B: Crypto wallet scam

1. FOFA scan: `title="Connect Wallet" && body="wallet"`.
2. Signature on JS assets: `eth_requestAccounts`.
3. Review assets and clustering.

### Scenario C: APT-style HR phishing

1. Dork: `"HR portal" "reset password"`.
2. Review extracted emails.
3. Expand Graph to find related domains.

### Scenario D: BEC (Office/Google fake)

1. Keyword: `"Microsoft 365" login`.
2. Header signature: `ESTSAUTH`.
3. Watch Alerts for high risk.

---

## 21) Final checklist

- [ ] DB ok or repaired
- [ ] Settings saved
- [ ] Scans completed
- [ ] Signatures enabled
- [ ] Alerts reviewed
- [ ] Campaigns analyzed
- [ ] Exports downloaded
