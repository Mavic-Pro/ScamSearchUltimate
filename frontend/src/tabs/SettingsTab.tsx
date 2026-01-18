import React from "react";
import ErrorBanner from "../components/ErrorBanner";
import { safeGet, safePost } from "../utils/api";
import { getLang, tr } from "../i18n";

const KEYS = [
  "FOFA_EMAIL",
  "FOFA_KEY",
  "SERPAPI_KEY",
  "URLSCAN_KEY",
  "AI_ENDPOINT",
  "AI_KEY",
  "REMOTE_FAVICON_ENABLED",
  "TAXII_URL",
  "TAXII_COLLECTION",
  "TAXII_API_KEY"
];

export default function SettingsTab() {
  const lang = getLang();
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [showFaviconConfirm, setShowFaviconConfirm] = React.useState(false);
  const [keyStatus, setKeyStatus] = React.useState<string>("unknown");
  const [showKeyModal, setShowKeyModal] = React.useState(false);
  const [generatedKey, setGeneratedKey] = React.useState<string>("");

  const load = async () => {
    const next: Record<string, string> = {};
    for (const key of KEYS) {
      const res = await safeGet<{ key: string; value: string | null }>(`/api/settings/${key}`);
      if (res.ok) {
        next[key] = res.data.value || (key === "REMOTE_FAVICON_ENABLED" ? "0" : "");
      } else {
        setError(res.error);
      }
    }
    setValues(next);
    const keyRes = await safeGet<{ status: string }>("/api/settings/key-status");
    if (keyRes.ok) {
      setKeyStatus(keyRes.data.status);
    }
  };

  React.useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setStatus(tr("Saving...", "Salvataggio...", lang));
    for (const key of KEYS) {
      const res = await safePost(`/api/settings`, { key, value: values[key] || "" });
      if (!res.ok) {
        setError(res.error);
        setStatus(null);
        return;
      }
    }
    setStatus(tr("Saved", "Salvato", lang));
  };

  const generateKey = async () => {
    setStatus(tr("Generating key...", "Generazione chiave...", lang));
    const res = await safeGet<{ key: string }>("/api/settings/keygen");
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setGeneratedKey(res.data.key);
    setShowKeyModal(true);
    setStatus(tr("Key generated.", "Chiave generata.", lang));
  };

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(generatedKey);
    setStatus(tr("Key copied", "Chiave copiata", lang));
    } catch (err) {
      setError(tr("Unable to copy the key. Copy it manually.", "Impossibile copiare la chiave. Copiala manualmente.", lang));
    }
  };

  const resetDb = async () => {
    const ok = window.confirm(
      tr(
        "Reset the database? This removes scans, targets, and history but keeps API keys.",
        "Azzerare il database? Rimuove scansioni, target e storico ma mantiene le API key.",
        lang
      )
    );
    if (!ok) return;
    setStatus(tr("Resetting database...", "Reset database in corso...", lang));
    const res = await safePost("/api/db/reset", {});
    if (res.ok) {
      setStatus(tr("Database reset completed.", "Reset database completato.", lang));
    } else {
      setStatus(tr(`Reset failed: ${res.error}`, `Reset fallito: ${res.error}`, lang));
    }
  };

  return (
    <div className="tab">
      <div className="tab-header">
        <h2>{tr("Settings", "Settings", lang)}</h2>
        <p>{tr("API keys stored encrypted in DB (asked only once).", "API keys salvate in DB cifrato (richieste solo una volta).", lang)}</p>
      </div>
      {(keyStatus === "missing" || keyStatus === "invalid") && (
        <div className="warning-banner">
          <div>
            <strong>{tr("Warning:", "Attenzione:", lang)}</strong>{" "}
            {keyStatus === "missing"
              ? tr("APP_SECRET_KEY missing. Keys may not persist after restart.", "APP_SECRET_KEY mancante. Le chiavi potrebbero non persistere dopo un riavvio.", lang)
              : tr("APP_SECRET_KEY invalid. Encryption will fail until replaced.", "APP_SECRET_KEY non valida. La cifratura fallira' finche non la sostituisci.", lang)}
            <div className="muted">
              {tr("Generate a key and paste it into `.env`, then restart Docker.", "Genera una chiave e incollala in `.env`, poi riavvia Docker.", lang)}
            </div>
          </div>
          <div className="warning-actions">
            <button className="secondary" onClick={generateKey}>{tr("Generate key", "Genera chiave", lang)}</button>
          </div>
        </div>
      )}
      {error && <ErrorBanner message={error} onRepaired={load} />}
      <div className="panel">
        <div className="row-actions" style={{ marginBottom: "16px" }}>
          <div>
            <strong>APP_SECRET_KEY</strong>
            <div className="muted">
              {tr("Status:", "Stato:", lang)}{" "}
              {keyStatus === "ok"
                ? "OK"
                : keyStatus === "missing"
                ? tr("Missing", "Mancante", lang)
                : keyStatus === "invalid"
                ? tr("Invalid", "Non valida", lang)
                : tr("Unknown", "Sconosciuto", lang)}
            </div>
            <div className="muted">
              {tr(
                "The key cannot be saved by the browser: add it to `.env` and restart.",
                "La chiave non puo' essere salvata dal browser: va inserita in `.env` e richiede riavvio.",
                lang
              )}
            </div>
          </div>
          <button className="secondary" onClick={generateKey}>{tr("Generate key", "Genera chiave", lang)}</button>
        </div>
        <div className="row-actions" style={{ marginBottom: "16px" }}>
          <button className="secondary" onClick={resetDb}>
            {tr("Reset DB (keep keys)", "Reset DB (mantieni key)", lang)}
          </button>
          {status && <span className="status">{status}</span>}
        </div>
        <div className="form-grid">
          {KEYS.map((key) => (
            <label key={key}>
              {key}
              {key === "REMOTE_FAVICON_ENABLED" ? (
                <input
                  type="checkbox"
                  checked={values[key] === "1"}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setShowFaviconConfirm(true);
                      return;
                    }
                    setValues({ ...values, [key]: e.target.checked ? "1" : "0" });
                  }}
                />
              ) : (
                <input
                  value={values[key] || ""}
                  onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                />
              )}
            </label>
          ))}
          <button onClick={save}>{tr("Save", "Salva", lang)}</button>
          {status && <span className="status">{status}</span>}
        </div>
      </div>
      {showFaviconConfirm && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>{tr("Confirm", "Conferma", lang)}</h3>
            <p>
              {tr(
                "Enable favicon download from remote URLs? This bypasses the non-HTML block.",
                "Abilitare il download favicon da URL remoti? Questo bypassa il blocco sui file non-HTML.",
                lang
              )}
            </p>
            <div className="row-actions">
              <button
                onClick={() => {
                  setValues({ ...values, REMOTE_FAVICON_ENABLED: "1" });
                  setShowFaviconConfirm(false);
                }}
                className="secondary"
              >
                {tr("Enable", "Abilita", lang)}
              </button>
              <button onClick={() => setShowFaviconConfirm(false)}>{tr("Cancel", "Annulla", lang)}</button>
            </div>
          </div>
        </div>
      )}
      {showKeyModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>APP_SECRET_KEY</h3>
            <p>{tr("Copy this key and paste it into `.env`, then restart Docker.", "Copia questa chiave e incollala in `.env`, poi riavvia Docker.", lang)}</p>
            <div className="code-block">
              {generatedKey}
            </div>
            <div className="row-actions">
              <button className="secondary" onClick={copyKey}>{tr("Copy", "Copia", lang)}</button>
              <button onClick={() => setShowKeyModal(false)}>{tr("Close", "Chiudi", lang)}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
