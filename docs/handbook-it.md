# ScamHunter Ultimate Handbook (IT) - Guida Completa

Questa guida spiega passo a passo tutto il tool, in modo semplice. Ogni funzione e' descritta con cosa serve, come usarla, e cosa aspettarti.

---

## 0) Cos'e ScamHunter Ultimate (spiegazione semplice)

ScamHunter Ultimate e' una web app difensiva per:
- trovare siti scam/phishing;
- capire se sono collegati tra loro;
- raccogliere indicatori (email, telefoni, wallet);
- creare firme regex;
- ricevere alert;
- vedere un grafo con relazioni;
- esportare i risultati.

Pensa al tool come a un radar che cerca siti sospetti e poi li raggruppa per somiglianza.

---

## 0.0) Novita recenti
- Redirect chain in Urlscan/Lab con salvataggio IOC.
- AI Chat con piu Target ID e pivot suggeriti.
- Auto-run hunt con log scheduler e playbook.
- Timeline e diff in Lab.
- Health check e notifiche update.

## 0.1) Glossario base (parole semplici)

- **URL**: l'indirizzo completo di una pagina web, ad esempio `https://example.com/login`.
- **Dominio**: la parte principale del sito, ad esempio `example.com`.
- **IP**: il numero che identifica il server su internet, ad esempio `93.184.216.34`.
- **Hash**: una "impronta digitale" di un contenuto. Se due contenuti sono simili, spesso hanno hash simili.
- **Regex**: una regola testuale per trovare frasi o pattern. Serve per creare firme.
- **JARM**: un'impronta del server TLS (sicurezza HTTPS) utile per collegare infrastrutture.
- **Dork**: una query per motori di ricerca (es. Google/Bing/DDG) per trovare pagine specifiche.
- **FOFA**: un motore di ricerca di infrastrutture esposte su internet.
- **urlscan**: un servizio che analizza pagine web e restituisce dati tecnici.
- **TTL**: quanto a lungo una caccia (hunt) deve continuare.
- **Budget**: quanti risultati massimi accettare in una hunt.

---

## 1) Come avviare l'app (passo a passo)
Scarica docker per il tuo sistema operativo :)

1. Apri una shell nella repo.
2. Avvia tutto:
   - `docker compose up --build`
3. Apri il frontend:
   - `http://localhost:5173`
4. Se vedi errori nelle tab, premi **Ripara DB**.

Se hai un errore tipo "connection refused", controlla:
- `docker compose ps`
- se backend e frontend sono in esecuzione.

---

## 1.1) Guida rapida in 60 secondi

1. Apri `http://localhost:5173`.
2. Vai su **Settings** e salva la `APP_SECRET_KEY`.
3. Vai su **Scan** e inserisci `https://example.com`.
4. Controlla la **Queue**: deve andare su DONE.
5. Apri **Lab** e carica l'ultimo target.

---

## 2) Impostazioni (Settings) - Perche servono

Le API key servono per fare discovery su servizi esterni:
- FOFA: ricerca infrastrutture esposte (economico);
- SerpAPI: ricerche web per dork (gratuito fino a 250 query, poi economico);
- urlscan: ricerca e pivot su scansioni pubbliche (caro);
- AI: generazione regole/firme (opzionale- compatibile con AI locali e online).
- TAXII: invio IOC a un server TAXII (opzionale).
Altre impostazioni:
- update check (repo GitHub);
- auto-run hunt (scheduler);
- filtro confidenza match.

Come inserire le chiavi:
1. Vai su **Settings**.
2. Inserisci i valori (se li hai).
3. Premi **Salva**.
4. Le chiavi sono cifrate e salvate nel DB.

Se non metti una chiave, quella funzione resta OFF (nessun crash).

### 2.1) Chiave di cifratura (APP_SECRET_KEY)

Questa chiave serve a proteggere le API key salvate nel database.
Se non la imposti, l'app funziona, ma le chiavi potrebbero non rimanere valide dopo un riavvio.

