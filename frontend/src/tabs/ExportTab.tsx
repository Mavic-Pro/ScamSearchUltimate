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
            onClick={() => setStatus(tr("IOC export started.", "Export IOC avviato.", lang))}
          >
            {tr("Export IOC", "Export IOC", lang)}
          </a>
          <button className="secondary" onClick={taxiiPush}>{tr("TAXII Push", "TAXII Push", lang)}</button>
        </div>
        {status && <div className="muted">{status}</div>}
      </div>
    </div>
  );
}
