import React from "react";
import { getLang, tr } from "../i18n";
import { API_BASE, safePost } from "../utils/api";

export default function ExportTab() {
  const lang = getLang();
  const [iocKind, setIocKind] = React.useState("");
  const [iocValue, setIocValue] = React.useState("");
  const [iocDomain, setIocDomain] = React.useState("");
  const [iocUrl, setIocUrl] = React.useState("");
  const [iocSource, setIocSource] = React.useState("");
  const [iocTargetId, setIocTargetId] = React.useState("");
  const [iocDateFrom, setIocDateFrom] = React.useState("");
  const [iocDateTo, setIocDateTo] = React.useState("");
  const [iocFormat, setIocFormat] = React.useState("csv");
  const [status, setStatus] = React.useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = React.useState("");
  const [aiReply, setAiReply] = React.useState<string | null>(null);
  const [aiStatus, setAiStatus] = React.useState<string | null>(null);
  const [deltaSince, setDeltaSince] = React.useState<string | null>(() => localStorage.getItem("last_ioc_export"));

  const buildIocQuery = () => {
    const qs = new URLSearchParams();
    if (iocKind) qs.set("kind", iocKind);
    if (iocValue) qs.set("value", iocValue);
    if (iocDomain) qs.set("domain", iocDomain);
    if (iocUrl) qs.set("url", iocUrl);
    if (iocSource) qs.set("source", iocSource);
    if (iocTargetId) qs.set("target_id", iocTargetId);
    if (iocDateFrom) qs.set("date_from", iocDateFrom);
    if (iocDateTo) qs.set("date_to", iocDateTo);
    qs.set("format", iocFormat);
    return qs.toString();
  };

  const buildDeltaQuery = () => {
    if (!deltaSince) return buildIocQuery();
    const qs = new URLSearchParams(buildIocQuery());
    qs.set("date_from", deltaSince);
    return qs.toString();
  };

  const taxiiPush = async () => {
    const res = await safePost<{ pushed: number; endpoint: string }>("/api/iocs/taxii/push", {
      kind: iocKind || null,
      value: iocValue || null,
      domain: iocDomain || null,
      url: iocUrl || null,
      source: iocSource || null,
      target_id: iocTargetId ? Number(iocTargetId) : null,
      date_from: iocDateFrom || null,
      date_to: iocDateTo || null
    });
    if (res.ok) {
      setStatus(tr(`TAXII push OK. IOC: ${res.data.pushed}`, `TAXII push OK. IOC: ${res.data.pushed}`, lang));
    } else {
      setStatus(tr(`TAXII push failed: ${res.error}`, `TAXII push fallito: ${res.error}`, lang));
    }
  };

  const runAi = async () => {
    setAiStatus(tr("AI analysis running...", "Analisi AI in corso...", lang));
    const res = await safePost<{ reply?: string }>("/api/ai/task", {
      task: "export_helper",
      prompt: aiPrompt || null,
      data: {
        kind: iocKind || null,
        value: iocValue || null,
        domain: iocDomain || null,
        url: iocUrl || null,
        source: iocSource || null,
        target_id: iocTargetId || null,
        date_from: iocDateFrom || null,
        date_to: iocDateTo || null,
        format: iocFormat
      }
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
        <h2>{tr("Export", "Export", lang)}</h2>
        <p>{tr("Download results and IOCs with filters and advanced formats.", "Scarica risultati e IOC con filtri e formati avanzati.", lang)}</p>
      </div>
      <div className="panel">
        <div className="export-actions">
          <a
            className="button"
            href={`${API_BASE}/api/export/csv`}
            onClick={() => setStatus(tr("CSV export started.", "Export CSV avviato.", lang))}
          >
            {tr("Download CSV", "Download CSV", lang)}
          </a>
          <a
            className="button"
            href={`${API_BASE}/api/export/graph`}
            onClick={() => setStatus(tr("Graph export started.", "Export grafo avviato.", lang))}
          >
            {tr("Download Graph JSON", "Download Graph JSON", lang)}
          </a>
        </div>
        {status && <div className="muted">{status}</div>}
      </div>
      <div className="panel">
        <h3>{tr("Export IOC", "Export IOC", lang)}</h3>
        <div className="form-grid">
          <label>
            {tr("Kind", "Kind", lang)}
            <input value={iocKind} onChange={(e) => setIocKind(e.target.value)} />
          </label>
          <label>
            {tr("Value (hash)", "Valore (hash)", lang)}
            <input value={iocValue} onChange={(e) => setIocValue(e.target.value)} />
          </label>
          <label>
            {tr("Domain", "Domain", lang)}
            <input value={iocDomain} onChange={(e) => setIocDomain(e.target.value)} />
          </label>
          <label>
            URL
            <input value={iocUrl} onChange={(e) => setIocUrl(e.target.value)} />
          </label>
          <label>
            {tr("Source", "Source", lang)}
            <input value={iocSource} onChange={(e) => setIocSource(e.target.value)} />
          </label>
          <label>
            {tr("Target ID", "Target ID", lang)}
            <input value={iocTargetId} onChange={(e) => setIocTargetId(e.target.value)} />
          </label>
          <label>
            {tr("Date From (YYYY-MM-DD)", "Data da (YYYY-MM-DD)", lang)}
            <input value={iocDateFrom} onChange={(e) => setIocDateFrom(e.target.value)} />
          </label>
          <label>
            {tr("Date To (YYYY-MM-DD)", "Data a (YYYY-MM-DD)", lang)}
            <input value={iocDateTo} onChange={(e) => setIocDateTo(e.target.value)} />
          </label>
          <label>
            {tr("Format", "Formato", lang)}
            <select value={iocFormat} onChange={(e) => setIocFormat(e.target.value)}>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
              <option value="stix">STIX 2.1</option>
              <option value="openioc">OpenIOC</option>
              <option value="misp">MISP JSON</option>
            </select>
          </label>
          <a
            className="button secondary"
            href={`${API_BASE}/api/iocs/export?${buildIocQuery()}`}
            onClick={() => {
              setStatus(tr("IOC export started.", "Export IOC avviato.", lang));
              const now = new Date().toISOString().slice(0, 10);
              localStorage.setItem("last_ioc_export", now);
              setDeltaSince(now);
            }}
          >
            {tr("Export IOC", "Export IOC", lang)}
          </a>
          <a
            className="button secondary"
            href={`${API_BASE}/api/iocs/export?${buildDeltaQuery()}`}
            onClick={() => {
              if (!deltaSince) {
                setStatus(tr("No previous export found.", "Nessun export precedente trovato.", lang));
                return;
              }
              setStatus(tr(`Delta export since ${deltaSince}.`, `Export delta dal ${deltaSince}.`, lang));
              const now = new Date().toISOString().slice(0, 10);
              localStorage.setItem("last_ioc_export", now);
              setDeltaSince(now);
            }}
          >
            {tr("Export IOC Delta", "Export IOC Delta", lang)}
          </a>
          <button className="secondary" onClick={taxiiPush}>{tr("TAXII Push", "TAXII Push", lang)}</button>
        </div>
        <div className="row-actions">
          <button
            className="secondary"
            onClick={() => {
              setIocFormat("stix");
              setIocKind("domain");
              setStatus(tr("Template: STIX domains", "Template: STIX domini", lang));
            }}
          >
            {tr("Template STIX Domains", "Template STIX Domini", lang)}
          </button>
          <button
            className="secondary"
            onClick={() => {
              setIocFormat("misp");
              setIocKind("url");
              setStatus(tr("Template: MISP URLs", "Template: MISP URL", lang));
            }}
          >
            {tr("Template MISP URLs", "Template MISP URL", lang)}
          </button>
        </div>
        {status && <div className="muted">{status}</div>}
      </div>
      <div className="panel">
        <h3>{tr("AI Export Helper", "Assistente AI Export", lang)}</h3>
        <div className="form-grid">
          <label>
            {tr("Optional prompt", "Prompt opzionale", lang)}
            <input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder={tr("e.g. best format for sharing", "Es: formato migliore per condivisione", lang)} />
          </label>
          <button onClick={runAi} className="secondary">{tr("Get Suggestions", "Ottieni suggerimenti", lang)}</button>
        </div>
        <div className="row-actions">
          <button className="secondary" onClick={() => setAiPrompt(tr("best format for TAXII sharing", "miglior formato per TAXII", lang))}>
            {tr("TAXII Format", "Formato TAXII", lang)}
          </button>
          <button className="secondary" onClick={() => setAiPrompt(tr("minimize false positives", "riduci falsi positivi", lang))}>
            {tr("Reduce FP", "Riduci FP", lang)}
          </button>
        </div>
        {aiStatus && <div className="muted">{aiStatus}</div>}
        {aiReply && <div className="muted">{aiReply}</div>}
      </div>
    </div>
  );
}