Come crearla:
```bash
python - <<'PY'
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
PY
```
Metti il risultato nel file `.env` come `APP_SECRET_KEY=...`.

### 2.2) Favicon remoto (opzionale, con avviso)

Per default il tool NON scarica file non-HTML. Questo include le favicon remote.
Se abiliti l'opzione **REMOTE_FAVICON_ENABLED**, il tool puo' scaricare una favicon per calcolarne l'hash.
E' una scelta consapevole: abilitala solo se sai cosa stai facendo.

---

## 3) Scan (Tab Scan) - Cosa fa

Lo scan e' il cuore del tool. Puoi inserire:
- un URL diretto;
- una keyword\dork;
- una query FOFA.

Il sistema crea job in coda e li processa uno alla volta.

### 3.1 Scan manuale di un URL

1. Vai su **Scan**.
2. Campo URL: inserisci `https://example.com`.
3. Premi **Avvia Scan**.
4. Guarda la **Queue** e lo status.

Cosa succede dietro:
- se il contenuto non e' HTML, viene saltato (SKIPPED_FILE);
- se e' HTML, calcola hash DOM e headers;
- estrae indicatori;
- scarica asset JS/CSS (solo se sicuri);
- crea nodi e link nel grafo;
- crea/aggiorna campagne.
 - tenta lo screenshot (Playwright se abilitato).

### 3.2 Scan con keyword (discovery)

1. Campo Keyword: esempio `"paypal" login`.
2. Premi **Avvia Scan**.
3. Il tool usa SerpAPI + DuckDuckGo per trovare URL.
4. I risultati diventano job in coda.

### 3.3 Scan con FOFA

1. Campo FOFA Query.
2. Esempi reali di query usate spesso in difesa:
   - `title="login" && country="IT" && port="443"`
   - `body="password" && header="nginx"`
   - `favicon_hash="-247388890" && title="Wallet"`
   - `body="reset password" && country="US"`
3. Premi **Avvia Scan**.

---

## 4) Queue (coda lavori) - Cosa vedere

La Queue mostra:
- ID job;
- tipo (scan);
- stato (QUEUED, RUNNING, DONE, FAILED, SKIPPED);
- URL associato.

Se un job resta bloccato, il sistema fa requeue automatico.

---

## 5) Hunt (Tab Hunt) - Cosa fa

Hunt e' per regole ripetute nel tempo, con budget e TTL. Puoi abilitare auto-run e usare playbook.

Campi principali:
- **Nome**: etichetta regola;
- **Tipo**: fofa, urlscan, dork;
- **Regola**: la query;
- **TTL**: durata massima;
- **Delay**: intervallo tra loop;
- **Budget**: massimo risultati.

### 5.1 Dork (ricerca web)

Esempi semplici:
- `site:example.com "login"`
- `"Microsoft 365" "sign in" "account"`
- `"reset password" "portal"`
- `"slotnusa" "casino" "login"`

Esempio reale (scam fake casino):
- **Slotnusa** e' un finto casinò online che copia grafiche e testi di brand legittimi per ingannare utenti. Il dork sopra serve a trovare domini che usano il nome “slotnusa” insieme a parole tipiche come “casino” e “login”.

Passi:
1. Tipo: dork
2. Regola: inserisci query
3. **Avvia Hunt**

### 5.2 FOFA hunting

Esempi reali:
- `title="login" && country="FR" && body="secure"`
- `body="wallet connect" && port="443"`
- `cert="381691609147718260459780208541489433626802"`

Spiegazione: questa query FOFA cerca host che usano un certificato specifico. E' utile per trovare infrastrutture collegate tra loro. Qui l'esempio e' legato a #Lazarus / #APT38, un gruppo APT noto per attacchi finanziari e cybercrime sponsorizzato da interessi nordcoreani.

Passi:
1. Tipo: fofa
2. Regola: query
3. Avvia Hunt

