import React from "react";
import ErrorBanner from "../components/ErrorBanner";
import { safeGet, safePost } from "../utils/api";
import { getLang, tr } from "../i18n";

interface Signature {
  id: number;
  name: string;
  pattern: string;
  target_field: string;
  enabled: boolean;
}

export default function SignaturesTab() {
  const lang = getLang();
  const [list, setList] = React.useState<Signature[]>([]);
  const [name, setName] = React.useState("");
  const [pattern, setPattern] = React.useState("");
  const [targetField, setTargetField] = React.useState("html");
  const [error, setError] = React.useState<string | null>(null);
  const [searchPattern, setSearchPattern] = React.useState("");
  const [searchField, setSearchField] = React.useState("html");
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [status, setStatus] = React.useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = React.useState("");
  const [aiReply, setAiReply] = React.useState<string | null>(null);
  const [aiStatus, setAiStatus] = React.useState<string | null>(null);

  const load = async () => {
    const res = await safeGet<Signature[]>("/api/signatures");
    if (res.ok) {
      setList(res.data);
      setError(null);
    } else {
      setError(res.error);
    }
  };

  React.useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    setStatus(tr("Saving signature...", "Salvataggio firma...", lang));
    const res = await safePost<{ id: number }>("/api/signatures", {
      name,
      pattern,
      target_field: targetField,
      enabled: true
    });
    if (res.ok) {
      setName("");
      setPattern("");
      setStatus(tr("Signature saved.", "Firma salvata.", lang));
      load();
    } else {
      setError(res.error);
      setStatus(res.error);
    }
  };

  const runSearch = async (patternValue: string, fieldValue: string) => {
    setStatus(tr("Searching signatures...", "Ricerca firme...", lang));
    const res = await safePost<{ results: any[] }>("/api/signatures/search", {
      pattern: patternValue,
      target_field: fieldValue
    });
    if (res.ok) {
      setSearchResults(res.data.results || []);
      setStatus(tr(`Found ${res.data.results?.length ?? 0} results.`, `Trovati ${res.data.results?.length ?? 0} risultati.`, lang));
    } else {
      setError(res.error);
      setStatus(res.error);
    }
  };

  const handleSearch = async () => {
    await runSearch(searchPattern, searchField);
  };

  React.useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const pattern = detail.pattern ? String(detail.pattern) : "";
      const target = detail.targetField ? String(detail.targetField) : "html";
      if (!pattern) return;
      setSearchPattern(pattern);
      setSearchField(target);
      runSearch(pattern, target);
    };
    window.addEventListener("open-signatures", handler);
    return () => window.removeEventListener("open-signatures", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runAiSuggest = async () => {
    if (!aiPrompt.trim()) return;
    setAiStatus(tr("AI suggestion running...", "Suggerimento AI in corso...", lang));
    const res = await safePost<{ reply?: string; data?: Partial<Signature> }>("/api/ai/task", {
      task: "signatures_suggest",
      prompt: aiPrompt
    });
    if (res.ok) {
      const suggestion = res.data.data;
      if (suggestion?.name) setName(String(suggestion.name));
      if (suggestion?.pattern) setPattern(String(suggestion.pattern));
      if (suggestion?.target_field) setTargetField(String(suggestion.target_field));
      setAiReply(res.data.reply || null);
      setAiStatus(null);
    } else {
      setAiStatus(res.error);
    }
  };

  return (
    <div className="tab">
      <div className="tab-header">
        <h2>{tr("Signatures", "Signatures", lang)}</h2>
        <p>{tr("Regex signatures for html/headers/url/asset.", "Firme regex configurabili per html/headers/url/asset.", lang)}</p>
      </div>
      {error && <ErrorBanner message={error} onRepaired={load} />}
      <div className="panel">
        <div className="form-grid">
          <label>
            {tr("Name", "Nome", lang)}
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            {tr("Pattern", "Pattern", lang)}
            <input value={pattern} onChange={(e) => setPattern(e.target.value)} />
          </label>
          <label>
            {tr("Target", "Target", lang)}
            <select value={targetField} onChange={(e) => setTargetField(e.target.value)}>
              <option value="html">html</option>
              <option value="headers">headers</option>
              <option value="url">url</option>
              <option value="asset">asset</option>
            </select>
          </label>
          <button onClick={handleCreate}>{tr("Add", "Aggiungi", lang)}</button>
          {status && <span className="status">{status}</span>}
        </div>
      </div>
      <div className="panel">
        <div className="table">
          {list.map((sig) => (
            <div key={sig.id} className="row">
              <span>#{sig.id}</span>
              <span>{sig.name}</span>
              <span>{sig.target_field}</span>
              <span>{sig.pattern}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="panel">
        <h3>{tr("Regex Search", "Regex Search", lang)}</h3>
        <div className="form-grid">
          <label>
            {tr("Pattern", "Pattern", lang)}
            <input value={searchPattern} onChange={(e) => setSearchPattern(e.target.value)} />
          </label>
          <label>
            {tr("Target", "Target", lang)}
            <select value={searchField} onChange={(e) => setSearchField(e.target.value)}>
              <option value="html">html</option>
              <option value="headers">headers</option>
              <option value="url">url</option>
              <option value="asset">asset</option>
            </select>
          </label>
          <button onClick={handleSearch}>{tr("Search", "Cerca", lang)}</button>
        </div>
        {searchResults.length > 0 && (
          <div className="table">
            {searchResults.map((row, idx) => (
              <div key={row.id ?? idx} className="row search-row">
                <span>#{row.id ?? "-"}</span>
                <span className="truncate">{row.domain || row.target_domain || "-"}</span>
                <span className="truncate">{row.url || row.target_url || "-"}</span>
                <span className="hash-value">{row.md5 || row.sha256 || "-"}</span>
                <div className="row-actions">
                  <button
                    className="secondary"
                    onClick={() => {
                      const targetId = row.target_id || row.id;
                      if (!targetId) return;
                      localStorage.setItem("lab_target_id", String(targetId));
                      window.dispatchEvent(new CustomEvent("open-lab", { detail: { targetId } }));
                    }}
                  >
                    Apri Lab
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="panel">
        <h3>{tr("AI Assistant", "Assistente AI", lang)}</h3>
        <div className="form-grid">
          <label>
            {tr("Describe signature", "Descrivi la firma", lang)}
            <input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder={tr("e.g. detect fake Microsoft login", "Es: rileva falso login Microsoft", lang)} />
          </label>
          <button onClick={runAiSuggest} className="secondary">{tr("Suggest Signature", "Suggerisci firma", lang)}</button>
        </div>
        {aiStatus && <div className="muted">{aiStatus}</div>}
        {aiReply && <div className="muted">{aiReply}</div>}
      </div>
    </div>
  );
}
