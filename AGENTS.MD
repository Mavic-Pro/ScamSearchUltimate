Titolo progetto

ScamHunter Ultimate

Linguaggio/stack richiesto

Backend: Python 3.11 + FastAPI

DB: PostgreSQL 16

Frontend: React + TypeScript (Vite), dark mode

Worker separato (processo separato) per jobs queue

Playwright opzionale con fallback automatico su requests+bs4

Obiettivo

Costruire una web app production-grade “ScamHunter Ultimate” per scanning/hunting/detection difensiva di siti scam/phishing con:

scan batch + discovery (SerpAPI/FOFA/DDG/urlscan)

hunting con regole, scheduling, budget/TTL/delay, pivot FOFA/urlscan, reverse IP

clustering “campaigns”

lab dettaglio target con screenshot (se sicuro), asset hashes, indicators estratti, tagging SAFE/MALICIOUS

signatures regex configurabili

alerts + webhook + storico

graph stile Maltego con espansione per nodi

export CSV risultati + JSON graph

AI opzionale (Ollama/openai-compatible/nexos) per generare query/regole/firme e per ridurre falsi positivi

VINCOLI CRITICI (NON NEGOZIABILI)

Fornire intera codebase (struttura cartelle + tutti i file) generata nella repo.

Nessuna tab UI deve crashare all’avvio, anche con DB Postgres “vecchio” o schema rotto → fail-safe.

Implementare VALIDATORE DI SCHEMA DB:

verifica tabelle/colonne/indici/view + schema_version

migrazione automatica additiva se possibile

se schema inconsistente → backup (dump/rename schema) e ricreazione pulita

Tutte le tab UI fail-safe:

try/except su tutte le chiamate API lato FE

mostra errore leggibile + bottone “Ripara DB” (chiama endpoint)

MAI stack trace non gestiti in UI

SICUREZZA:

NON scaricare file target non HTML (pdf/doc/zip/exe/img/video ecc.)

se target non HTML → skip con motivazione, salva stato SKIPPED_FILE

DNS/timeout:

nessuna risoluzione DNS o richiesta deve bloccare l’app

timeouts hard ovunque + budget per loop hunting

Streamlit: NON USATO (abbiamo React). Ma applica principi equivalenti:

evitare key duplicate in liste

niente output log “in loop” che sovrascrive; usa LogPanel unico FE

Compatibilità: Windows/macOS, Playwright opzionale con fallback

API key:

chiedere solo la prima volta (UI Settings)

salvarle persistenti (DB settings secrets cifrate)

non richiederle ogni avvio

Mantenere tutte le funzionalità richieste (tabs e features sotto)

FUNZIONALITÀ OBBLIGATORIE PER TAB
TAB SCAN

input manuale: URL, keyword, FOFA query

discovery tramite: SerpAPI (Google/Bing/Yandex), FOFA, duckduckgo, urlscan

coda scan (queue) visibile

batch processing

skip automatico file pericolosi

AI (quando disponibile) genera query a partire dall’input utente (output JSON valido)

TAB HUNT

regole FOFA/urlscan/dorks automatiche e manuali

scheduling/loop controllato (TTL, delay, budget)

reverse IP → domini

pivot FOFA (ip, jarm, favicon_hash, cert, body)

pivot urlscan

disabilitare automaticamente regole inefficienti (metriche + soglie)

estrazione telefoni/email/identificativi dalle pagine

TAB CAMPAIGNS

clustering per: asset hash, favicon hash, DOM hash, image similarity, JARM

visualizzazione campagne

TAB LAB

dettaglio sito: headers, screenshot (se sicuro), assets con hash cliccabili

indicators estratti (email/wallet/telefoni)

link esterni

marcatura MALEVOLO/SICURO

TAB SIGNATURES

firme regex configurabili

target_field: html, headers, url, asset

enable/disable

ricerca regex nel DB

TAB ALERTS

alert su: risk >= soglia, firma match, nuovo collegamento campagna

webhook opzionale

storico trigger

TAB GRAPH

vista grafo stile Maltego

nodi: domini, IP, ASN, wallet, email, hash, JARM, campaign

click nodo → espansione/ricerca DB

TAB EXPORT

CSV risultati

JSON grafo

AI (OPZIONALE)

provider: Ollama locale + endpoint OpenAI-compatible + nexos.AI

generazione (sempre JSON valido):

regole FOFA (anche JARM-based)

regole urlscan

dorks basate su testi ripetuti

firme regex

AI non inventa campi inesistenti; validare schema JSON

DETTAGLI TECNICI OBBLIGATORI
A) Filtraggio target

se URL termina con estensioni pericolose → SKIP

se content-type != text/html → SKIP

