import React from "react";
import ErrorBanner from "../components/ErrorBanner";
import { getLang, tr } from "../i18n";
import { safePost } from "../utils/api";

interface UrlscanResponse {
  local: Array<Record<string, string | number>>;
  remote: string[];
  warning?: string | null;
}

export default function UrlscanTab() {
  const lang = getLang();
  const [query, setQuery] = React.useState("");
  const [domain, setDomain] = React.useState("");
  const [domHash, setDomHash] = React.useState("");
  const [headersHash, setHeadersHash] = React.useState("");
  const [ip, setIp] = React.useState("");
  const [jarm, setJarm] = React.useState("");
  const [faviconHash, setFaviconHash] = React.useState("");
  const [data, setData] = React.useState<UrlscanResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [iocStatus, setIocStatus] = React.useState<string | null>(null);
  const [stats, setStats] = React.useState<{
    dom: Record<string, { count: number; sample_domain?: string; sample_url?: string }>;
    headers: Record<string, { count: number; sample_domain?: string; sample_url?: string }>;
  } | null>(null);
  const [history, setHistory] = React.useState<string[]>(() => {
    const raw = localStorage.getItem("urlscan_history");
    return raw ? JSON.parse(raw) : [];
  });

  const run = async () => {
    const res = await safePost<UrlscanResponse>("/api/urlscan/search", {
      query: query || null,
      domain: domain || null,
      dom_hash: domHash || null,
      headers_hash: headersHash || null,
      ip: ip || null,
      jarm: jarm || null,
      favicon_hash: faviconHash || null
    });
    if (res.ok) {
      setData(res.data);
      setError(null);
      const localCount = res.data.local?.length ?? 0;
      const remoteCount = res.data.remote?.length ?? 0;
      setStatus(
        tr(
          `Local: ${localCount} | Urlscan: ${remoteCount}`,
          `Locali: ${localCount} | Urlscan: ${remoteCount}`,
          lang
        )
      );
      const dom: Record<string, { count: number; sample_domain?: string; sample_url?: string }> = {};
      const headers: Record<string, { count: number; sample_domain?: string; sample_url?: string }> = {};
      res.data.local.forEach((row) => {
        if (row.dom_hash) {
          const key = String(row.dom_hash);
          if (!dom[key]) {
            dom[key] = { count: 0, sample_domain: String(row.domain || ""), sample_url: String(row.url || "") };
          }
          dom[key].count += 1;
        }
        if (row.headers_hash) {
          const key = String(row.headers_hash);
          if (!headers[key]) {
            headers[key] = { count: 0, sample_domain: String(row.domain || ""), sample_url: String(row.url || "") };
          }
          headers[key].count += 1;
        }
      });
      setStats({ dom, headers });
      if (query) {
        const next = [query, ...history.filter((q) => q !== query)].slice(0, 10);
        setHistory(next);
        localStorage.setItem("urlscan_history", JSON.stringify(next));
      }
    } else {
      setError(res.error);
    }
  };

  React.useEffect(() => {
    if (!domHash && !headersHash) return;
    run();
  }, [domHash, headersHash]);

  const queueScan = async (url: string) => {
    const res = await safePost<{ queued: number[] }>("/api/scan", { url });
    if (res.ok) {
      setStatus(tr(`Scan queued for ${url}`, `Scan in coda per ${url}`, lang));
    } else {
      setError(res.error);
    }
  };

  const exportCsv = () => {
    if (!data) return;
    const rows = data.local.map((row) => [
      row.id ?? "",
      row.url ?? "",
      row.domain ?? "",
      row.title ?? "",
      row.dom_hash ?? "",
      row.headers_hash ?? ""
    ]);
    const header = ["id", "url", "domain", "title", "dom_hash", "headers_hash"];
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "urlscan-local.csv";
    link.click();
  };

  const markIoc = async (kind: string, value: string, row: Record<string, string | number>) => {
    const res = await safePost<{ id: number }>("/api/iocs", {
      kind,
      value,
      source: "urlscan",
      target_id: row.target_id ?? row.id,
      url: row.url,
      domain: row.domain
    });
    if (res.ok) {
      setIocStatus(tr(`IOC saved (${kind})`, `IOC salvato (${kind})`, lang));
    } else {
      setIocStatus(tr(`IOC error: ${res.error}`, `Errore IOC: ${res.error}`, lang));
    }
  };

  return (
    <div className="tab">
      <div className="tab-header">
        <h2>Urlscan</h2>
        <p>{tr("Local search (db) + optional urlscan.io API.", "Ricerca locale (db) + opzionale API urlscan.io.", lang)}</p>
      </div>
      {error && <ErrorBanner message={error} />}
      <div className="panel">
        <div className="form-grid">
          <label>
            {tr("Query", "Query", lang)}
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr('"login" or domain', '"login" o domain', lang)} />
          </label>
          <label>
            {tr("Domain", "Domain", lang)}
            <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" />
          </label>
          <label>
            {tr("DOM Hash", "DOM Hash", lang)}
            <input value={domHash} onChange={(e) => setDomHash(e.target.value)} placeholder="sha256..." />
          </label>
          <label>
            {tr("Headers Hash", "Headers Hash", lang)}
            <input value={headersHash} onChange={(e) => setHeadersHash(e.target.value)} placeholder="sha256..." />
          </label>
          <label>
            IP
            <input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="1.2.3.4" />
          </label>
          <label>
            JARM
            <input value={jarm} onChange={(e) => setJarm(e.target.value)} placeholder="hash..." />
          </label>
          <label>
            {tr("Favicon Hash", "Favicon Hash", lang)}
            <input value={faviconHash} onChange={(e) => setFaviconHash(e.target.value)} placeholder="mmh3..." />
          </label>
          <button onClick={run}>{tr("Search", "Cerca", lang)}</button>
        </div>
        {data?.warning && <div className="muted">{data.warning}</div>}
        {status && <div className="muted">{status}</div>}
        {iocStatus && <div className="muted">{iocStatus}</div>}
        {data && (
          <button onClick={exportCsv} className="secondary">
            {tr("Export CSV", "Export CSV", lang)}
          </button>
        )}
        {history.length > 0 && (
          <div className="history">
            {history.map((item) => (
              <button key={item} onClick={() => setQuery(item)} className="secondary">
                {item}
              </button>
            ))}
          </div>
        )}
      </div>
      {data && (
        <div className="panel">
          <h3>{tr("Local Results", "Risultati Locali", lang)}</h3>
          <div className="card-grid">
            {data.local.map((row, idx) => (
              <div key={row.id ?? idx} className="result-card">
                <div className="card-title">{row.domain}</div>
                <div className="card-sub">{row.title || "-"}</div>
                <div className="card-url">{row.url}</div>
                <div className="row-actions">
                  <button onClick={() => queueScan(String(row.url))} className="secondary">{tr("Scan", "Scan", lang)}</button>
                  {row.target_id && (
                    <button
                      className="secondary"
                      onClick={() => {
                        localStorage.setItem("lab_target_id", String(row.target_id));
                        window.dispatchEvent(
                          new CustomEvent("open-lab", { detail: { targetId: row.target_id } })
                        );
                      }}
                    >
                      {tr("Open Lab", "Apri Lab", lang)}
                    </button>
                  )}
                  {row.dom_hash && (
                    <button onClick={() => setDomHash(String(row.dom_hash))}>{tr("DOM Hash", "DOM Hash", lang)}</button>
                  )}
                  {row.headers_hash && (
                    <button onClick={() => setHeadersHash(String(row.headers_hash))}>{tr("Headers Hash", "Headers Hash", lang)}</button>
                  )}
                  {row.dom_hash && (
                    <button
                      className="secondary"
                      onClick={() => markIoc("dom_hash", String(row.dom_hash), row)}
                    >
                      IOC
                    </button>
                  )}
                  {row.headers_hash && (
                    <button
                      className="secondary"
                      onClick={() => markIoc("headers_hash", String(row.headers_hash), row)}
                    >
                      IOC
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {stats && (
            <div className="panel">
              <h3>{tr("Hash Counters", "Contatori Hash", lang)}</h3>
              <div className="table">
                {Object.entries(stats.dom).map(([hash, count]) => (
                  <div key={`dom-${hash}`} className="row hash-row">
                    <span>{tr("DOM", "DOM", lang)}</span>
                    <span>{count.count}</span>
                    <span className="truncate">{count.sample_domain || count.sample_url || "-"}</span>
                    <span className="hash-value truncate">{hash}</span>
                    <div className="row-actions">
                      <button onClick={() => setDomHash(hash)}>{tr("Pivot", "Pivot", lang)}</button>
                      <button
                        className="secondary"
                        onClick={() => markIoc("dom_hash", hash, { domain: count.sample_domain, url: count.sample_url })}
                      >
                        {tr("IOC", "IOC", lang)}
                      </button>
                    </div>
                  </div>
                ))}
                {Object.entries(stats.headers).map(([hash, count]) => (
                  <div key={`hdr-${hash}`} className="row hash-row">
                    <span>{tr("Headers", "Headers", lang)}</span>
                    <span>{count.count}</span>
                    <span className="truncate">{count.sample_domain || count.sample_url || "-"}</span>
                    <span className="hash-value truncate">{hash}</span>
                    <div className="row-actions">
                      <button onClick={() => setHeadersHash(hash)}>{tr("Pivot", "Pivot", lang)}</button>
                      <button
                        className="secondary"
                        onClick={() =>
                          markIoc("headers_hash", hash, { domain: count.sample_domain, url: count.sample_url })
                        }
                      >
                        {tr("IOC", "IOC", lang)}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <h3>{tr("Urlscan Results", "Risultati Urlscan", lang)}</h3>
          <div className="table">
            {data.remote.map((url) => (
              <div key={url} className="row">
                <span>{tr("remote", "remote", lang)}</span>
                <span>-</span>
                <span>-</span>
                <span>{url}</span>
                <div className="row-actions">
                  <button onClick={() => queueScan(url)} className="secondary">{tr("Scan", "Scan", lang)}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
