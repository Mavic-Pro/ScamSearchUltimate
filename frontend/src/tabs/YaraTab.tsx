import React from "react";
import ErrorBanner from "../components/ErrorBanner";
import { getLang, tr } from "../i18n";
import { safeGet, safePost } from "../utils/api";

interface YaraRule {
  id: number;
  name: string;
  rule_text: string;
  target_field: string;
  enabled: boolean;
}

export default function YaraTab() {
  const lang = getLang();
  const [rules, setRules] = React.useState<YaraRule[]>([]);
  const [name, setName] = React.useState("");
  const [ruleText, setRuleText] = React.useState("");
  const [targetField, setTargetField] = React.useState("html");
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = React.useState("");
  const [aiReply, setAiReply] = React.useState<string | null>(null);
  const [aiStatus, setAiStatus] = React.useState<string | null>(null);

  const load = async () => {
    const res = await safeGet<YaraRule[]>("/api/yara");
    if (res.ok) {
      setRules(res.data);
      setError(null);
    } else {
      setError(res.error);
    }
  };

  React.useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    const res = await safePost<{ id: number }>("/api/yara", {
      name,
      rule_text: ruleText,
      target_field: targetField,
      enabled: true
    });
    if (res.ok) {
      setName("");
      setRuleText("");
      setStatus(tr("YARA rule saved.", "Regola YARA salvata.", lang));
      load();
    } else {
      setError(res.error);
    }
  };

  const runAiSuggest = async () => {
    if (!aiPrompt.trim()) return;
    setAiStatus(tr("AI suggestion running...", "Suggerimento AI in corso...", lang));
    const res = await safePost<{ reply?: string; data?: Partial<YaraRule> & { rule_text?: string } }>("/api/ai/task", {
      task: "yara_suggest",
      prompt: aiPrompt
    });
    if (res.ok) {
      const suggestion = res.data.data;
      if (suggestion?.name) setName(String(suggestion.name));
      if (suggestion?.target_field) setTargetField(String(suggestion.target_field));
      if (suggestion?.rule_text) setRuleText(String(suggestion.rule_text));
      setAiReply(res.data.reply || null);
      setAiStatus(null);
    } else {
      setAiStatus(res.error);
    }
  };

  return (
    <div className="tab">
      <div className="tab-header">
        <h2>YARA</h2>
        <p>{tr("YARA rules (html or asset). Requires yara-python installed.", "Regole YARA (html o asset). Richiede yara-python installato.", lang)}</p>
      </div>
      {error && <ErrorBanner message={error} onRepaired={load} />}
      <div className="panel">
        <div className="form-grid">
          <label>
            {tr("Name", "Nome", lang)}
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            {tr("Target", "Target", lang)}
            <select value={targetField} onChange={(e) => setTargetField(e.target.value)}>
              <option value="html">html</option>
              <option value="asset">asset</option>
            </select>
          </label>
          <label>
            {tr("Rule", "Regola", lang)}
            <textarea value={ruleText} onChange={(e) => setRuleText(e.target.value)} rows={6} />
          </label>
          <button onClick={handleCreate}>{tr("Add", "Aggiungi", lang)}</button>
          {status && <span className="status">{status}</span>}
        </div>
      </div>
      <div className="panel">
        <div className="table">
          {rules.map((rule) => (
            <div key={rule.id} className="row">
              <span>#{rule.id}</span>
              <span>{rule.name}</span>
              <span>{rule.target_field}</span>
              <span className="truncate">{rule.rule_text}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="panel">
        <h3>{tr("AI Assistant", "Assistente AI", lang)}</h3>
        <div className="form-grid">
          <label>
            {tr("Describe rule", "Descrivi la regola", lang)}
            <input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder={tr("e.g. detect wallet drainer scripts", "Es: rileva script wallet drainer", lang)} />
          </label>
          <button onClick={runAiSuggest} className="secondary">{tr("Suggest YARA", "Suggerisci YARA", lang)}</button>
        </div>
        <div className="row-actions">
          <button className="secondary" onClick={() => setAiPrompt(tr("detect obfuscated phishing javascript", "rileva javascript phishing offuscato", lang))}>
            {tr("Obfuscated JS", "JS Offuscato", lang)}
          </button>
          <button className="secondary" onClick={() => setAiPrompt(tr("detect wallet drainers", "rileva wallet drainer", lang))}>
            {tr("Wallet Drainer", "Wallet Drainer", lang)}
          </button>
        </div>
        {aiStatus && <div className="muted">{aiStatus}</div>}
        {aiReply && <div className="muted">{aiReply}</div>}
      </div>
    </div>
  );
}
