import React from "react";
import ErrorBanner from "../components/ErrorBanner";
import { getLang, tr } from "../i18n";
import { safeGet, safePost } from "../utils/api";

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
  const [aiPrompt, setAiPrompt] = React.useState("");
  const [aiReply, setAiReply] = React.useState<string | null>(null);
  const [aiStatus, setAiStatus] = React.useState<string | null>(null);
  const [history, setHistory] = React.useState<string[]>(() => {
    const raw = localStorage.getItem("urlscan_history");
    return raw ? JSON.parse(raw) : [];
  });
  const [queueNotice, setQueueNotice] = React.useState<string | null>(null);
  const queueTimer = React.useRef<number | null>(null);
  const [openLocalRedirects, setOpenLocalRedirects] = React.useState<number | null>(null);
  const [remoteRedirects, setRemoteRedirects] = React.useState<Record<string, { chain?: any[]; error?: string; loading?: boolean }>>({});

  const parseChain = (raw: any) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (err) {
        return [];
      }
    }
    return [];
  };

  const notify = (message: string) => {
    setStatus(message);
    setQueueNotice(message);
    if (queueTimer.current) {
      window.clearTimeout(queueTimer.current);
    }
    queueTimer.current = window.setTimeout(() => setQueueNotice(null), 4000);
  };

  const run = async () => {
    setStatus(tr("Searching...", "Ricerca in corso...", lang));
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
      setStatus(res.error);
    }
  };

  React.useEffect(() => {
    if (!domHash && !headersHash) return;
    run();
  }, [domHash, headersHash]);

  const queueScan = async (url: string) => {
    setStatus(tr("Queueing scan...", "Messa in coda scan...", lang));
    const res = await safePost<{ queued: number[] }>("/api/scan", { url });
    if (res.ok) {
      const message = tr(`Scan queued for ${url}`, `Scan in coda per ${url}`, lang);
      setStatus(message);
      if (queueTimer.current) {
        window.clearTimeout(queueTimer.current);
      }
      setQueueNotice(message);
      queueTimer.current = window.setTimeout(() => setQueueNotice(null), 4000);
    } else {
      setError(res.error);
      setStatus(res.error);
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
    setStatus(tr("CSV export started.", "Export CSV avviato.", lang));
  };

  const markIoc = async (kind: string, value: string, row: Record<string, string | number>) => {
    setIocStatus(tr("Saving IOC...", "Salvataggio IOC...", lang));
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

  const removeTarget = async (targetId: number) => {
    const ok = window.confirm(
      tr(
        "Remove target and all related data from the database?",
        "Rimuovere il target e tutti i dati correlati dal database?",
        lang
      )
    );
    if (!ok) return;
    const res = await safePost(`/api/targets/${targetId}/delete`, {});
    if (res.ok) {
      setStatus(tr("Target removed.", "Target rimosso.", lang));
      setQueueNotice(tr("Target removed.", "Target rimosso.", lang));
      if (queueTimer.current) {
        window.clearTimeout(queueTimer.current);
      }
      queueTimer.current = window.setTimeout(() => setQueueNotice(null), 4000);
      run();
    } else {
      setError(res.error);
    }
  };

  const loadRemoteRedirects = async (url: string) => {
    setRemoteRedirects((prev) => ({ ...prev, [url]: { loading: true } }));
    const res = await safeGet<{ chain?: any[] }>(`/api/urlscan/redirects/remote?url=${encodeURIComponent(url)}`);
    if (res.ok) {
      setRemoteRedirects((prev) => ({ ...prev, [url]: { chain: res.data.chain || [], loading: false } }));
    } else {
      setRemoteRedirects((prev) => ({ ...prev, [url]: { error: res.error, loading: false } }));
    }
  };

  const copyChain = async (chain: any[]) => {
    if (!chain.length) return;
    const text = chain.map((step) => `${step.status || ""} ${step.url} ${step.location ? `-> ${step.location}` : ""}`.trim()).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      notify(tr("Redirect chain copied.", "Redirect chain copiato.", lang));
    } catch (err) {
      notify(tr("Copy failed.", "Copia fallita.", lang));
    }
  };

  const saveChainAsIocs = async (
    chain: any[],
    targetId?: number,
    domain?: string,
    finalOnly = false,
    domainsOnly = false
  ) => {
    if (!chain.length) return;
    const steps = finalOnly ? [chain[chain.length - 1]] : chain.slice(0, 20);
    const seen = new Set<string>();
    let count = 0;
    for (const step of steps) {
      if (!step?.url) continue;
      let iocKind = "url";
      let value = String(step.url);
      let dom = domain ?? null;
      if (domainsOnly) {
        try {
          const parsed = new URL(String(step.url));
          iocKind = "domain";
          value = parsed.hostname;
          dom = parsed.hostname;
        } catch (err) {
          continue;
        }
      }
      const key = `${iocKind}:${value}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      await safePost("/api/iocs", {
        kind: iocKind,
        value,
        source: "redirect_chain",
        target_id: targetId ?? null,
        url: iocKind === "url" ? String(step.url) : null,
        domain: dom
      });
      count += 1;
    }
    const message = domainsOnly
      ? tr(`Saved ${count} domains as IOCs.`, `Salvati ${count} domini come IOC.`, lang)
      : tr(`Saved ${count} URLs as IOCs.`, `Salvati ${count} URL come IOC.`, lang);
    notify(message);
  };

  const queueRemoteAll = async (limit = 50) => {
    if (!data?.remote?.length) return;
    const urls = data.remote.slice(0, limit);
    setStatus(tr("Queueing remote scans...", "Messa in coda scan remote...", lang));
    const res = await safePost<{ queued: number[] }>("/api/scan/bulk", { urls });
    if (res.ok) {
      const message = tr(
        `Queued ${res.data.queued?.length ?? 0} remote scans.`,
        `Messi in coda ${res.data.queued?.length ?? 0} scan remote.`,
        lang
      );
      setStatus(message);
      if (queueTimer.current) {
        window.clearTimeout(queueTimer.current);
      }
      setQueueNotice(message);
      queueTimer.current = window.setTimeout(() => setQueueNotice(null), 4000);
    } else {
      setStatus(res.error);
    }
  };

  const runAi = async () => {
    if (!data) return;
    setAiStatus(tr("AI analysis running...", "Analisi AI in corso...", lang));
    const sampleLocal = (data.local || []).slice(0, 50);
    const res = await safePost<{ reply?: string }>("/api/ai/task", {
      task: "urlscan_cluster",
      prompt: aiPrompt || null,
      data: {
        local: sampleLocal,
        remote: data.remote?.slice(0, 50) || [],
        stats
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
        {queueNotice && <div className="warning-banner">{queueNotice}</div>}
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
                {(() => {
                  const chain = parseChain((row as any).redirect_chain);
                  const chainCount = chain.length;
                  const isOpen = openLocalRedirects === row.id;
                  return (
                    <>
                      <div className="row-actions">
                        <button
                          className="secondary"
                          onClick={() => setOpenLocalRedirects(isOpen ? null : Number(row.id))}
                        >
                          {tr("Redirects", "Redirects", lang)} ({chainCount})
                        </button>
                        {chainCount > 0 && (
                          <>
                            <button className="secondary" onClick={() => copyChain(chain)}>
                              {tr("Copy Chain", "Copia chain", lang)}
                            </button>
                            <button
                              className="secondary"
                              onClick={() => saveChainAsIocs(chain, row.target_id ? Number(row.target_id) : undefined, String(row.domain || ""))}
                            >
                              {tr("Save IOCs", "Salva IOC", lang)}
                            </button>
                            <button
                              className="secondary"
                              onClick={() => saveChainAsIocs(chain, row.target_id ? Number(row.target_id) : undefined, String(row.domain || ""), true)}
                            >
                              {tr("Save Final URL", "Salva URL finale", lang)}
                            </button>
                            <button
                              className="secondary"
                              onClick={() => saveChainAsIocs(chain, row.target_id ? Number(row.target_id) : undefined, String(row.domain || ""), false, true)}
                            >
                              {tr("Save Domains", "Salva domini", lang)}
                            </button>
                          </>
                        )}
                      </div>
                      {isOpen && chainCount > 0 && (
                        <div className="muted">
                          {chain.map((step: any, stepIdx: number) => (
                            <div key={`${row.id}-r-${stepIdx}`}>
                              {step.status ? `${step.status} ` : ""}{step.url}
                              {step.location ? ` -> ${step.location}` : ""}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
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
                  {row.target_id && (
                    <button
                      className="secondary danger"
                      onClick={() => removeTarget(Number(row.target_id))}
                      title={tr("Delete target and all related data", "Elimina il target e tutti i dati correlati", lang)}
                    >
                      {tr("Delete target", "Elimina target", lang)}
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
          <div className="row-actions" style={{ marginBottom: "8px" }}>
            <button className="secondary" onClick={() => queueRemoteAll(50)}>
              {tr("Queue all remote (50)", "Coda tutti remote (50)", lang)}
            </button>
          </div>
          <div className="table">
            {data.remote.map((url) => {
              const entry = remoteRedirects[url] || {};
              const chain = entry.chain || [];
              return (
                <div key={url} className="row">
                  <span>{tr("remote", "remote", lang)}</span>
                  <span>-</span>
                  <span className="truncate">{url}</span>
                  <div className="row-actions">
                    <button onClick={() => queueScan(url)} className="secondary">{tr("Scan", "Scan", lang)}</button>
                    <button
                      onClick={() => loadRemoteRedirects(url)}
                      className="secondary"
                      disabled={entry.loading}
                    >
                      {entry.loading ? tr("Loading...", "Caricamento...", lang) : tr("Redirects", "Redirects", lang)}
                    </button>
                    {chain.length > 0 && (
                      <>
                        <button className="secondary" onClick={() => copyChain(chain)}>
                          {tr("Copy Chain", "Copia chain", lang)}
                        </button>
                        <button className="secondary" onClick={() => saveChainAsIocs(chain)}>
                          {tr("Save IOCs", "Salva IOC", lang)}
                        </button>
                        <button className="secondary" onClick={() => saveChainAsIocs(chain, undefined, undefined, true)}>
                          {tr("Save Final URL", "Salva URL finale", lang)}
                        </button>
                        <button className="secondary" onClick={() => saveChainAsIocs(chain, undefined, undefined, false, true)}>
                          {tr("Save Domains", "Salva domini", lang)}
                        </button>
                      </>
                    )}
                  </div>
                  {entry.error && <span className="status">{entry.error}</span>}
                </div>
              );
            })}
          </div>
          {Object.entries(remoteRedirects).map(([remoteUrl, entry]) => {
            if (!entry.chain || entry.chain.length === 0) return null;
            return (
              <div key={`${remoteUrl}-chain`} className="muted">
                <strong>{remoteUrl}</strong>
                {entry.chain.map((step: any, idx: number) => (
                  <div key={`${remoteUrl}-${idx}`}>
                    {step.status ? `${step.status} ` : ""}{step.url}
                    {step.location ? ` -> ${step.location}` : ""}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
      <div className="panel">
        <h3>{tr("AI Insights", "AI Insights", lang)}</h3>
        <div className="form-grid">
          <label>
            {tr("Optional prompt", "Prompt opzionale", lang)}
            <input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder={tr("e.g. highlight suspicious outliers", "Es: evidenzia outlier sospetti", lang)} />
          </label>
          <button onClick={runAi} className="secondary" disabled={!data}>{tr("Analyze Results", "Analizza risultati", lang)}</button>
        </div>
        <div className="row-actions">
          <button className="secondary" onClick={() => setAiPrompt(tr("cluster by brand and kit similarity", "cluster per brand e similarita' kit", lang))}>
            {tr("Cluster Kits", "Cluster Kit", lang)}
          </button>
          <button className="secondary" onClick={() => setAiPrompt(tr("find rare outliers", "trova outlier rari", lang))}>
            {tr("Outliers", "Outlier", lang)}
          </button>
        </div>
        {aiStatus && <div className="muted">{aiStatus}</div>}
        {aiReply && <div className="muted">{aiReply}</div>}
      </div>
    </div>
  );
}
