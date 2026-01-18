import React from "react";
import ErrorBanner from "../components/ErrorBanner";
import { safeGet, safePost } from "../utils/api";
import { getLang, tr } from "../i18n";

interface Alert {
  id: number;
  target_id: number;
  kind: string;
  message: string;
  url?: string;
  domain?: string;
}

export default function AlertsTab() {
  const lang = getLang();
  const [alerts, setAlerts] = React.useState<Alert[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = React.useState("");
  const [aiReply, setAiReply] = React.useState<string | null>(null);
  const [aiStatus, setAiStatus] = React.useState<string | null>(null);
  const [rules, setRules] = React.useState<Array<Record<string, any>>>([]);
  const [ruleName, setRuleName] = React.useState("");
  const [rulePattern, setRulePattern] = React.useState("");
  const [ruleField, setRuleField] = React.useState("html");

  const load = async () => {
    const res = await safeGet<Alert[]>("/api/alerts");
    if (res.ok) {
      setAlerts(res.data);
      setError(null);
    } else {
      setError(res.error);
    }
  };

  const loadRules = async () => {
    const res = await safeGet<Array<Record<string, any>>>("/api/alerts/rules");
    if (res.ok) {
      setRules(res.data);
    }
  };

  React.useEffect(() => {
    load();
    loadRules();
  }, []);

  const createRule = async () => {
    const res = await safePost<{ id: number }>("/api/alerts/rules", {
      name: ruleName,
      pattern: rulePattern,
      target_field: ruleField,
      enabled: true
    });
    if (res.ok) {
      setRuleName("");
      setRulePattern("");
      setStatus(tr("Alert rule saved.", "Regola alert salvata.", lang));
      loadRules();
    } else {
      setError(res.error);
    }
  };

  const runAi = async () => {
    setAiStatus(tr("AI analysis running...", "Analisi AI in corso...", lang));
    const res = await safePost<{ reply?: string }>("/api/ai/task", {
      task: "alerts_triage",
      prompt: aiPrompt || null,
      data: { alerts }
    });
    if (res.ok) {
      setAiReply(res.data.reply || "");
      setAiStatus(null);
    } else {
      setAiStatus(res.error);
    }
  };

  return (
    <div className="tab">
      <div className="tab-header">
        <h2>{tr("Alerts", "Alerts", lang)}</h2>
        <p>{tr("Alert history and optional webhook.", "Storico alert e webhook opzionale.", lang)}</p>
      </div>
      {error && <ErrorBanner message={error} onRepaired={load} />}
      <div className="panel">
        {status && <div className="muted">{status}</div>}
        <div className="table">
          {alerts.map((alert) => (
            <div key={alert.id} className="row alert-row">
              <span>#{alert.id}</span>
              <span>{alert.kind}</span>
              <span className="truncate">{alert.message}</span>
              <span className="truncate">{alert.domain || alert.url || "-"}</span>
              <div className="row-actions">
                {alert.target_id && (
                  <button
                    className="secondary"
                    onClick={() => {
                      localStorage.setItem("lab_target_id", String(alert.target_id));
                      window.dispatchEvent(
                        new CustomEvent("open-lab", { detail: { targetId: alert.target_id } })
                      );
                      setStatus(tr("Opening Lab for alert target.", "Apertura Lab per target alert.", lang));
                    }}
                  >
                    Apri Lab
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="panel">
        <h3>{tr("Alert Rules", "Regole Alert", lang)}</h3>
        <div className="form-grid">
          <label>
            {tr("Name", "Nome", lang)}
            <input value={ruleName} onChange={(e) => setRuleName(e.target.value)} />
          </label>
          <label>
            {tr("Pattern", "Pattern", lang)}
            <input value={rulePattern} onChange={(e) => setRulePattern(e.target.value)} />
          </label>
          <label>
            {tr("Target", "Target", lang)}
            <select value={ruleField} onChange={(e) => setRuleField(e.target.value)}>
              <option value="html">html</option>
              <option value="headers">headers</option>
              <option value="url">url</option>
            </select>
          </label>
          <button onClick={createRule}>{tr("Add", "Aggiungi", lang)}</button>
        </div>
        <div className="table">
          {rules.map((rule) => (
            <div key={rule.id} className="row">
              <span>#{rule.id}</span>
              <span>{rule.name}</span>
              <span>{rule.target_field}</span>
              <span className="truncate">{rule.pattern}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="panel">
        <h3>{tr("AI Triage", "Triage AI", lang)}</h3>
        <div className="form-grid">
          <label>
            {tr("Optional prompt", "Prompt opzionale", lang)}
            <input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder={tr("e.g. group by severity", "Es: raggruppa per severita'", lang)} />
          </label>
          <button onClick={runAi} className="secondary">{tr("Analyze Alerts", "Analizza alert", lang)}</button>
        </div>
        <div className="row-actions">
          <button className="secondary" onClick={() => setAiPrompt(tr("highlight critical alerts", "evidenzia alert critici", lang))}>
            {tr("Critical First", "Critici Prima", lang)}
          </button>
          <button className="secondary" onClick={() => setAiPrompt(tr("suggest next actions", "suggerisci azioni", lang))}>
            {tr("Next Actions", "Prossime Azioni", lang)}
          </button>
        </div>
        {aiStatus && <div className="muted">{aiStatus}</div>}
        {aiReply && <div className="muted">{aiReply}</div>}
      </div>
    </div>
  );
}
