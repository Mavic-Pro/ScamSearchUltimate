import React from "react";
import ErrorBanner from "../components/ErrorBanner";
import { getLang, tr } from "../i18n";
import { safeGet, safePost } from "../utils/api";

interface Ioc {
  id: number;
  kind: string;
  value: string;
  target_id?: number | null;
  url?: string | null;
  domain?: string | null;
  source?: string | null;
  note?: string | null;
  created_at?: string | null;
}

export default function IocsTab() {
  const lang = getLang();
  const [iocs, setIocs] = React.useState<Ioc[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState("");
  const [kind, setKind] = React.useState("");
  const [value, setValue] = React.useState("");
  const [domain, setDomain] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [source, setSource] = React.useState("");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [format, setFormat] = React.useState("csv");
  const [targetId, setTargetId] = React.useState("");
  const [status, setStatus] = React.useState<string | null>(null);

  const load = async () => {
    setStatus(tr("Loading IOCs...", "Caricamento IOC...", lang));
    const qs = new URLSearchParams();
    if (kind) qs.set("kind", kind);
    if (value) qs.set("value", value);
    if (domain) qs.set("domain", domain);
    if (url) qs.set("url", url);
    if (source) qs.set("source", source);
    if (dateFrom) qs.set("date_from", dateFrom);
    if (dateTo) qs.set("date_to", dateTo);
    if (targetId) qs.set("target_id", targetId);
    const res = await safeGet<Ioc[]>(`/api/iocs?${qs.toString()}`);
    if (res.ok) {
      setIocs(res.data);
      setError(null);
      setStatus(tr(`Loaded ${res.data.length} IOCs.`, `Caricati ${res.data.length} IOC.`, lang));
    } else {
      setError(res.error);
      setStatus(res.error);
    }
  };

  const pushTaxii = async () => {
    const payload: Record<string, any> = {
      kind: kind || null,
      value: value || null,
      domain: domain || null,
      url: url || null,
      source: source || null,
      date_from: dateFrom || null,
      date_to: dateTo || null,
      target_id: targetId ? Number(targetId) : null
    };
    const res = await safePost<{ pushed: number; endpoint: string }>("/api/iocs/taxii/push", payload);
    if (res.ok) {
      setStatus(tr(`TAXII push OK. IOC: ${res.data.pushed}`, `TAXII push OK. IOC: ${res.data.pushed}`, lang));
      setError(null);
    } else {
      setStatus(null);
      setError(res.error);
    }
  };

  React.useEffect(() => {
    load();
  }, []);

  const filtered = iocs.filter((ioc) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      String(ioc.kind || "").toLowerCase().includes(q) ||
      String(ioc.value || "").toLowerCase().includes(q) ||
      String(ioc.domain || "").toLowerCase().includes(q) ||
      String(ioc.url || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="tab">
      <div className="tab-header">
        <h2>IOCs</h2>
        <p>{tr("Saved indicators of compromise (hash, URL, domain).", "Indicatori di compromissione salvati (hash, URL, dominio).", lang)}</p>
      </div>
      {error && <ErrorBanner message={error} onRepaired={load} />}
      <div className="panel">
        <div className="form-grid">
          <label>
            {tr("Filter (kind/value/domain/url)", "Filtro (kind/value/domain/url)", lang)}
            <input value={filter} onChange={(e) => setFilter(e.target.value)} />
          </label>
          <label>
            {tr("Kind", "Kind", lang)}
            <input value={kind} onChange={(e) => setKind(e.target.value)} />
          </label>
          <label>
            {tr("Value (hash)", "Valore (hash)", lang)}
            <input value={value} onChange={(e) => setValue(e.target.value)} />
          </label>
          <label>
            {tr("Domain", "Domain", lang)}
            <input value={domain} onChange={(e) => setDomain(e.target.value)} />
          </label>
          <label>
            URL
            <input value={url} onChange={(e) => setUrl(e.target.value)} />
          </label>
          <label>
            {tr("Source", "Source", lang)}
            <input value={source} onChange={(e) => setSource(e.target.value)} />
          </label>
          <label>
            {tr("Target ID", "Target ID", lang)}
            <input value={targetId} onChange={(e) => setTargetId(e.target.value)} />
          </label>
          <label>
            {tr("Date From (YYYY-MM-DD)", "Data da (YYYY-MM-DD)", lang)}
            <input value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label>
            {tr("Date To (YYYY-MM-DD)", "Data a (YYYY-MM-DD)", lang)}
            <input value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          <button onClick={load}>{tr("Reload", "Ricarica", lang)}</button>
          <label>
            {tr("Export Format", "Formato Export", lang)}
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
              <option value="stix">STIX 2.1</option>
              <option value="openioc">OpenIOC</option>
              <option value="misp">MISP JSON</option>
            </select>
          </label>
          <button
            className="secondary"
            onClick={() => {
              setStatus(tr("Starting export...", "Avvio export...", lang));
              const qs = new URLSearchParams();
              if (kind) qs.set("kind", kind);
              if (value) qs.set("value", value);
              if (domain) qs.set("domain", domain);
              if (url) qs.set("url", url);
              if (source) qs.set("source", source);
              if (dateFrom) qs.set("date_from", dateFrom);
              if (dateTo) qs.set("date_to", dateTo);
              if (targetId) qs.set("target_id", targetId);
              qs.set("format", format);
              window.open(`${import.meta.env.VITE_API_BASE || "http://localhost:8000"}/api/iocs/export?${qs.toString()}`, "_blank");
            }}
          >
            {tr("Export", "Export", lang)}
          </button>
          <button className="secondary" onClick={pushTaxii}>{tr("TAXII Push", "TAXII Push", lang)}</button>
        </div>
        {status && <div className="muted">{status}</div>}
      </div>
      <div className="panel">
        <div className="table">
          {filtered.map((ioc) => (
            <div key={ioc.id} className="row ioc-row">
              <span>#{ioc.id}</span>
              <span>{ioc.kind}</span>
              <span className="truncate">{ioc.domain || ioc.url || "-"}</span>
              <span className="hash-value truncate">{ioc.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