### 5.3 urlscan hunting

Esempio:
- `domain:"example.com" AND page.title:"login"`

Passi:
1. Tipo: urlscan
2. Regola: query
3. Avvia Hunt

---

## 6) Campaigns (Tab Campaigns) - Cosa fa

Campaigns raggruppa siti simili:
- stesso DOM hash;
- stesso favicon hash;
- JARM simile;
- asset simili.

Come usarlo:
1. Vai su **Campaigns**.
2. Guarda la lista e il numero di membri.
3. Se un target e' in un cluster, indica una campagna attiva.

---

## 7) Lab (Tab Lab) - Cosa fa

Lab mostra il dettaglio di un target.

Passi:
1. Inserisci Target ID.
2. Premi **Carica**.
3. Vedi:
   - headers;
   - assets con hash;
   - indicatori estratti;
   - signature match;
   - redirect chain, timeline e diff.

Qui puoi decidere se il target e' SAFE o MALICIOUS (workflow interno).

---

## 8) Signatures (Tab Signatures) - Cosa fa

Le signatures sono regex che cercano pattern.

Campi:
- name: nome;
- pattern: regex;
- target_field: html/headers/url/asset.

Esempi reali:
- HTML login form: `<form[^>]+(login|signin)`
- Headers cookie O365: `set-cookie:.*ESTSAUTH`
- URL sospetto: `https?://[^/]+/secure/`
- Asset JS drainer: `eth_requestAccounts|wallet_switchEthereumChain`

Passi:
1. Crea signature.
2. Avvia scan.
3. Vedi match nel Lab.

---

## 9) YARA (Tab YARA) - Cosa fa

YARA serve per definire regole basate su pattern avanzati. E' utile per:
- trovare stringhe sospette in HTML;
- individuare script malevoli in JS/CSS.

Nota: richiede il pacchetto `yara-python` installato. Se non e' presente, le regole non vengono eseguite.

Passi:
1. Vai su **YARA**.
2. Inserisci nome, target (html/asset) e regola YARA completa.
3. Salva la regola.
4. Esegui uno scan e verifica i match in **Lab**.

---

## 10) Alerts (Tab Alerts) - Cosa fa

Alerts registra:
- rischio alto (risk score);
- match signature;
- nuovi collegamenti a campagne.
Puoi aggiungere regole alert personalizzate (regex).

Passi:
1. Vai su **Alerts**.
2. Controlla la lista.
3. Se vuoi, collega un webhook in futuro.

---

## 11) Urlscan Local (Tab Urlscan) - Cosa fa

Questa tab e' una "urlscan locale": non serve internet, usa i dati del tuo DB.

Cosa puoi fare:
- cercare per dominio, hash, IP, JARM o query testuale;
- vedere lo storico scansioni;
- esportare CSV dei risultati;
- usare i pivot (clic su hash o ip);
- vedere redirect chain e salvarle come IOC.

Passi:
1. Vai su **Urlscan**.
2. Inserisci un filtro (es. dominio o hash).
3. Premi **Cerca**.
4. Clicca su un risultato per vedere dettagli e pivot.

---

## 12) Graph (Tab Graph) - Cosa fa

Graph mostra relazioni tipo Maltego.

Passi:
1. Scegli il tipo nodo (domain/url/dom_hash).
2. Inserisci valore.
3. Premi **Espandi**.
4. Il grafo mostra nodi collegati.

---

## 13) Export (Tab Export) - Cosa fa

- **CSV**: lista risultati.
- **JSON graph**: nodi e edges.
- **IOC export**: CSV/JSON/STIX/OpenIOC/MISP con filtri.
- **TAXII push**: invio IOC a un server TAXII (se configurato).

Passi:
1. Vai su **Export**.
2. Clicca il bottone.
3. Scarica e condividi.

---

## 14) AI Chat (Tab AI) - Cosa fa