salvare stato “SKIPPED_FILE”

B) Hashing

DOM hash

headers hash

asset JS/CSS: md5 + sha256

immagini: phash/ahash

screenshot: ahash/phash/dhash

C) FOFA

qbase64 corretto

nessuna esclusione forzata (Cloudflare/Google solo toggle utente)

supporto after/before

normalizzazione URL

D) Queue & Jobs

sistema jobs su Postgres

stati: QUEUED/RUNNING/DONE/FAILED/SKIPPED

lease + requeue stuck → mai rimanere bloccati

E) Database

schema canonico unico + versioning

migrazioni automatiche additive

VIEW compatibilità per vecchie tabelle (es: assets)

nessuna tab crasha per colonna mancante

F) Logging

LogPanel FE unico (poll API /logs/tail)

backend scrive logs su tabella logs

niente print spam; buffer/limit; rate limit

ARCHITETTURA RICHIESTA (separazione netta)

Repo:

backend/src/api/ router FastAPI (controller)

backend/src/core/ logica business (scan/hunt/campaigns/signatures/alerts/graph)

backend/src/db/ schema/validator/dao (SQL parametrizzato)

backend/src/jobs/ queue + worker runner

backend/src/security/ safe fetch, target filter, secrets encryption

backend/src/utils/ helpers (api envelope, errors, time, logging)

frontend/ React TS, tabs e componenti

tools/selfcheck.py obbligatorio

docker-compose.yml Postgres+backend+frontend

Naming:

file: kebab-case nel frontend, snake_case nel backend

componenti React: PascalCase

funzioni TS: camelCase, no implicit any

REGOLE DI SICUREZZA (CODICE)

SQL sempre parametrizzato

timeouts e rate limit ovunque

mai scaricare non-HTML

evitare blocchi DNS: usare client con timeout e (se serve) threadpool/async

Playwright solo se abilitato e con timeout; fallback a requests

DELIVERABLE OBBLIGATORI (OUTPUT REPO)

Piano step-by-step nel README

Documentazione architettura (ARCHITECTURE.md)

Schema DB dettagliato (SCHEMA.md)

Codebase completa (tutti i file)

README con esempi FOFA difensivi reali + workflow completo

tools/selfcheck.py che:

importa tutto

valida schema e migra

crea DB temporaneo o usa DB test

esegue scan minimo su https://example.com

exit 1 se qualcosa fallisce

MODALITÀ DI LAVORO PER CODEX (IMPORTANTISSIMO)

Lavora in repo vuota. Crea file e cartelle come da architettura.

Prima scrivi schema DB + validator + queue/jobs, poi scan pipeline, poi UI.

Ogni feature deve avere test essenziale (pytest backend, vitest frontend minimal).

Non chiedere conferma ad ogni passaggio: procedi e poi esegui test.

Non lasciare placeholder: tutto deve girare “end-to-end” almeno per scan minimo.

Provider esterni (FOFA/SerpAPI/urlscan/AI) sono consigliati ma facoltativi:

se key mancante → feature disabilitata, UI mostra OFF, nessun crash.

PIANO DI ESECUZIONE (che Codex deve seguire)

Inizializza repo + file base (README, docker, env example)

Implementa DB schema + validator + migrazioni + backup schema rotto

Implementa secrets cifrate e settings

Implementa jobs queue + worker separato + lease/requeue stuck

Implementa safe fetch + target filter + content-type gate

Implementa scan pipeline:

page save + hashing

identifiers extraction + AI anti-FP optional

assets hashing (JS/CSS) e external links

Implementa graph materialization + API expand + export graph.json

Implementa hunt engine + providers optional + loop budgets

Implementa signatures + matching + search

Implementa alerts + webhook optional + history

Implementa campaigns clustering (dom hash/favicon hash/image similarity/JARM) + UI

Implementa frontend tabs tutte + LogPanel unico + ErrorBanner “Ripara DB”

Scrivi tools/selfcheck.py + tests + CI minimale

Esegui: backend tests, frontend build/test, selfcheck

Solo se tutto passa: “DONE”

COMANDI DI TEST CHE CODEX DEVE ESEGUIRE PRIMA DI FINIRE

python -m compileall backend/src tools

pytest -q

docker compose build

python tools/selfcheck.py (o in container)

cd frontend && npm i && npm run build

Se uno fallisce, Codex deve fixare e riprovare finché passa.

NOTE UI

Dark mode default

LogPanel unico con polling /api/logs/tail

Ogni tab mostra errori gestiti + bottone Ripara DB

Niente stack trace all’utente

OUTPUT FINALE ATTESO

Repo pronta, eseguibile con:

docker compose up --build


e tools/selfcheck.py deve passare.