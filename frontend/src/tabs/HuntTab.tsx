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
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [rowStatus, setRowStatus] = React.useState<Record<number, string>>({});

  const loadHunts = async () => {
    const res = await safeGet<Hunt[]>("/api/hunt");
    if (res.ok) {
      setHunts(res.data);
      setError(null);
    } else {
      setError(res.error);
    }
  };

  React.useEffect(() => {
    loadHunts();
  }, []);

  const handleCreate = async () => {
    const res = await safePost<{ id: number }>("/api/hunt", {
      name,
      rule_type: ruleType,
      rule
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
      rule
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
    } else {
      setError(res.error);
      setStatus(null);
    }
  };

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
    } else {
      setError(res.error);
      setStatus(null);
    }
  };

  const handleLoadSaved = (hunt: Hunt) => {
    setName(hunt.name);
    setRuleType(hunt.rule_type);
    setRule(hunt.rule);
    setStatus(tr("Rule loaded into fields.", "Regola caricata nei campi.", lang));
  };

  return (
    <div className="tab">
      <div className="tab-header">
        <h2>{tr("Hunt", "Hunt", lang)}</h2>
        <p>{tr("Automatic and manual rules with budget and scheduling.", "Regole automatiche e manuali con budget e scheduling.", lang)}</p>
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
          <button onClick={handleCreate}>{tr("Save Rule", "Salva Regola", lang)}</button>
          <button onClick={handleRun} className="secondary">{tr("Run Hunt", "Avvia Hunt", lang)}</button>
          {status && <span className="status">{status}</span>}
        </div>
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
              <div className="row-actions">
                <button onClick={() => handleLoadSaved(hunt)}>{tr("Load", "Carica", lang)}</button>
                <button onClick={() => handleRunSaved(hunt.id)} className="secondary">{tr("Run", "Avvia", lang)}</button>
                {rowStatus[hunt.id] && <span className="row-status">{rowStatus[hunt.id]}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