La chat AI e' opzionale. Se non imposti un provider, il sistema usa suggerimenti base.

Funzioni:
- genera regole FOFA/urlscan/dork;
- propone firme regex;
- evita campi inventati (JSON validato).
- supporta piu Target ID per confronto e pivot IOC.

Passi:
1. Vai su **AI Chat**.
2. Scrivi cosa vuoi trovare (es. "scam crypto wallet").
3. Premi **Genera**.
4. Se ti piace il risultato, clicca **Crea regola**.

---

Opzionale: puoi fornire il contesto del target (DOM completo + IOC salvati) per risposte piu' utili.

---

## 15) IOCs (Tab IOCs) - Cosa fa

Qui trovi gli indicatori che hai marcato (hash, URL, dominio).

Puoi:
- filtrare per kind, value, domain, url, source, date range;
- esportare in CSV/JSON/STIX/OpenIOC/MISP;
- fare TAXII push (se configurato).

---

## 16) Tour rapido delle tab (cosa cliccare)

1. **Scan**: inserisci URL e clicca **Avvia Scan**.
2. **Hunt**: crea regola (dork/fofa/urlscan) e **Avvia Hunt**.
3. **Urlscan**: cerca per dominio/hash/IP e usa i pivot.
4. **Lab**: carica target ID e leggi dettagli.
5. **Campaigns**: controlla cluster e membri.
6. **Signatures**: crea regex e usa la ricerca DB.
7. **Alerts**: verifica alert e storico.
8. **Graph**: espandi nodi per relazioni.
9. **Export**: scarica CSV e JSON grafo.
10. **YARA**: salva regole YARA.
11. **AI Chat**: genera regole e crea con un click.
12. **IOCs**: filtra ed esporta.
13. **Settings**: salva chiavi e opzioni.

---

## 17) Errori comuni (spiegati semplice)

- **Failed to fetch**: frontend non raggiunge backend.
  - Soluzione: avvia backend e controlla `docker compose ps`.
- **SKIPPED_FILE**: il contenuto non e' HTML.
  - Soluzione: normale, e' una protezione.
- **Ripara DB**: serve a ricreare schema DB se rotto.

---

## 18) Troubleshooting avanzato (passi chiari)

- **Failed to fetch**: il frontend non raggiunge il backend.
  - Soluzione: `docker compose ps` e `docker compose logs -f backend`.
- **I pulsanti non fanno nulla**: backend non risponde o CORS.
  - Soluzione: apri `http://localhost:8000/` e controlla risposta `status: ok`.
- **Salvataggio Settings fallisce**: `APP_SECRET_KEY` mancante.
  - Soluzione: metti la chiave in `.env` e riavvia.
- **Screenshot mancante**: Playwright non attivo o fallito.
  - Soluzione: verifica `PLAYWRIGHT_ENABLED=1` e guarda `screenshot_reason` in Lab.

---

## 19) Scenari reali (passo a passo)

### Scenario A: Clone di login bancario

1. Scan con keyword: `"NomeBanca" login`.
2. Crea signature HTML form login.
3. Verifica in Lab.
4. Vedi Campaigns.

### Scenario B: Scam crypto wallet

1. Scan FOFA: `title="Connect Wallet" && body="wallet"`.
2. Signature asset JS: `eth_requestAccounts`.
3. Verifica hash asset e cluster.

### Scenario C: APT phishing HR

1. Dork: `"HR portal" "reset password"`.
2. Controlla indicatori email.
3. Espandi Graph per scoprire altri domini.

### Scenario D: BEC (Office/Google fake)

1. Keyword: `"Microsoft 365" login`.
2. Signature headers: `ESTSAUTH`.
3. Alert se rischio alto.

---

## 20) Checklist finale

- [ ] DB ok o riparato
- [ ] Settings salvati
- [ ] Scan completati
- [ ] Signatures attive
- [ ] Alerts controllati
- [ ] Campaigns analizzate
- [ ] Export effettuato
