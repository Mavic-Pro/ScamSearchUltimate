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
  const [screenshotError, setScreenshotError] = React.useState(false);
  const [faviconError, setFaviconError] = React.useState(false);
  const [showRaw, setShowRaw] = React.useState(false);
  const [showDom, setShowDom] = React.useState(false);
  const [showHeaders, setShowHeaders] = React.useState(false);
  const [domFull, setDomFull] = React.useState<string | null>(null);
  const [domLoading, setDomLoading] = React.useState(false);
  const [domError, setDomError] = React.useState<string | null>(null);
  const [iocStatus, setIocStatus] = React.useState<string | null>(null);

  const load = async () => {
    if (!targetId) return;
    const res = await safeGet<LabResponse>(`/api/lab/${targetId}`);
    if (res.ok) {
      setData(res.data);
      setError(null);
      setScreenshotError(false);
      setFaviconError(false);
      setDomFull(null);
      setDomError(null);
      setDomLoading(false);
      setIocStatus(null);
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
    const res = await safeGet<{ local: any[]; urlscan: string[]; warning?: string | null }>(
      `/api/pivot/hash?value=${encodeURIComponent(hashQuery)}`
    );
    if (res.ok) {
      setPivot(res.data);
      setError(null);
    } else {
      setError(res.error);
    }
  };

  const runTargetPivot = async (field: string, value: string) => {
    const res = await safeGet<{ local: any[] }>(`/api/pivot/target?field=${field}&value=${encodeURIComponent(value)}`);
    if (res.ok) {
      setPivot({ local: res.data.local, urlscan: [] });
      setError(null);
    } else {
      setError(res.error);
    }
  };

  const runFofaPivot = async (field: string, value: string) => {
    const res = await safeGet<{ results: string[]; query: string; warning?: string | null }>(
      `/api/pivot/fofa?field=${field}&value=${encodeURIComponent(value)}`
    );
    if (res.ok) {
      setPivot({ local: [], urlscan: res.data.results, warning: res.data.warning });
      setError(null);
    } else {
      setError(res.error);
    }
  };

  const markIoc = async (kind: string, value: string, source: string) => {
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
    } else {
      setIocStatus(tr(`IOC error: ${res.error}`, `Errore IOC: ${res.error}`, lang));
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
              onError={() => setFaviconError(true)}
            />
          ) : (
            <div className="muted">
              {tr(
                "Favicon not available. Enable REMOTE_FAVICON_ENABLED in Settings for remote fetch.",
                "Favicon non disponibile. Abilita REMOTE_FAVICON_ENABLED in Settings per il download remoto.",
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
              onError={() => setScreenshotError(true)}
            />
          ) : (
            <div className="muted">
              {tr("No screenshot available. Status:", "Nessuno screenshot disponibile. Stato:", lang)}{" "}
              {String(data.target?.screenshot_status || "-")}{" "}
              {data.target?.screenshot_reason ? `(${data.target?.screenshot_reason})` : ""}
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
                setDomLoading(true);
                setDomError(null);
                try {
                  const res = await fetch(`${API_BASE}/api/lab/${targetId}/dom`);
                  if (!res.ok) {
                    setDomError(tr("Full DOM not available.", "DOM completo non disponibile.", lang));
                  } else {
                    const text = await res.text();
                    setDomFull(text);
                  }
                } catch (err) {
                  setDomError(tr("Error downloading DOM.", "Errore nel download del DOM.", lang));
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
            <button onClick={() => runFofaPivot(fofaField, fofaValue)}>{tr("Search", "Cerca", lang)}</button>
          </div>
          {pivot && (
            <div className="pivot-results">
              {pivot.warning && <div className="muted">{pivot.warning}</div>}
              <h4>{tr("Local Matches", "Match Locali", lang)}</h4>
              <pre>{JSON.stringify(pivot.local, null, 2)}</pre>
              <h4>{tr("Urlscan Matches", "Match Urlscan", lang)}</h4>
              <pre>{JSON.stringify(pivot.urlscan, null, 2)}</pre>
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
