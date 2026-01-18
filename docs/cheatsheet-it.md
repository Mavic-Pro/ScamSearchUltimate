# ScamHunter Ultimate Cheat Sheet (IT)

Questa e' una guida super rapida (1 pagina) per usare il tool senza perdere tempo.

---

## Avvio rapido

```bash
cp .env.example .env
# (opzionale) genera chiave di cifratura
python3 - <<'PY'
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
PY

docker compose up --build
```

Apri `http://localhost:5173`.

---

## 3 casi d'uso principali (passi minimi)

### 1) Scan singolo sito
1. **Scan**: incolla URL (es. `https://example.com`).
2. **Avvia Scan**.
3. **Queue**: attendi DONE.
4. **Lab**: carica target e controlla hash/indicatori/screenshot.
5. **Lab**: usa i pivot (Blockcypher, CRT.sh, DomainsDB, Holehe) o lo spider manuale.

### 2) Dork hunting (ricerca su web)
1. **Hunt**: tipo `dork`.
2. Regola: es. `"slotnusa" "casino" "login"`.
3. **Avvia Hunt**.
4. **Queue**: controlla nuovi job.

### 3) FOFA hunting (infrastrutture esposte)
1. **Hunt**: tipo `fofa`.
2. Regola: `cert="381691609147718260459780208541489433626802"`.
3. **Avvia Hunt**.
4. **Campaigns**: controlla cluster per similitudini.

---

## Dove mettere le dork

- Le dork si usano **solo in Hunt**.
- Scan e' per URL, keyword, o query FOFA.
- I playbook sono in **Automazione**.

---

## Tab principali (1 riga ciascuna)

- **Scan**: crea job e fa lo scanning.
- **Hunt**: regole ripetute con TTL/budget + auto-run.
- **Urlscan**: ricerca locale su scansioni + redirect chain.
- **Lab**: dettagli target + timeline/diff.
- **Automazione**: playbook + workflow grafico.
- **Campaigns**: cluster di siti simili.
- **Signatures**: regex e ricerca DB.
- **Alerts**: eventi, storico e regole custom.
- **Graph**: relazioni stile Maltego.
- **Export**: CSV + JSON grafo.
- **AI Chat**: suggerimenti per regole/firme + pivot IOC (multi-target).
- **Settings**: chiavi, scheduler, health check, update.

---

## Troubleshooting veloce

- **Failed to fetch**: backend non raggiungibile -> `docker compose ps`.
- **Pulsanti non rispondono**: controlla `http://localhost:8000/`.
- **Settings non salva**: imposta `APP_SECRET_KEY` in `.env`.
- **Screenshot vuoto**: verifica `PLAYWRIGHT_ENABLED=1`.

---

## Export

- CSV: lista target
- JSON: grafo nodi/edges

---

## Note sicurezza

- Il tool non scarica file non-HTML.
- Se un URL non e' HTML, viene segnato `SKIPPED_FILE`.
