import React from "react";
import ErrorBanner from "../components/ErrorBanner";
import { safeGet, safePost } from "../utils/api";
import { getLang, tr } from "../i18n";

interface Campaign {
  id: number;
  key: string;
  members: number;
  sample_domain?: string;
  sample_url?: string;
  sample_target_id?: number;
}

function splitKey(key: string): { kind: string; value: string } {
  const idx = key.indexOf(":");
  if (idx === -1) return { kind: "unknown", value: key };
  return { kind: key.slice(0, idx), value: key.slice(idx + 1) };
}

export default function CampaignsTab() {
  const lang = getLang();
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = React.useState("");
  const [aiReply, setAiReply] = React.useState<string | null>(null);
  const [aiStatus, setAiStatus] = React.useState<string | null>(null);

  const load = async () => {
    const res = await safeGet<Campaign[]>("/api/campaigns");
    if (res.ok) {
      setCampaigns(res.data);
      setError(null);
    } else {
      setError(res.error);
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
      load();
    } else {
      setError(res.error);
    }
  };

  React.useEffect(() => {
    load();
  }, []);

  const runAi = async () => {
    setAiStatus(tr("AI analysis running...", "Analisi AI in corso...", lang));
    const res = await safePost<{ reply?: string }>("/api/ai/task", {
      task: "campaigns_summary",
      prompt: aiPrompt || null,
      data: { campaigns }
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
        <h2>{tr("Campaigns", "Campaigns", lang)}</h2>
        <p>{tr("Clusters by DOM hash, favicon, images, and JARM.", "Cluster per hash DOM, favicon, immagini e JARM.", lang)}</p>
      </div>
      {error && <ErrorBanner message={error} onRepaired={load} />}
      <div className="panel">
        {status && <div className="muted">{status}</div>}
        <div className="table">
          {campaigns.map((c) => (
            <div key={c.id} className="row campaign-row">
              {(() => {
                const parts = splitKey(c.key);
                return (
                  <>
                    <span>#{c.id}</span>
                    <span className="hash-pill">{parts.kind}</span>
                    <span className="hash-value truncate">{parts.value}</span>
                    <span>{c.members} members</span>
                    <span className="truncate">{c.sample_domain || c.sample_url || "-"}</span>
                    <span>
                      {c.sample_target_id ? (
                        <div className="row-actions">
                          <button
                            className="secondary"
                            onClick={() => {
                              localStorage.setItem("lab_target_id", String(c.sample_target_id));
                              window.dispatchEvent(
                                new CustomEvent("open-lab", { detail: { targetId: c.sample_target_id } })
                              );
                              setStatus(tr("Opening Lab for campaign target.", "Apertura Lab per target campagna.", lang));
                            }}
                          >
                            Apri Lab
                          </button>
                          <button
                            className="secondary"
                            onClick={() => removeTarget(c.sample_target_id!)}
                            title={tr("Delete target and all related data", "Elimina il target e tutti i dati correlati", lang)}
                          >
                            {tr("Delete target", "Elimina target", lang)}
                          </button>
                        </div>
                      ) : (
                        "-"
                      )}
                    </span>
                  </>
                );
              })()}
            </div>
          ))}
        </div>
      </div>
      <div className="panel">
        <h3>{tr("AI Insights", "AI Insights", lang)}</h3>
        <div className="form-grid">
          <label>
            {tr("Optional prompt", "Prompt opzionale", lang)}
            <input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder={tr("e.g. suggest next pivots", "Es: suggerisci prossimi pivot", lang)} />
          </label>
          <button onClick={runAi} className="secondary">{tr("Analyze Campaigns", "Analizza campagne", lang)}</button>
        </div>
        {aiStatus && <div className="muted">{aiStatus}</div>}
        {aiReply && <div className="muted">{aiReply}</div>}
      </div>
    </div>
  );
}
