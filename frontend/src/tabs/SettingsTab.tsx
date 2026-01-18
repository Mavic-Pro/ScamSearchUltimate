import React from "react";
import ErrorBanner from "../components/ErrorBanner";
import { safeGet, safePost } from "../utils/api";
import { getLang, tr } from "../i18n";

const KEYS = [
  "FOFA_EMAIL",
  "FOFA_KEY",
  "BLOCKCYPHER_TOKEN",
  "SERPAPI_KEY",
  "URLSCAN_KEY",
  "AI_PROVIDER",
  "AI_ENDPOINT",
  "AI_KEY",
  "AI_MODEL",
  "HUNT_AUTORUN_ENABLED",
  "HUNT_AUTORUN_POLL_SECONDS",
  "AUTOMATION_AUTORUN_ENABLED",
  "AUTOMATION_AUTORUN_POLL_SECONDS",
  "CONFIDENCE_MIN",
  "REMOTE_FAVICON_ENABLED",
  "TAXII_URL",
  "TAXII_COLLECTION",
  "TAXII_API_KEY"
];

const AI_PROVIDERS = [
  { value: "openai", label: "OpenAI", endpoint: "https://api.openai.com" },
  { value: "gemini", label: "Gemini", endpoint: "https://generativelanguage.googleapis.com" },
  { value: "nexos", label: "Nexos.AI", endpoint: "https://api.nexos.ai" },
  { value: "claude", label: "Claude (Anthropic)", endpoint: "https://api.anthropic.com" },
  { value: "ollama", label: "Ollama (local)", endpoint: "http://localhost:11434" },
  { value: "custom", label: "Custom", endpoint: "" }
];

const AI_TASKS = [
  { value: "scan_queue_summary", label: "Scan queue summary" },
  { value: "hunt_suggest", label: "Hunt suggest" },
  { value: "urlscan_cluster", label: "Urlscan cluster" },
  { value: "campaigns_summary", label: "Campaigns summary" },
  { value: "lab_analysis", label: "Lab analysis" },
  { value: "signatures_suggest", label: "Signatures suggest" },
  { value: "yara_suggest", label: "YARA suggest" },
  { value: "alerts_triage", label: "Alerts triage" },
  { value: "iocs_prioritize", label: "IOCs prioritize" },
  { value: "graph_insights", label: "Graph insights" },
  { value: "export_helper", label: "Export helper" }
];

const getTaskDefaults = (task: string) => {
  switch (task) {
    case "hunt_suggest":
      return { prompt: "bank login phishing", data: null };
    case "signatures_suggest":
      return { prompt: "detect fake Microsoft login", data: null };
    case "yara_suggest":
      return { prompt: "detect wallet drainer scripts", data: null };
    case "urlscan_cluster":
      return { prompt: null, data: { local: [], remote: [], stats: { dom: {}, headers: {} } } };
    case "campaigns_summary":
      return { prompt: null, data: { campaigns: [] } };
    case "lab_analysis":
      return {
        prompt: "highlight phishing indicators",
        data: { target: { url: "https://example.com" }, indicators: [], assets: [], matches: [], yara: [] }
      };
    case "alerts_triage":
      return { prompt: null, data: { alerts: [] } };
    case "iocs_prioritize":
      return { prompt: null, data: { iocs: [] } };
    case "graph_insights":
      return { prompt: null, data: { nodes: [], edges: [], selected: null } };
    case "export_helper":
      return {
        prompt: "best format for sharing",
        data: {
          kind: null,
          value: null,
          domain: null,
          url: null,
          source: null,
          target_id: null,
          date_from: null,
          date_to: null,
          format: "csv"
        }
      };
    case "scan_queue_summary":
    default:
      return { prompt: null, data: { jobs: [] } };
  }
};

const getDefaultEndpoint = (provider: string) =>
  AI_PROVIDERS.find((item) => item.value === provider)?.endpoint || "";

