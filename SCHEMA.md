# Database Schema

Schema version is stored in `schema_version`.

## Tables

### schema_version
- id (int, PK, always 1)
- version (int)
- updated_at (timestamp)

### settings
- key (text, PK)
- value_encrypted (text)
- updated_at (timestamp)

### logs
- id (bigserial, PK)
- level (text)
- message (text)
- created_at (timestamp)

### jobs
- id (bigserial, PK)
- type (text)
- status (text) QUEUED/RUNNING/DONE/FAILED/SKIPPED
- payload (jsonb)
- lease_until (timestamp)
- attempts (int)
- last_error (text)
- created_at (timestamp)
- updated_at (timestamp)

### targets
- id (bigserial, PK)
- url (text)
- domain (text)
- ip (text)
- status (text) DONE/FAILED/SKIPPED/QUEUED/RUNNING
- reason (text)
- risk_score (int)
- redirect_chain (text)
- tags (text)
- dom_hash (text)
- headers_hash (text)
- headers_text (text)
- html_excerpt (text)
- html_path (text)
- favicon_hash (text)
- jarm (text)
- screenshot_path (text)
- screenshot_ahash (text)
- screenshot_phash (text)
- screenshot_dhash (text)
- screenshot_status (text)
- screenshot_reason (text)
- created_at (timestamp)
- updated_at (timestamp)

### assets
- id (bigserial, PK)
- target_id (bigint, FK)
- url (text)
- type (text) js/css/image
- md5 (text)
- sha256 (text)
- phash (text)
- ahash (text)
- status (text)
- created_at (timestamp)

### indicators
- id (bigserial, PK)
- target_id (bigint, FK)
- kind (text) email/phone/wallet
- value (text)
- created_at (timestamp)

### signatures
- id (bigserial, PK)
- name (text)
- pattern (text)
- target_field (text) html/headers/url/asset
- enabled (bool)
- created_at (timestamp)

### signature_matches
- id (bigserial, PK)
- target_id (bigint, FK)
- signature_id (bigint, FK)
- verified (bool)
- confidence (int)
- created_at (timestamp)

### hunts
- id (bigserial, PK)
- name (text)
- rule_type (text) fofa/urlscan/dork
- rule (text)
- ttl_seconds (int)
- delay_seconds (int)
- budget (int)
- enabled (bool)
- last_run_at (timestamp)
- created_at (timestamp)

### hunt_runs
- id (bigserial, PK)
- hunt_id (bigint, FK)
- trigger (text) manual/auto
- queued (int)
- warning (text)
- created_at (timestamp)

### alerts
- id (bigserial, PK)
- target_id (bigint, FK)
- kind (text)
- message (text)
- created_at (timestamp)

### alert_rules
- id (bigserial, PK)
- name (text)
- pattern (text)
- target_field (text) html/headers/url
- enabled (bool)
- created_at (timestamp)

### campaigns
- id (bigserial, PK)
- key (text)
- created_at (timestamp)

### campaign_members
- id (bigserial, PK)
- campaign_id (bigint, FK)
- target_id (bigint, FK)

### graph_nodes
- id (bigserial, PK)
- kind (text)
- value (text)
- created_at (timestamp)

### graph_edges
- id (bigserial, PK)
- from_node (bigint, FK)
- to_node (bigint, FK)
- kind (text)
- created_at (timestamp)

### iocs
- id (bigserial, PK)
- kind (text)
- value (text)
- target_id (bigint)
- url (text)
- domain (text)
- source (text)
- note (text)
- created_at (timestamp)

### yara_rules
- id (bigserial, PK)
- name (text)
- rule_text (text)
- target_field (text) html/asset
- enabled (bool)
- created_at (timestamp)

### yara_matches
- id (bigserial, PK)
- target_id (bigint, FK)
- asset_id (bigint, FK)
- rule_id (bigint, FK)
- verified (bool)
- confidence (int)
- created_at (timestamp)

### automations
- id (bigserial, PK)
- name (text)
- enabled (bool)
- trigger_type (text) manual/event/schedule
- trigger_config (jsonb)
- graph (jsonb)
- last_run_at (timestamp)
- created_at (timestamp)
- updated_at (timestamp)

### automation_runs
- id (bigserial, PK)
- automation_id (bigint, FK)
- status (text) RUNNING/DONE/FAILED
- reason (text)
- context (jsonb)
- log (jsonb)
- started_at (timestamp)
- finished_at (timestamp)

### urlscan_local
- id (bigserial, PK)
- target_id (bigint, FK)
- url (text)
- domain (text)
- ip (text)
- title (text)
- status (text)
- content_type (text)
- redirect_chain (text)
- dom_hash (text)
- headers_hash (text)
- favicon_hash (text)
- jarm (text)
- created_at (timestamp)

### urlscan_remote
- id (bigserial, PK)
- url (text)
- redirect_chain (text)
- result_url (text)
- created_at (timestamp)

## Views
- assets_view (compatibility view)

## Notes (plain language)
- `targets` is the main table. Each row is one scanned URL or discovered target.
- `dom_hash` and `headers_hash` are used to cluster similar pages.
- `favicon_hash` and `jarm` help link related infrastructure.
- `screenshot_*` columns store image hashes for similarity grouping.
- `urlscan_local` is a local search index for scans; it powers the Urlscan tab without external APIs.
- `urlscan_remote` caches redirect chains fetched from urlscan.io.
- `settings` stores encrypted values; the encryption key comes from `APP_SECRET_KEY`.
- `iocs` stores manually marked indicators with their related target context.
- `yara_rules` and `yara_matches` store YARA rules and their matches on HTML/assets.
- `automations` stores visual workflows (graph JSON) and trigger settings.
- `automation_runs` stores execution logs and outcomes.
