import React from "react";
import ErrorBanner from "../components/ErrorBanner";
import { getLang, tr } from "../i18n";
import { API_BASE, safeGet, safePost } from "../utils/api";

interface LabResponse {
  target: Record<string, string | number> | null;
  assets: Array<Record<string, string | number>>;
  indicators: Array<Record<string, string | number>>;
  matches: Array<Record<string, string | number>>;
  yara?: Array<Record<string, string | number>>;
}

interface Job {
  id: number;
  type: string;
  status: string;
  payload: Record<string, string>;
}

export default function LabTab() {
  const lang = getLang();
  const [targetId, setTargetId] = React.useState(() => localStorage.getItem("lab_target_id") || "");
  const [data, setData] = React.useState<LabResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [hashQuery, setHashQuery] = React.useState("");
  const [pivot, setPivot] = React.useState<{ local: any[]; urlscan: string[]; warning?: string | null } | null>(
    null
  );
  const [fofaField, setFofaField] = React.useState("body");
  const [fofaValue, setFofaValue] = React.useState("");
  const [fofaLimit, setFofaLimit] = React.useState(50);
  const [screenshotError, setScreenshotError] = React.useState(false);
  const [screenshotErrorMessage, setScreenshotErrorMessage] = React.useState<string | null>(null);
  const [faviconError, setFaviconError] = React.useState(false);
  const [faviconErrorMessage, setFaviconErrorMessage] = React.useState<string | null>(null);
  const [showRaw, setShowRaw] = React.useState(false);
  const [showDom, setShowDom] = React.useState(false);
  const [showHeaders, setShowHeaders] = React.useState(false);
  const [domFull, setDomFull] = React.useState<string | null>(null);
  const [domLoading, setDomLoading] = React.useState(false);
  const [domError, setDomError] = React.useState<string | null>(null);
  const [iocStatus, setIocStatus] = React.useState<string | null>(null);
  const [targetJobs, setTargetJobs] = React.useState<Job[]>([]);
  const [jobStatus, setJobStatus] = React.useState<string | null>(null);
  const [whoisData, setWhoisData] = React.useState<any | null>(null);
  const [whoisLoading, setWhoisLoading] = React.useState(false);
  const [whoisError, setWhoisError] = React.useState<string | null>(null);
  const [fofaStatus, setFofaStatus] = React.useState<string | null>(null);
  const [showWhoisRaw, setShowWhoisRaw] = React.useState(false);
  const [actionStatus, setActionStatus] = React.useState<string | null>(null);

  const load = async () => {
    if (!targetId) return;
    const res = await safeGet<LabResponse>(`/api/lab/${targetId}`);
    if (res.ok) {
      setData(res.data);
      setError(null);
      setScreenshotError(false);
      setScreenshotErrorMessage(null);
      setFaviconError(false);
      setFaviconErrorMessage(null);
      setDomFull(null);
      setDomError(null);
      setDomLoading(false);
      setIocStatus(null);
      setWhoisData(null);
      setWhoisError(null);
      await loadJobs(res.data.target?.url ? String(res.data.target.url) : null);
      await loadWhois();
    } else {
      setError(res.error);
    }
  };

  React.useEffect(() => {
    if (targetId) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (targetId) {
      localStorage.setItem("lab_target_id", targetId);
    }
  }, [targetId]);

  const runPivot = async () => {
    if (!hashQuery) return;
    setActionStatus(tr("Pivot hash requested.", "Pivot hash richiesto.", lang));
    const res = await safeGet<{ local: any[]; urlscan: string[]; warning?: string | null }>(
      `/api/pivot/hash?value=${encodeURIComponent(hashQuery)}`
    );
    if (res.ok) {
      setPivot(res.data);
      setError(null);
      const localCount = res.data.local?.length ?? 0;
      const urlscanCount = res.data.urlscan?.length ?? 0;
      setActionStatus(
        tr(
          `Pivot hash completed. Local: ${localCount}, Urlscan: ${urlscanCount}.`,
          `Pivot hash completato. Locali: ${localCount}, Urlscan: ${urlscanCount}.`,
          lang
        )
      );
    } else {
      setError(res.error);
      setActionStatus(res.error);
    }
  };

  const runTargetPivot = async (field: string, value: string) => {
    setActionStatus(tr(`Pivot ${field} requested.`, `Pivot ${field} richiesto.`, lang));
    const res = await safeGet<{ local: any[] }>(`/api/pivot/target?field=${field}&value=${encodeURIComponent(value)}`);
    if (res.ok) {
      setPivot({ local: res.data.local, urlscan: [] });
      setError(null);
      const localCount = res.data.local?.length ?? 0;
      setActionStatus(
        tr(
          `Pivot ${field} completed. Local: ${localCount}.`,
          `Pivot ${field} completato. Locali: ${localCount}.`,
          lang
        )
      );
    } else {
      setError(res.error);
      setActionStatus(res.error);
    }
  };

  const runFofaPivot = async (field: string, value: string) => {
    if (!value.trim()) {
      setFofaStatus(tr("FOFA value is empty.", "Valore FOFA vuoto.", lang));
      return;
    }
    const size = Math.max(1, fofaLimit || 50);
    setActionStatus(tr("FOFA pivot requested.", "Pivot FOFA richiesto.", lang));
    setFofaStatus(tr("FOFA search running...", "Ricerca FOFA in corso...", lang));
    const res = await safeGet<{ results: string[]; query: string; warning?: string | null }>(
      `/api/pivot/fofa?field=${field}&value=${encodeURIComponent(value)}&size=${size}`
    );
    if (res.ok) {
      setPivot({ local: [], urlscan: res.data.results, warning: res.data.warning });
      setError(null);
      if (res.data.warning) {
        setFofaStatus(res.data.warning);
        setActionStatus(res.data.warning);
      } else {
        setFofaStatus(tr("FOFA search completed.", "Ricerca FOFA completata.", lang));
        const fofaCount = res.data.results?.length ?? 0;
        setActionStatus(
          tr(
            `FOFA pivot completed. Results: ${fofaCount}.`,
            `Pivot FOFA completato. Risultati: ${fofaCount}.`,
            lang
          )
        );
      }
      const urls = (res.data.results || []).slice(0, size);
      if (urls.length > 0) {
        const queued = await safePost<{ queued: number[] }>("/api/scan/bulk", { urls });
        if (queued.ok) {
          setActionStatus(
            tr(
              `Queued ${queued.data.queued?.length ?? 0} scans from FOFA results.`,
              `Messi in coda ${queued.data.queued?.length ?? 0} scan dai risultati FOFA.`,
              lang
            )
          );
        } else {
          setActionStatus(queued.error);
        }
      } else {
        setActionStatus(tr("No FOFA results to queue.", "Nessun risultato FOFA da mettere in coda.", lang));
      }
    } else {
      setError(res.error);
      setFofaStatus(res.error);
      setActionStatus(res.error);
    }
  };

  const loadJobs = async (url: string | null) => {
    if (!url) {
      setTargetJobs([]);
      return;
    }
    const res = await safeGet<Job[]>("/api/jobs");
    if (res.ok) {
      const filtered = res.data.filter((job) => job.payload?.url === url);
      setTargetJobs(filtered);
      setJobStatus(null);
    } else {
      setJobStatus(res.error);
    }
  };

  const rescanTarget = async () => {
    const url = data?.target?.url;
    if (!url) return;
    const ok = window.confirm(
      tr(
        "Queue a rescan for this target?",
        "Mettere in coda una riscansione per questo target?",
        lang
      )
    );
    if (!ok) return;
    const res = await safePost<{ queued: number[] }>("/api/scan", { url });
    if (res.ok) {
      setJobStatus(tr("Rescan queued.", "Riscansione in coda.", lang));
      window.alert(tr("Rescan queued.", "Riscansione in coda.", lang));
      await loadJobs(String(url));
    } else {
      setJobStatus(res.error);
    }
  };

  const deleteTarget = async () => {
    if (!targetId) return;
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
      setJobStatus(tr("Target removed.", "Target rimosso.", lang));
      setData(null);
      setTargetJobs([]);
      setTargetId("");
      localStorage.removeItem("lab_target_id");
    } else {
      setJobStatus(res.error);
    }
  };

  const updateJob = async (jobId: number, action: "stop" | "skip" | "remove") => {
    const res = await safePost(`/api/jobs/${jobId}/${action}`, {});
    if (res.ok) {
      setJobStatus(tr(`Job ${action} OK.`, `Job ${action} OK.`, lang));
      await loadJobs(data?.target?.url ? String(data.target.url) : null);
    } else {
      setJobStatus(res.error);
    }
  };

  const rescanJob = async (job: Job) => {
    const url = job.payload?.url;
    if (!url) return;
    const ok = window.confirm(
      tr(
        "Queue a rescan for this URL?",
        "Mettere in coda una riscansione per questo URL?",
        lang
      )
    );
    if (!ok) return;
    const res = await safePost<{ queued: number[] }>("/api/scan", { url });
    if (res.ok) {
      setJobStatus(tr("Rescan queued.", "Riscansione in coda.", lang));
      window.alert(tr("Rescan queued.", "Riscansione in coda.", lang));
      await loadJobs(String(url));
    } else {
      setJobStatus(res.error);
    }
  };

  const handleScreenshotError = async () => {
    setScreenshotError(true);
    try {
      const res = await fetch(`${API_BASE}/api/lab/${targetId}/screenshot`, { cache: "no-store" });
      if (res.status === 404) {
        let detail = "";
        try {
          const data = await res.json();
          detail = data?.detail ? ` (${data.detail})` : "";
        } catch (err) {
          detail = "";
        }
        setScreenshotErrorMessage(
          tr(
            "Screenshot not found.",
            "Screenshot non trovato.",
            lang
          ) + detail
        );
      } else if (!res.ok) {
        setScreenshotErrorMessage(tr("Screenshot unavailable.", "Screenshot non disponibile.", lang));
      } else {
        setScreenshotErrorMessage(null);
      }
    } catch (err) {
      setScreenshotErrorMessage(tr("Error loading screenshot.", "Errore nel caricamento screenshot.", lang));
    }
  };

  const markIoc = async (kind: string, value: string, source: string) => {
    setActionStatus(tr(`Saving IOC (${kind})...`, `Salvataggio IOC (${kind})...`, lang));
    const res = await safePost<{ id: number }>("/api/iocs", {
      kind,
      value,
      source,
      target_id: data?.target?.id,
      url: data?.target?.url,
      domain: data?.target?.domain
    });
    if (res.ok) {
      setIocStatus(tr(`IOC saved (${kind})`, `IOC salvato (${kind})`, lang));
      setActionStatus(tr(`IOC saved (${kind}).`, `IOC salvato (${kind}).`, lang));
    } else {
      setIocStatus(tr(`IOC error: ${res.error}`, `Errore IOC: ${res.error}`, lang));
      setActionStatus(res.error);
    }
  };

  const loadWhois = async () => {
    if (!targetId) return;
    setWhoisLoading(true);
    setWhoisError(null);
    setActionStatus(tr("WHOIS requested.", "WHOIS richiesto.", lang));
    const res = await safeGet<{ domain: string | null; ip: string | null; rdap_domain: any; rdap_ip: any; warning?: string | null }>(
      `/api/lab/${targetId}/whois`
    );
    if (res.ok) {
      setWhoisData(res.data);
      setActionStatus(tr("WHOIS loaded.", "WHOIS caricato.", lang));
    } else {
      setWhoisError(res.error);
      setActionStatus(res.error);
    }
    setWhoisLoading(false);
  };

  const pickRdapEvent = (rdap: any, action: string) => {
    const events = rdap?.events || [];
    const event = events.find((e: any) => e?.eventAction === action);
    return event?.eventDate || "-";
  };

  const listRdapNameservers = (rdap: any) => {
    const ns = rdap?.nameservers || [];
    return ns.map((n: any) => n?.ldhName).filter(Boolean);
  };

  const renderWhoisSummary = () => {
    if (!whoisData) return null;
    const domain = whoisData.rdap_domain;
    const ip = whoisData.rdap_ip;
    const domainNs = listRdapNameservers(domain);
    return (
      <div className="meta-grid">
        <div><strong>Domain:</strong> {whoisData.domain || "-"}</div>
        <div><strong>IP:</strong> {whoisData.ip || "-"}</div>
        <div><strong>Registrar:</strong> {domain?.registrar?.name || domain?.registrar?.handle || "-"}</div>
        <div><strong>Registered:</strong> {pickRdapEvent(domain, "registration")}</div>
        <div><strong>Updated:</strong> {pickRdapEvent(domain, "last changed")}</div>
        <div><strong>Expires:</strong> {pickRdapEvent(domain, "expiration")}</div>
        <div><strong>Nameservers:</strong> {domainNs.length ? domainNs.join(", ") : "-"}</div>
        <div><strong>IP Country:</strong> {ip?.country || "-"}</div>
        <div><strong>IP Name:</strong> {ip?.name || "-"}</div>
      </div>
    );
  };

  const handleFaviconError = async () => {
    setFaviconError(true);
    try {
      const res = await fetch(`${API_BASE}/api/lab/${targetId}/favicon`, { cache: "no-store" });
      if (res.status === 403) {
        setFaviconErrorMessage(
          tr(
            "Remote favicon disabled. Enable REMOTE_FAVICON_ENABLED in Settings.",
            "Favicon remoto disabilitato. Abilita REMOTE_FAVICON_ENABLED in Settings.",
            lang
          )
        );
      } else if (res.status === 404) {
        let detail = "";
        try {
          const data = await res.json();
          detail = data?.detail ? ` (${data.detail})` : "";
        } catch (err) {
          detail = "";
        }
        setFaviconErrorMessage(
          tr(
            "Favicon not found for this target.",
            "Favicon non trovato per questo target.",
            lang
          ) + detail
        );
      } else if (!res.ok) {
        setFaviconErrorMessage(tr("Favicon unavailable.", "Favicon non disponibile.", lang));
      } else {
        setFaviconErrorMessage(null);
      }
    } catch (err) {
      setFaviconErrorMessage(tr("Error loading favicon.", "Errore nel caricamento favicon.", lang));
    }
  };

  return (
    <div className="tab">
      <div className="tab-header">
        <h2>Lab</h2>
        <p>{tr("Target detail, assets, and extracted indicators.", "Dettaglio target, asset e indicatori estratti.", lang)}</p>
      </div>
      {error && <ErrorBanner message={error} onRepaired={load} />}
      <div className="panel">
        <div className="form-grid">
          <label>
            {tr("Target ID", "Target ID", lang)}
            <input value={targetId} onChange={(e) => setTargetId(e.target.value)} />
          </label>
          <button onClick={load}>{tr("Load", "Carica", lang)}</button>
        </div>
      </div>
      {data && (
        <div className="panel">
          <h3>{tr("Target", "Target", lang)}</h3>
          <div className="meta-grid">
            <div><strong>URL:</strong> {data.target?.url || "-"}</div>
            <div><strong>{tr("Domain", "Domain", lang)}:</strong> {data.target?.domain || "-"}</div>
            <div><strong>IP:</strong> {data.target?.ip || "-"}</div>
            <div><strong>JARM:</strong> {data.target?.jarm || "-"}</div>
            <div><strong>{tr("Favicon", "Favicon", lang)}:</strong> {data.target?.favicon_hash || "-"}</div>
          </div>
          <div className="row-actions" style={{ marginBottom: "12px" }}>
            {data.target?.url && (
              <button onClick={rescanTarget} className="secondary" title={tr("Queue a new scan for this target URL", "Metti in coda una nuova scansione per questo target", lang)}>
                {tr("Rescan target URL", "Riscansiona URL target", lang)}
              </button>
            )}
            <button onClick={deleteTarget} className="secondary" title={tr("Delete target and all related data", "Elimina il target e tutti i dati correlati", lang)}>
              {tr("Delete target", "Elimina target", lang)}
            </button>
            {actionStatus && <span className="status">{actionStatus}</span>}
            {jobStatus && <span className="status">{jobStatus}</span>}
          </div>
          <div className="hash-grid">
            <div className="hash-card">
              <span className="hash-label">{tr("DOM hash (HTML)", "DOM hash (HTML)", lang)}</span>
              <span className="hash-value">{data.target?.dom_hash || "-"}</span>
              {data.target?.dom_hash && (
                <div className="row-actions">
                  <button onClick={() => setHashQuery(String(data.target?.dom_hash))}>{tr("Pivot", "Pivot", lang)}</button>
                  <button
                    className="secondary"
                    onClick={() => markIoc("dom_hash", String(data.target?.dom_hash), "lab")}
                  >
                    {tr("IOC", "IOC", lang)}
                  </button>
                </div>
              )}
            </div>
            <div className="hash-card">
              <span className="hash-label">{tr("Headers hash", "Headers hash", lang)}</span>
              <span className="hash-value">{data.target?.headers_hash || "-"}</span>
              {data.target?.headers_hash && (
                <div className="row-actions">
                  <button onClick={() => setHashQuery(String(data.target?.headers_hash))}>{tr("Pivot", "Pivot", lang)}</button>
                  <button
                    className="secondary"
                    onClick={() => markIoc("headers_hash", String(data.target?.headers_hash), "lab")}
                  >
                    {tr("IOC", "IOC", lang)}
                  </button>
                </div>
              )}
            </div>
            <div className="hash-card">
              <span className="hash-label">{tr("Favicon hash", "Favicon hash", lang)}</span>
              <span className="hash-value">{data.target?.favicon_hash || "-"}</span>
              {data.target?.favicon_hash && (
                <div className="row-actions">
                  <button onClick={() => runTargetPivot("favicon_hash", String(data.target?.favicon_hash))}>{tr("Pivot", "Pivot", lang)}</button>
                  <button
                    className="secondary"
                    onClick={() => markIoc("favicon_hash", String(data.target?.favicon_hash), "lab")}
                  >
                    {tr("IOC", "IOC", lang)}
                  </button>
                </div>
              )}
            </div>
            <div className="hash-card">
              <span className="hash-label">{tr("Screenshot pHash", "Screenshot pHash", lang)}</span>
              <span className="hash-value">{data.target?.screenshot_phash || "-"}</span>
              {data.target?.screenshot_phash && (
                <div className="row-actions">
                  <button onClick={() => runTargetPivot("screenshot_phash", String(data.target?.screenshot_phash))}>{tr("Pivot", "Pivot", lang)}</button>
                  <button
                    className="secondary"
                    onClick={() => markIoc("screenshot_phash", String(data.target?.screenshot_phash), "lab")}
                  >
                    {tr("IOC", "IOC", lang)}
                  </button>
                </div>
              )}
            </div>
          </div>
          {iocStatus && <div className="muted">{iocStatus}</div>}
          <h3>{tr("Favicon Preview", "Anteprima Favicon", lang)}</h3>
          {!faviconError ? (
            <img
              className="screenshot"
              src={`${API_BASE}/api/lab/${targetId}/favicon`}
              alt="Favicon"
              onError={handleFaviconError}
            />
          ) : (
            <div className="muted">
              {faviconErrorMessage ||
                tr(
                  "Favicon not available.",
                  "Favicon non disponibile.",
                  lang
                )}
            </div>
          )}
          <div className="row-actions">
            {data.target?.dom_hash && (
              <button onClick={() => setHashQuery(String(data.target?.dom_hash))}>{tr("Pivot DOM Hash", "Pivot DOM Hash", lang)}</button>
            )}
            {data.target?.headers_hash && (
              <button onClick={() => setHashQuery(String(data.target?.headers_hash))}>{tr("Pivot Headers Hash", "Pivot Headers Hash", lang)}</button>
            )}
            {data.target?.ip && (
              <button onClick={() => runTargetPivot("ip", String(data.target?.ip))}>{tr("Pivot IP", "Pivot IP", lang)}</button>
            )}
            {data.target?.jarm && (
              <button onClick={() => runTargetPivot("jarm", String(data.target?.jarm))}>{tr("Pivot JARM", "Pivot JARM", lang)}</button>
            )}
            {data.target?.favicon_hash && (
              <button onClick={() => runTargetPivot("favicon_hash", String(data.target?.favicon_hash))}>{tr("Pivot Favicon", "Pivot Favicon", lang)}</button>
            )}
            {data.target?.ip && (
              <button onClick={() => runFofaPivot("ip", String(data.target?.ip))} className="secondary">FOFA IP</button>
            )}
            {data.target?.jarm && (
              <button onClick={() => runFofaPivot("jarm", String(data.target?.jarm))} className="secondary">FOFA JARM</button>
            )}
            {data.target?.favicon_hash && (
              <button onClick={() => runFofaPivot("favicon_hash", String(data.target?.favicon_hash))} className="secondary">FOFA Favicon</button>
            )}
          </div>
          <h3>{tr("Screenshot", "Screenshot", lang)}</h3>
          {data.target?.screenshot_path && !screenshotError ? (
            <img
              className="screenshot"
              src={`${API_BASE}/api/lab/${targetId}/screenshot`}
              alt="Screenshot"
              onError={handleScreenshotError}
            />
          ) : (
            <div className="muted">
              {tr("No screenshot available. Status:", "Nessuno screenshot disponibile. Stato:", lang)}{" "}
              {String(data.target?.screenshot_status || "-")}{" "}
              {data.target?.screenshot_reason ? `(${data.target?.screenshot_reason})` : ""}
              {screenshotErrorMessage ? ` ${screenshotErrorMessage}` : ""}
            </div>
          )}
          {data.target?.screenshot_path && !screenshotError && (
            <div className="row-actions" style={{ marginBottom: "12px" }}>
              <a
                className="button-link"
                href={`${API_BASE}/api/lab/${targetId}/screenshot`}
                download={`target-${targetId}.png`}
              >
                {tr("Download screenshot", "Scarica screenshot", lang)}
              </a>
            </div>
          )}
          <h3>{tr("DOM HTML (excerpt)", "DOM HTML (excerpt)", lang)}</h3>
          <div className="row-actions" style={{ marginBottom: "8px" }}>
            <button className="secondary" onClick={() => setShowDom(!showDom)}>
              {showDom ? tr("Hide DOM", "Nascondi DOM", lang) : tr("Show DOM", "Mostra DOM", lang)}
            </button>
            <button
              className="secondary"
              onClick={async () => {
                if (!targetId) return;
                setActionStatus(tr("Loading full DOM...", "Caricamento DOM completo...", lang));
                setDomLoading(true);
                setDomError(null);
                try {
                  const res = await fetch(`${API_BASE}/api/lab/${targetId}/dom`);
                  if (!res.ok) {
                    let detail = "";
                    try {
                      const data = await res.json();
                      detail = data?.detail ? ` (${data.detail})` : "";
                    } catch (err) {
                      detail = "";
                    }
                    setDomError(tr("Full DOM not available.", "DOM completo non disponibile.", lang) + detail);
                  } else {
                    const text = await res.text();
                    setDomFull(text);
                    setActionStatus(tr("Full DOM loaded.", "DOM completo caricato.", lang));
                  }
                } catch (err) {
                  setDomError(tr("Error downloading DOM.", "Errore nel download del DOM.", lang));
                  setActionStatus(tr("DOM download error.", "Errore download DOM.", lang));
                } finally {
                  setDomLoading(false);
                }
              }}
            >
              {tr("Load full DOM", "Carica DOM completo", lang)}
            </button>
            {targetId && (
              <a
                className="button-link"
                href={`${API_BASE}/api/lab/${targetId}/dom`}
                download={`target-${targetId}.html`}
              >
                {tr("Download DOM", "Scarica DOM", lang)}
              </a>
            )}
          </div>
          {showDom ? (
            data.target?.html_excerpt ? (
              <pre className="code-pre">{String(data.target.html_excerpt)}</pre>
            ) : (
              <div className="muted">{tr("No DOM saved (empty excerpt).", "Nessun DOM salvato (excerpt vuoto).", lang)}</div>
            )
          ) : null}
          {domLoading && <div className="muted">{tr("Loading full DOM...", "Caricamento DOM completo...", lang)}</div>}
          {domError && <div className="muted">{domError}</div>}
          {domFull && <pre className="code-pre">{domFull}</pre>}
          <h3>{tr("Headers (captured)", "Headers (captured)", lang)}</h3>
          <div className="row-actions" style={{ marginBottom: "8px" }}>
            <button className="secondary" onClick={() => setShowHeaders(!showHeaders)}>
              {showHeaders ? tr("Hide Headers", "Nascondi Headers", lang) : tr("Show Headers", "Mostra Headers", lang)}
            </button>
          </div>
          {showHeaders ? (
            data.target?.headers_text ? (
              <pre className="code-pre">{String(data.target.headers_text)}</pre>
            ) : (
              <div className="muted">{tr("No headers saved.", "Nessun header salvato.", lang)}</div>
            )
          ) : null}
          <h3>{tr("Indicators", "Indicatori", lang)}</h3>
          {data.indicators.length === 0 ? (
            <div className="muted">{tr("No indicators found.", "Nessun indicatore trovato.", lang)}</div>
          ) : (
            <div className="table">
              {data.indicators.map((ind) => (
                <div key={String(ind.id)} className="row simple-row">
                  <span>#{ind.id}</span>
                  <span>{ind.kind}</span>
                  <span className="hash-value">{ind.value}</span>
                </div>
              ))}
            </div>
          )}
          <h3>{tr("Assets", "Asset", lang)}</h3>
          {data.assets.length === 0 ? (
            <div className="muted">{tr("No assets found.", "Nessun asset trovato.", lang)}</div>
          ) : (
            <div className="table">
              {data.assets.map((asset) => (
                <div key={String(asset.id)} className="row asset-row">
                  <span>#{asset.id}</span>
                  <span>{asset.type}</span>
                  <span className="truncate">{asset.url}</span>
                  <span className="hash-value">{asset.md5 || asset.sha256 || "-"}</span>
                  <div className="row-actions">
                    {asset.md5 && <button onClick={() => setHashQuery(String(asset.md5))}>MD5</button>}
                    {asset.sha256 && <button onClick={() => setHashQuery(String(asset.sha256))}>SHA256</button>}
                    {asset.md5 && (
                      <button
                        className="secondary"
                        onClick={() => markIoc("md5", String(asset.md5), "asset")}
                      >
                        {tr("IOC", "IOC", lang)}
                      </button>
                    )}
                    {asset.sha256 && (
                      <button
                        className="secondary"
                        onClick={() => markIoc("sha256", String(asset.sha256), "asset")}
                      >
                        {tr("IOC", "IOC", lang)}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <h3>{tr("WHOIS / RDAP", "WHOIS / RDAP", lang)}</h3>
          <div className="row-actions" style={{ marginBottom: "8px" }}>
            <button className="secondary" onClick={loadWhois} title={tr("Refresh WHOIS/RDAP data", "Aggiorna i dati WHOIS/RDAP", lang)}>
              {tr("Refresh WHOIS", "Aggiorna WHOIS", lang)}
            </button>
            <button className="secondary" onClick={() => setShowWhoisRaw(!showWhoisRaw)}>
              {showWhoisRaw ? tr("Hide raw", "Nascondi raw", lang) : tr("Show raw", "Mostra raw", lang)}
            </button>
            {whoisLoading && <span className="status">{tr("Loading...", "Caricamento...", lang)}</span>}
            {whoisError && <span className="status">{whoisError}</span>}
          </div>
          {whoisData && (
            <div className="pivot-results">
              {whoisData.warning && <div className="muted">{whoisData.warning}</div>}
              {renderWhoisSummary()}
              {showWhoisRaw && <pre>{JSON.stringify(whoisData, null, 2)}</pre>}
            </div>
          )}
          <h3>{tr("Target Queue", "Coda Target", lang)}</h3>
          {targetJobs.length === 0 ? (
            <div className="muted">{tr("No jobs for this target.", "Nessun job per questo target.", lang)}</div>
          ) : (
            <div className="table">
              {targetJobs.map((job) => (
                <div key={job.id} className="row job-row">
                  <span>#{job.id}</span>
                  <span>{job.type}</span>
                  <span className={`status ${job.status.toLowerCase()}`}>{job.status}</span>
                  <span>{job.payload?.url || "-"}</span>
                  <div className="row-actions">
                    {job.payload?.url && (
                      <button
                        onClick={() => rescanJob(job)}
                        className="secondary"
                        title={tr("Queue a new scan for this URL", "Metti in coda una nuova scansione per questo URL", lang)}
                      >
                        {tr("Rescan URL", "Riscansiona URL", lang)}
                      </button>
                    )}
                    {(job.status === "QUEUED" || job.status === "RUNNING") && (
                      <>
                        <button
                          onClick={() => updateJob(job.id, "stop")}
                          className="secondary"
                          title={tr("Stop this job", "Ferma questo job", lang)}
                        >
                          {tr("Stop job", "Ferma job", lang)}
                        </button>
                        <button
                          onClick={() => updateJob(job.id, "skip")}
                          className="secondary"
                          title={tr("Skip this job", "Salta questo job", lang)}
                        >
                          {tr("Skip job", "Salta job", lang)}
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => updateJob(job.id, "remove")}
                      className="secondary"
                      title={tr("Remove this job from the queue", "Rimuovi questo job dalla coda", lang)}
                    >
                      {tr("Remove job", "Rimuovi job", lang)}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <h3>{tr("Pivot Hash", "Pivot Hash", lang)}</h3>
          <div className="form-grid">
            <label>
              {tr("Hash (md5/sha256)", "Hash (md5/sha256)", lang)}
              <input value={hashQuery} onChange={(e) => setHashQuery(e.target.value)} />
            </label>
            <button onClick={runPivot}>{tr("Search", "Cerca", lang)}</button>
          </div>
          <h3>{tr("Pivot FOFA", "Pivot FOFA", lang)}</h3>
          <div className="form-grid">
            <label>
              {tr("Field", "Campo", lang)}
              <select value={fofaField} onChange={(e) => setFofaField(e.target.value)}>
                <option value="ip">ip</option>
                <option value="jarm">jarm</option>
                <option value="favicon_hash">favicon_hash</option>
                <option value="cert">cert</option>
                <option value="body">body</option>
              </select>
            </label>
            <label>
              {tr("Value", "Valore", lang)}
              <input value={fofaValue} onChange={(e) => setFofaValue(e.target.value)} />
            </label>
            <label>
              {tr("Limit", "Limite", lang)}
              <input
                type="number"
                min={1}
                value={fofaLimit}
                onChange={(e) => setFofaLimit(Number(e.target.value))}
              />
            </label>
            <button onClick={() => runFofaPivot(fofaField, fofaValue)}>{tr("Search", "Cerca", lang)}</button>
          </div>
          {fofaStatus && <div className="muted">{fofaStatus}</div>}
          {pivot && (
            <div className="pivot-results">
              {pivot.warning && <div className="muted">{pivot.warning}</div>}
              <h4>{tr("Local Matches", "Match Locali", lang)}</h4>
              {pivot.local.length === 0 ? (
                <div className="muted">{tr("No local results.", "Nessun risultato locale.", lang)}</div>
              ) : (
                <pre>{JSON.stringify(pivot.local, null, 2)}</pre>
              )}
              <h4>{tr("Urlscan Matches", "Match Urlscan", lang)}</h4>
              {pivot.urlscan.length === 0 ? (
                <div className="muted">{tr("No urlscan results.", "Nessun risultato urlscan.", lang)}</div>
              ) : (
                <pre>{JSON.stringify(pivot.urlscan, null, 2)}</pre>
              )}
            </div>
          )}
          <h3>{tr("Signature Matches", "Match Firme", lang)}</h3>
          {data.matches.length === 0 ? (
            <div className="muted">{tr("No signature matches found.", "Nessun match di firma trovato.", lang)}</div>
          ) : (
            <div className="table">
              {data.matches.map((m) => (
                <div key={String(m.id)} className="row simple-row">
                  <span>#{m.id}</span>
                  <span>{m.signature_id}</span>
                  <span className="hash-value">{m.created_at || "-"}</span>
                </div>
              ))}
            </div>
          )}
          <h3>{tr("YARA Matches", "Match YARA", lang)}</h3>
          {data.yara && data.yara.length > 0 ? (
            <div className="table">
              {data.yara.map((m) => (
                <div key={String(m.id)} className="row simple-row">
                  <span>#{m.id}</span>
                  <span>{m.name || m.rule_id}</span>
                  <span className="hash-value">{m.created_at || "-"}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted">{tr("No YARA matches found.", "Nessun match YARA trovato.", lang)}</div>
          )}
          <div className="row-actions" style={{ marginTop: "12px" }}>
            <button className="secondary" onClick={() => setShowRaw(!showRaw)}>
              {showRaw ? tr("Hide JSON", "Nascondi JSON", lang) : tr("Show JSON", "Mostra JSON", lang)}
            </button>
          </div>
          {showRaw && <pre>{JSON.stringify(data, null, 2)}</pre>}
        </div>
      )}
    </div>
  );
}
