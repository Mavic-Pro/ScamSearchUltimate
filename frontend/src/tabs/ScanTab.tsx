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
  const [queueNotice, setQueueNotice] = React.useState<string | null>(null);
  const queueTimer = React.useRef<number | null>(null);
  const [playbookName, setPlaybookName] = React.useState("");
  const [playbooks, setPlaybooks] = React.useState<Array<Record<string, string>>>(() => {
    const raw = localStorage.getItem("scan_playbooks");
    return raw ? JSON.parse(raw) : [];
  });
  const [aiPrompt, setAiPrompt] = React.useState("");
  const [aiReply, setAiReply] = React.useState<string | null>(null);
  const [aiStatus, setAiStatus] = React.useState<string | null>(null);

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
      if (queueTimer.current) {
        window.clearTimeout(queueTimer.current);
      }
      setQueueNotice(tr("Scan queued.", "Scan in coda.", lang));
      queueTimer.current = window.setTimeout(() => setQueueNotice(null), 4000);
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

  const runPlaybook = async (payload: { url?: string; keyword?: string; fofa_query?: string }, label: string) => {
    if (!payload.url && !payload.keyword && !payload.fofa_query) {
      setStatus(tr("Playbook is empty.", "Playbook vuoto.", lang));
      return;
    }
    setStatus(tr("Scan queued.", "Scan in coda.", lang));
    const res = await safePost<{ queued: number[]; warning?: string | null }>("/api/scan", {
      url: payload.url || null,
      keyword: payload.keyword || null,
      fofa_query: payload.fofa_query || null
    });
    if (res.ok) {
      if (queueTimer.current) {
        window.clearTimeout(queueTimer.current);
      }
      setQueueNotice(tr(`Playbook queued: ${label}`, `Playbook in coda: ${label}`, lang));
      queueTimer.current = window.setTimeout(() => setQueueNotice(null), 4000);
      setWarning(res.data.warning || null);
      loadJobs();
    } else {
      setError(res.error);
      setStatus(res.error);
    }
  };

  const savePlaybook = () => {
    if (!playbookName.trim()) {
      setStatus(tr("Playbook name is required.", "Nome playbook richiesto.", lang));
      return;
    }
    if (!url.trim() && !keyword.trim() && !fofaQuery.trim()) {
      setStatus(tr("Fill at least one input to save.", "Compila almeno un campo per salvare.", lang));
      return;
    }
    const next = [
      { name: playbookName.trim(), url: url.trim(), keyword: keyword.trim(), fofa_query: fofaQuery.trim() },
      ...playbooks.filter((pb) => pb.name !== playbookName.trim())
    ];
    setPlaybooks(next);
    localStorage.setItem("scan_playbooks", JSON.stringify(next));
    setStatus(tr("Playbook saved.", "Playbook salvato.", lang));
    setPlaybookName("");
  };

  const removePlaybook = (name: string) => {
    const next = playbooks.filter((pb) => pb.name !== name);
    setPlaybooks(next);
    localStorage.setItem("scan_playbooks", JSON.stringify(next));
  };

  const exportPlaybooks = () => {
    const blob = new Blob([JSON.stringify(playbooks, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "scan-playbooks.json";
    link.click();
  };

  const importPlaybooks = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "[]"));
        if (!Array.isArray(parsed)) {
          setStatus(tr("Invalid playbook file.", "File playbook non valido.", lang));
          return;
        }
        setPlaybooks(parsed);
        localStorage.setItem("scan_playbooks", JSON.stringify(parsed));
        setStatus(tr("Playbooks imported.", "Playbook importati.", lang));
      } catch (err) {
        setStatus(tr("Invalid playbook file.", "File playbook non valido.", lang));
      }
    };
    reader.readAsText(file);
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
      if (queueTimer.current) {
        window.clearTimeout(queueTimer.current);
      }
      setQueueNotice(tr("Rescan queued.", "Riscansione in coda.", lang));
      queueTimer.current = window.setTimeout(() => setQueueNotice(null), 4000);
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

  const runAi = async () => {
    setAiStatus(tr("AI analysis running...", "Analisi AI in corso...", lang));
    const res = await safePost<{ reply?: string }>("/api/ai/task", {
      task: "scan_queue_summary",
      prompt: aiPrompt || null,
      data: { jobs }
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
        {queueNotice && <div className="warning-banner">{queueNotice}</div>}
      </div>
      <div className="panel">
        <h3>{tr("Playbooks", "Playbook", lang)}</h3>
        <div className="form-grid">
          <label>
            {tr("Playbook name", "Nome playbook", lang)}
            <input value={playbookName} onChange={(e) => setPlaybookName(e.target.value)} />
          </label>
          <button onClick={savePlaybook} className="secondary">{tr("Save Playbook", "Salva playbook", lang)}</button>
        </div>
        <div className="row-actions">
          <button className="secondary" onClick={exportPlaybooks}>{tr("Export", "Export", lang)}</button>
          <input
            id="scan-playbook-import"
            type="file"
            accept="application/json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importPlaybooks(file);
            }}
            style={{ display: "none" }}
          />
          <label className="secondary" htmlFor="scan-playbook-import">
            {tr("Import", "Import", lang)}
          </label>
        </div>
        <div className="table">
          {playbooks.map((pb) => (
            <div key={pb.name} className="row">
              <span>{pb.name}</span>
              <span className="truncate">{pb.url || pb.keyword || pb.fofa_query || "-"}</span>
              <div className="row-actions">
                <button className="secondary" onClick={() => runPlaybook(pb, pb.name)}>{tr("Run", "Avvia", lang)}</button>
                <button className="secondary danger" onClick={() => removePlaybook(pb.name)}>{tr("Delete", "Elimina", lang)}</button>
              </div>
            </div>
          ))}
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
                  className="secondary danger"
                  title={tr("Remove this job from the queue", "Rimuovi questo job dalla coda", lang)}
                >
                  {tr("Remove job", "Rimuovi job", lang)}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="panel">
        <h3>{tr("AI Insights", "AI Insights", lang)}</h3>
        <div className="form-grid">
          <label>
            {tr("Optional prompt", "Prompt opzionale", lang)}
            <input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder={tr("e.g. prioritize risky jobs", "Es: prioritizza job rischiosi", lang)} />
          </label>
          <button onClick={runAi} className="secondary">{tr("Analyze Queue", "Analizza coda", lang)}</button>
        </div>
        {aiStatus && <div className="muted">{aiStatus}</div>}
        {aiReply && <div className="muted">{aiReply}</div>}
      </div>
    </div>
  );
}
