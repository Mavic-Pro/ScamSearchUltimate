import React from "react";
import ErrorBanner from "../components/ErrorBanner";
import { safeGet, safePost } from "../utils/api";
import { getLang, tr } from "../i18n";

interface Hunt {
  id: number;
  name: string;
  rule_type: string;
  rule: string;
  ttl_seconds: number;
  delay_seconds: number;
  budget: number;
  enabled: boolean;
  last_run_at?: string | null;
}

interface HuntRunResponse {
  queued: number[];
  warning?: string | null;
  debug?: Record<string, number>;
}

export default function HuntTab() {
  const lang = getLang();
  const [hunts, setHunts] = React.useState<Hunt[]>([]);
  const [name, setName] = React.useState("");
  const [ruleType, setRuleType] = React.useState("fofa");
  const [rule, setRule] = React.useState("");
  const [delaySeconds, setDelaySeconds] = React.useState(60);
  const [budget, setBudget] = React.useState(50);
  const [enabled, setEnabled] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [rowStatus, setRowStatus] = React.useState<Record<number, string>>({});
  const [aiPrompt, setAiPrompt] = React.useState("");
  const [aiReply, setAiReply] = React.useState<string | null>(null);
  const [aiStatus, setAiStatus] = React.useState<string | null>(null);
  const [queueNotice, setQueueNotice] = React.useState<string | null>(null);
  const queueTimer = React.useRef<number | null>(null);
  const [runs, setRuns] = React.useState<Array<Record<string, any>>>([]);
  // Playbooks moved to Automation tab.

  const loadHunts = async () => {
    const res = await safeGet<Hunt[]>("/api/hunt");
    if (res.ok) {
      setHunts(res.data);
      setError(null);
    } else {
      setError(res.error);
    }
  };

  const loadRuns = async () => {
    const res = await safeGet<Array<Record<string, any>>>("/api/hunt/runs");
    if (res.ok) {
      setRuns(res.data);
    }
  };

  React.useEffect(() => {
    loadHunts();
    loadRuns();
  }, []);

  const flashQueueNotice = (message: string) => {
    setQueueNotice(message);
    if (queueTimer.current) {
      window.clearTimeout(queueTimer.current);
    }
    queueTimer.current = window.setTimeout(() => setQueueNotice(null), 4000);
  };

  const handleCreate = async () => {
    const res = await safePost<{ id: number }>("/api/hunt", {
      name,
      rule_type: ruleType,
      rule,
      delay_seconds: delaySeconds,
      budget,
      enabled
    });
    if (res.ok) {
      setName("");
      setRule("");
      setStatus(tr("Rule saved.", "Regola salvata.", lang));
      loadHunts();
    } else {
      setError(res.error);
    }
  };

  const handleRun = async () => {
    const res = await safePost<HuntRunResponse>("/api/hunt/run", {
      name,
      rule_type: ruleType,
      rule,
      delay_seconds: delaySeconds,
      budget,
      enabled
    });
    if (res.ok) {
      const queued = res.data.queued?.length ?? 0;
      const warning = res.data.warning ? ` ${res.data.warning}` : "";
      const debug = res.data.debug
        ? ` [debug: ${Object.entries(res.data.debug)
            .map(([k, v]) => `${k}=${v}`)
            .join(", ")}]`
        : "";
      setStatus(
        queued > 0
          ? `${tr("Hunt started. Jobs queued:", "Hunt avviato. Job in coda:", lang)} ${queued}${debug}`
          : `${tr("No targets found. Check API keys and query.", "Nessun target trovato. Verifica API key e query.", lang)}${warning}${debug}`
      );
      setError(null);
      if (queued > 0) {
        flashQueueNotice(
          tr(
            `Queued ${queued} scan jobs.`,
            `Messi in coda ${queued} scan.`,
            lang
          )
        );
      }
      loadRuns();
    } else {
      setError(res.error);
      setStatus(null);
    }
  };

  // Playbooks moved to Automation tab.

  const handleRunSaved = async (huntId: number) => {
    const res = await safePost<HuntRunResponse>(`/api/hunt/run/${huntId}`, {});
    if (res.ok) {
      const queued = res.data.queued?.length ?? 0;
      const warning = res.data.warning ? ` ${res.data.warning}` : "";
      const debug = res.data.debug
        ? ` [debug: ${Object.entries(res.data.debug)
            .map(([k, v]) => `${k}=${v}`)
            .join(", ")}]`
        : "";
      const msg =
        queued > 0
          ? `${tr("Hunt started. Jobs queued:", "Hunt avviato. Job in coda:", lang)} ${queued}${debug}`
          : `${tr("No targets found. Check API keys and query.", "Nessun target trovato. Verifica API key e query.", lang)}${warning}${debug}`;
      setStatus(msg);
      setRowStatus((prev) => ({ ...prev, [huntId]: msg }));
      setError(null);
      if (queued > 0) {
        flashQueueNotice(
          tr(
            `Queued ${queued} scan jobs.`,
            `Messi in coda ${queued} scan.`,
            lang
          )
        );
      }
      loadRuns();
    } else {
      setError(res.error);
      setStatus(null);
    }
  };

  const handleLoadSaved = (hunt: Hunt) => {
    setName(hunt.name);
    setRuleType(hunt.rule_type);
    setRule(hunt.rule);
    setDelaySeconds(hunt.delay_seconds ?? 60);
    setBudget(hunt.budget ?? 50);
    setEnabled(Boolean(hunt.enabled));
    setStatus(tr("Rule loaded into fields.", "Regola caricata nei campi.", lang));
  };

  const runAiSuggest = async () => {
    if (!aiPrompt.trim()) return;
    setAiStatus(tr("AI suggestion running...", "Suggerimento AI in corso...", lang));
    const res = await safePost<{ reply?: string; data?: Partial<Hunt> }>("/api/ai/task", {
      task: "hunt_suggest",
      prompt: aiPrompt
    });
    if (res.ok) {
      const suggestion = res.data.data;
      if (suggestion?.name) setName(String(suggestion.name));
      if (suggestion?.rule_type) setRuleType(String(suggestion.rule_type));
      if (suggestion?.rule) setRule(String(suggestion.rule));
      if (suggestion?.delay_seconds) setDelaySeconds(Number(suggestion.delay_seconds));
      if (suggestion?.budget) setBudget(Number(suggestion.budget));
      if (suggestion?.enabled !== undefined) setEnabled(Boolean(suggestion.enabled));
      if (suggestion?.ttl_seconds) setStatus(`${tr("TTL:", "TTL:", lang)} ${suggestion.ttl_seconds}`);
      setAiReply(res.data.reply || null);
      setAiStatus(null);
    } else {
      setAiStatus(res.error);
    }
  };

  return (
    <div className="tab">
      <div className="tab-header">
        <h2>{tr("Hunt", "Hunt", lang)}</h2>
        <p>{tr("Automatic and manual rules with budget and scheduling.", "Regole automatiche e manuali con budget e scheduling.", lang)}</p>
        <div className="muted">
          {tr("Playbooks moved to Automation.", "Playbook spostati in Automazione.", lang)}
        </div>
      </div>
      {error && <ErrorBanner message={error} onRepaired={loadHunts} />}
      <div className="panel">
        <div className="form-grid">
          <label>
            {tr("Name", "Nome", lang)}
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            {tr("Type", "Tipo", lang)}
            <select value={ruleType} onChange={(e) => setRuleType(e.target.value)}>
              <option value="fofa">FOFA</option>
              <option value="urlscan">urlscan</option>
              <option value="dork">dork</option>
            </select>
          </label>
          <label>
            {tr("Rule", "Regola", lang)}
            <input value={rule} onChange={(e) => setRule(e.target.value)} />
          </label>
          <label>
            {tr("Auto-run interval (sec)", "Intervallo auto-run (sec)", lang)}
            <input
              type="number"
              min={10}
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(Number(e.target.value))}
            />
          </label>
          <label>
            {tr("Budget (max URLs)", "Budget (max URL)", lang)}
            <input
              type="number"
              min={1}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
            />
          </label>
          <label>
            {tr("Enabled", "Abilitato", lang)}
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          </label>
          <button onClick={handleCreate}>{tr("Save Rule", "Salva Regola", lang)}</button>
          <button onClick={handleRun} className="secondary">{tr("Run Hunt", "Avvia Hunt", lang)}</button>
          {status && <span className="status">{status}</span>}
        </div>
        {queueNotice && <div className="warning-banner">{queueNotice}</div>}
      </div>
      <div className="panel">
        <h3>{tr("Rules", "Regole", lang)}</h3>
        <div className="table">
          {hunts.map((hunt) => (
            <div key={hunt.id} className="row">
              <span>#{hunt.id}</span>
              <span>{hunt.name}</span>
              <span>{hunt.rule_type}</span>
              <span>{hunt.rule}</span>
              <span className="hash-value">{hunt.last_run_at || "-"}</span>
              <div className="row-actions">
                <button onClick={() => handleLoadSaved(hunt)}>{tr("Load", "Carica", lang)}</button>
                <button onClick={() => handleRunSaved(hunt.id)} className="secondary">{tr("Run", "Avvia", lang)}</button>
                {rowStatus[hunt.id] && <span className="row-status">{rowStatus[hunt.id]}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="panel">
        <h3>{tr("Scheduler Log", "Log Scheduler", lang)}</h3>
        <div className="table">
          {runs.map((run) => (
            <div key={run.id} className="row">
              <span>#{run.id}</span>
              <span>{run.name || run.hunt_id}</span>
              <span>{run.trigger}</span>
              <span>{run.queued}</span>
              <span className="truncate">{run.warning || "-"}</span>
              <span className="hash-value">{run.created_at || "-"}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="panel">
        <h3>{tr("AI Assistant", "Assistente AI", lang)}</h3>
        <div className="form-grid">
          <label>
            {tr("Goal", "Obiettivo", lang)}
            <input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder={tr("e.g. bank login phishing", "Es: phishing login bancario", lang)} />
          </label>
          <button onClick={runAiSuggest} className="secondary">{tr("Suggest Rule", "Suggerisci regola", lang)}</button>
        </div>
        <div className="row-actions">
          <button className="secondary" onClick={() => setAiPrompt(tr("brand login phishing in Italy", "phishing login brand in Italia", lang))}>
            {tr("Brand Login", "Brand Login", lang)}
          </button>
          <button className="secondary" onClick={() => setAiPrompt(tr("crypto wallet connect drainer", "drainer wallet crypto connect", lang))}>
            {tr("Wallet Drainer", "Wallet Drainer", lang)}
          </button>
        </div>
      {aiStatus && <div className="muted">{aiStatus}</div>}
      {aiReply && <div className="muted">{aiReply}</div>}
      </div>
    </div>
  );
}
