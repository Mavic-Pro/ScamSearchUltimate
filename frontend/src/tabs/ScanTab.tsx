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
    const res = await safePost<{ queued: number[] }>("/api/scan", {
      url: url || null,
      keyword: keyword || null,
      fofa_query: fofaQuery || null
    });
    if (res.ok) {
      setError(null);
      setUrl("");
      setKeyword("");
      setFofaQuery("");
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
        </div>
      </div>
      <div className="panel">
        <h3>{tr("Queue", "Queue", lang)}</h3>
        <div className="table">
          {jobs.map((job) => (
            <div key={job.id} className="row">
              <span>#{job.id}</span>
              <span>{job.type}</span>
              <span className={`status ${job.status.toLowerCase()}`}>{job.status}</span>
              <span>{job.payload?.url || "-"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
