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
    </div>
  );
}
