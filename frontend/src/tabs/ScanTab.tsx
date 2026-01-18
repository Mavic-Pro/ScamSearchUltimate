import React from "react";
import ErrorBanner from "../components/ErrorBanner";
import { safeGet, safePost } from "../utils/api";
import { getLang, tr } from "../i18n";

interface Job {
  id: number;
  type: string;
  status: string;
  payload: Record<string, string>;
}

export default function ScanTab() {
  const lang = getLang();
  const [url, setUrl] = React.useState("");
  const [keyword, setKeyword] = React.useState("");
  const [fofaQuery, setFofaQuery] = React.useState("");
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);

  const loadJobs = async () => {
    const res = await safeGet<Job[]>("/api/jobs");
    if (res.ok) {
      setJobs(res.data);
      setError(null);
    } else {
      setError(res.error);
    }
  };

  React.useEffect(() => {
    loadJobs();
  }, []);

  const handleSubmit = async () => {
    const res = await safePost<{ queued: number[]; warning?: string | null }>("/api/scan", {
      url: url || null,
      keyword: keyword || null,
      fofa_query: fofaQuery || null
    });
    if (res.ok) {
      setError(null);
      setStatus(tr("Scan queued.", "Scan in coda.", lang));
      setWarning(res.data.warning || null);
      setUrl("");
      setKeyword("");
      setFofaQuery("");
      loadJobs();
    } else {
      setError(res.error);
      setStatus(null);
      setWarning(null);
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
      setError(null);
      window.alert(tr("Rescan queued.", "Riscansione in coda.", lang));
      loadJobs();
    } else {
      setError(res.error);
    }
  };

  const updateJob = async (jobId: number, action: "stop" | "skip" | "remove") => {
    const res = await safePost(`/api/jobs/${jobId}/${action}`, {});
    if (res.ok) {
      setError(null);
      setStatus(tr(`Job ${action} OK.`, `Job ${action} OK.`, lang));
      loadJobs();
    } else {
      setError(res.error);
    }
  };

  return (
    <div className="tab">
      <div className="tab-header">
        <h2>{tr("Scan", "Scan", lang)}</h2>
        <p>
          {tr(
            "Submit URL, keyword, or FOFA query to create scan batches. Dorks run from the Hunt tab.",
            "Invia URL, keyword o query FOFA per creare batch di scan. Le dork si avviano dal tab Hunt.",
            lang
          )}
        </p>
      </div>
      {error && <ErrorBanner message={error} onRepaired={loadJobs} />}
      <div className="panel">
        <div className="form-grid">
          <label>
            URL
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
          </label>
          <label>
            {tr("Keyword", "Keyword", lang)}
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder={tr("brand + login", "brand + login", lang)} />
          </label>
          <label>
            {tr("FOFA Query", "FOFA Query", lang)}
            <input value={fofaQuery} onChange={(e) => setFofaQuery(e.target.value)} placeholder='title="login"' />
          </label>
          <button onClick={handleSubmit}>{tr("Start Scan", "Avvia Scan", lang)}</button>
          {warning && <span className="status">{warning}</span>}
        </div>
      </div>
      <div className="panel">
        <h3>{tr("Queue", "Queue", lang)}</h3>
        {status && <div className="muted">{status}</div>}
        <div className="table">
          {jobs.map((job) => (
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
      </div>
    </div>
  );
}
