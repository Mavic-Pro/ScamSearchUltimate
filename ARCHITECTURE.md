# Architecture

ScamHunter Ultimate is composed of:

- **Backend**: FastAPI app with modular routers under `backend/src/api`, business logic in `backend/src/core`, DB layer under `backend/src/db`, queue/worker in `backend/src/jobs`, security utilities in `backend/src/security`.
- **Frontend**: React + TypeScript (Vite) SPA with tabbed UI and a single LogPanel.
- **Database**: PostgreSQL 16 with a single canonical schema and an additive migration/validation layer.
- **Worker**: separate process that leases and executes jobs from the DB queue.

Key flows:

1) **Schema validator** runs on startup or via `POST /api/db/repair` to ensure all tables/columns/indexes exist. If schema is inconsistent, it is backed up and recreated.
2) **Job queue** stores scan/hunt tasks with leases to avoid stuck jobs.
3) **Scan pipeline** uses safe fetching (timeouts + HTML-only) to parse pages, hash DOM/headers/assets, extract indicators, compute favicon/screenshot hashes, run regex/YARA matches, and materialize graph nodes.
4) **Screenshot capture** uses Playwright when enabled; if it fails, a safe fallback is stored and the reason is recorded.
5) **Urlscan Local** stores scan metadata to allow local search and pivot (domain, hash, IP, JARM, favicon), plus cached redirect chains for remote lookups.
6) **IOC storage** lets you mark hashes/URLs/domains with context and export them in multiple formats.
7) **Pivot APIs** allow expansion by hash, IP, JARM, favicon, FOFA-compatible fields, Blockcypher, CRT.sh, DomainsDB, and Holehe.
8) **Automation engine** stores workflows (graph JSON) and executes nodes with conditional logic via jobs; triggers support manual, event, and schedule.
9) **Spider job** performs bounded link traversal + optional sitemap parsing and queues scans.
10) **Hunt engine** schedules repeated discovery with TTL/budget and optional providers; auto-run is driven by the worker.
11) **Alerts + rules** apply regex-based alert rules during scans.
12) **Update checker** compares local version to GitHub and can auto-update when enabled.
13) **Front-end tabs** call API endpoints with fail-safe error handling and offer a “Ripara DB” action.

Modules of interest:
- `backend/src/core/scan.py`: scan pipeline, asset hashing, indicators extraction, screenshot capture, urlscan_local insert, campaign clustering.
- `backend/src/core/automation.py`: automation engine, graph execution, triggers, conditional logic.
- `backend/src/core/urlscan_local.py`: local search/pivot.
- `backend/src/core/spider.py`: bounded crawler + sitemap support for manual spider.
- `backend/src/security/screenshot.py`: Playwright capture with timeouts and safe fallback.
- `backend/src/security/favicon.py`: favicon hash from data URI (and optional remote fetch toggle).
- `backend/src/security/jarm.py`: best-effort TLS fingerprinting (JARM-like).
- `backend/src/api/*`: REST endpoints used by the UI.