const inferProvider = (endpoint: string) => {
  const normalized = endpoint.toLowerCase();
  if (normalized.includes("anthropic.com")) return "claude";
  if (normalized.includes("generativelanguage.googleapis.com")) return "gemini";
  if (normalized.includes("nexos.ai")) return "nexos";
  if (normalized.includes("localhost:11434") || normalized.includes("127.0.0.1:11434")) return "ollama";
  if (normalized.includes("openai.com")) return "openai";
  return "custom";
};

const getEndpointWarning = (endpoint: string) => {
  const normalized = endpoint.toLowerCase().trim();
  if (!normalized) return "";
  if (normalized.includes("/models") || normalized.includes("/chat/completions")) {
    return "full_path";
  }
  return "";
};

export default function SettingsTab() {
  const lang = getLang();
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [showFaviconConfirm, setShowFaviconConfirm] = React.useState(false);
  const [keyStatus, setKeyStatus] = React.useState<string>("unknown");
  const [showKeyModal, setShowKeyModal] = React.useState(false);
  const [generatedKey, setGeneratedKey] = React.useState<string>("");
  const [aiTestStatus, setAiTestStatus] = React.useState<string | null>(null);
  const [aiTaskTestStatus, setAiTaskTestStatus] = React.useState<string | null>(null);
  const [aiTaskName, setAiTaskName] = React.useState("scan_queue_summary");
  const [storageAudit, setStorageAudit] = React.useState<{ path: string; size_bytes: number; files: number } | null>(null);
  const [keyHealth, setKeyHealth] = React.useState<Record<string, any> | null>(null);
  const [healthStatus, setHealthStatus] = React.useState<string | null>(null);

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
    if (!next.AI_PROVIDER) {
      const inferred = inferProvider(next.AI_ENDPOINT || "");
      next.AI_PROVIDER = inferred;
      if (!next.AI_ENDPOINT && inferred !== "custom") {
        next.AI_ENDPOINT = getDefaultEndpoint(inferred);
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

  const handleProviderChange = (provider: string) => {
    setValues((prev) => {
      const prevProvider = prev.AI_PROVIDER || "custom";
      const prevDefault = getDefaultEndpoint(prevProvider);
      const nextDefault = getDefaultEndpoint(provider);
      const next: Record<string, string> = { ...prev, AI_PROVIDER: provider };
      const usingDefault = !prev.AI_ENDPOINT || prev.AI_ENDPOINT === prevDefault;
      if (usingDefault) {
        next.AI_ENDPOINT = nextDefault;
      }
      if (provider === "custom" && prev.AI_ENDPOINT === prevDefault) {
        next.AI_ENDPOINT = "";
      }
      return next;
    });
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

  const testAi = async () => {
    setAiTestStatus(tr("Testing AI endpoint...", "Test endpoint AI in corso...", lang));
    const res = await safePost<{ reply?: string }>("/api/ai/chat", {
      messages: [{ role: "user", content: "ping" }]
    });
    if (res.ok) {
      setAiTestStatus(tr("AI OK.", "AI OK.", lang));
    } else {
      setAiTestStatus(tr(`AI error: ${res.error}`, `Errore AI: ${res.error}`, lang));
    }
  };

  const testAiTask = async () => {
    setAiTaskTestStatus(tr("Testing AI tasks...", "Test task AI in corso...", lang));
    const defaults = getTaskDefaults(aiTaskName);
    const res = await safePost<{ reply?: string }>("/api/ai/task", {
      task: aiTaskName,
      prompt: defaults.prompt,
      data: defaults.data
    });
    if (res.ok) {
      setAiTaskTestStatus(tr("AI task OK.", "Task AI OK.", lang));
    } else {
      setAiTaskTestStatus(tr(`AI task error: ${res.error}`, `Errore task AI: ${res.error}`, lang));
    }
  };

  const loadStorageAudit = async () => {
    const res = await safeGet<{ path: string; size_bytes: number; files: number }>("/api/settings/storage-audit");
    if (res.ok) {
      setStorageAudit(res.data);
    }
  };

  const loadKeyHealth = async (mode: "config" | "live" = "config") => {
    setHealthStatus(tr("Checking keys...", "Verifica key...", lang));
    const res = await safeGet<Record<string, any>>(`/api/settings/key-health?mode=${mode}`);
    if (res.ok) {
      setKeyHealth(res.data);
      setHealthStatus(null);
    } else {
      setHealthStatus(res.error);
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
          <label>
            {tr("AI Provider", "Provider AI", lang)}
            <select value={values.AI_PROVIDER || "custom"} onChange={(e) => handleProviderChange(e.target.value)}>
              {AI_PROVIDERS.map((provider) => (
                <option key={provider.value} value={provider.value}>
                  {provider.label}
                </option>
              ))}
            </select>
            <div className="muted">
              {tr("Pick a provider or leave Custom to set your own endpoint.", "Seleziona un provider o lascia Custom per usare un endpoint personalizzato.", lang)}
            </div>
          </label>
          <label>
            {tr("AI Endpoint (base URL)", "AI Endpoint (base URL)", lang)}
            <input
              value={values.AI_ENDPOINT || ""}
              placeholder={getDefaultEndpoint(values.AI_PROVIDER || "custom") || "https://..."}
              onChange={(e) => setValues({ ...values, AI_ENDPOINT: e.target.value })}
            />
            <div className="muted">
              {tr("Leave blank to use the default endpoint for the selected provider.", "Lascia vuoto per usare l'endpoint predefinito del provider selezionato.", lang)}
            </div>
            {getEndpointWarning(values.AI_ENDPOINT || "") === "full_path" && (
              <div className="muted">
                {tr(
                  "Warning: use the base URL only (e.g. https://api.openai.com or /v1). Do not include /models or /chat/completions.",
                  "Attenzione: usa solo la base URL (es. https://api.openai.com o /v1). Non includere /models o /chat/completions.",
                  lang
                )}
              </div>
            )}
          </label>
          <label>
            AI_KEY
            <input
              value={values.AI_KEY || ""}
              onChange={(e) => setValues({ ...values, AI_KEY: e.target.value })}
            />
            <div className="muted">
              {tr("Gemini/Claude require a key. Ollama typically does not.", "Gemini/Claude richiedono una chiave. Ollama di solito no.", lang)}
            </div>
          </label>
          <label>
            AI_MODEL
            <input
              value={values.AI_MODEL || ""}
              onChange={(e) => setValues({ ...values, AI_MODEL: e.target.value })}
            />
            <div className="muted">
              {tr("Optional. Leave blank to use provider defaults.", "Opzionale. Lascia vuoto per usare i default del provider.", lang)}
            </div>
          </label>
          <label>
            {tr("Hunt Auto-run", "Auto-run Hunt", lang)}
            <input
              type="checkbox"
              checked={values.HUNT_AUTORUN_ENABLED === "1"}
              onChange={(e) => setValues({ ...values, HUNT_AUTORUN_ENABLED: e.target.checked ? "1" : "0" })}
            />
            <div className="muted">
              {tr("Runs enabled hunts automatically.", "Esegue automaticamente le hunt abilitate.", lang)}
            </div>
          </label>
          <label>
            {tr("Hunt Auto-run Poll (sec)", "Poll Auto-run Hunt (sec)", lang)}
            <input
              type="number"
              min={5}
              value={values.HUNT_AUTORUN_POLL_SECONDS || "10"}
              onChange={(e) => setValues({ ...values, HUNT_AUTORUN_POLL_SECONDS: e.target.value })}
            />
            <div className="muted">
              {tr("Worker checks scheduled hunts on this interval.", "Il worker controlla le hunt programmate a questo intervallo.", lang)}
            </div>
          </label>
          <label>
            {tr("Automation Auto-run", "Auto-run Automazioni", lang)}
            <input
              type="checkbox"
              checked={values.AUTOMATION_AUTORUN_ENABLED === "1"}
              onChange={(e) => setValues({ ...values, AUTOMATION_AUTORUN_ENABLED: e.target.checked ? "1" : "0" })}
            />
            <div className="muted">
              {tr("Runs scheduled automations automatically.", "Esegue automaticamente le automazioni programmate.", lang)}
            </div>
          </label>
          <label>
            {tr("Automation Poll (sec)", "Poll Automazioni (sec)", lang)}
            <input
              type="number"
              min={5}
              value={values.AUTOMATION_AUTORUN_POLL_SECONDS || "10"}
              onChange={(e) => setValues({ ...values, AUTOMATION_AUTORUN_POLL_SECONDS: e.target.value })}
            />
            <div className="muted">
              {tr("Worker checks scheduled automations on this interval.", "Il worker controlla le automazioni programmate a questo intervallo.", lang)}
            </div>
          </label>
          <label>
            {tr("Min Confidence (matches)", "Confidenza min (match)", lang)}
            <input
              type="number"
              min={0}
              max={100}
              value={values.CONFIDENCE_MIN || "0"}
              onChange={(e) => setValues({ ...values, CONFIDENCE_MIN: e.target.value })}
            />
            <div className="muted">
              {tr("Default filter for signature/YARA matches.", "Filtro predefinito per match firma/YARA.", lang)}
            </div>
          </label>
          {KEYS.filter((key) => !["AI_PROVIDER", "AI_ENDPOINT", "AI_KEY", "AI_MODEL", "HUNT_AUTORUN_ENABLED", "HUNT_AUTORUN_POLL_SECONDS", "AUTOMATION_AUTORUN_ENABLED", "AUTOMATION_AUTORUN_POLL_SECONDS", "CONFIDENCE_MIN"].includes(key)).map((key) => (
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
          <button onClick={testAi} className="secondary">{tr("Test AI", "Test AI", lang)}</button>
          <label>
            {tr("Task", "Task", lang)}
            <select value={aiTaskName} onChange={(e) => setAiTaskName(e.target.value)}>
              {AI_TASKS.map((task) => (
                <option key={task.value} value={task.value}>
                  {task.label}
                </option>
              ))}
            </select>
          </label>
          <button onClick={testAiTask} className="secondary">{tr("Test AI Tasks", "Test Task AI", lang)}</button>
          {status && <span className="status">{status}</span>}
          {aiTestStatus && <span className="status">{aiTestStatus}</span>}
          {aiTaskTestStatus && <span className="status">{aiTaskTestStatus}</span>}
        </div>
      </div>
      <div className="panel">
        <h3>{tr("System Health", "Salute Sistema", lang)}</h3>
        <div className="row-actions">
          <button className="secondary" onClick={() => loadKeyHealth("config")}>{tr("Check API keys", "Verifica API key", lang)}</button>
          <button className="secondary" onClick={() => loadKeyHealth("live")}>{tr("Test API keys", "Test API key", lang)}</button>
          <button className="secondary" onClick={loadStorageAudit}>{tr("Storage audit", "Audit storage", lang)}</button>
          {healthStatus && <span className="status">{healthStatus}</span>}
        </div>
        {keyHealth && (
          <div className="table">
            {Object.entries(keyHealth).map(([key, info]) => (
              <div key={key} className="row">
                <span>{key}</span>
                <span>{info.status}</span>
                <span className="truncate">{info.message || "-"}</span>
              </div>
            ))}
          </div>
        )}
        {storageAudit && (
          <div className="muted">
            {tr("Storage", "Storage", lang)}: {storageAudit.path} | {storageAudit.files} files | {Math.round(storageAudit.size_bytes / 1024 / 1024)} MB
          </div>
        )}
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
