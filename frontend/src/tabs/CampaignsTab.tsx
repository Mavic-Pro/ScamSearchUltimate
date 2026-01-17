import React from "react";
import ErrorBanner from "../components/ErrorBanner";
import { safeGet } from "../utils/api";
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

  const load = async () => {
    const res = await safeGet<Campaign[]>("/api/campaigns");
    if (res.ok) {
      setCampaigns(res.data);
      setError(null);
    } else {
      setError(res.error);
    }
  };

  React.useEffect(() => {
    load();
  }, []);

  return (
    <div className="tab">
      <div className="tab-header">
        <h2>{tr("Campaigns", "Campaigns", lang)}</h2>
        <p>{tr("Clusters by DOM hash, favicon, images, and JARM.", "Cluster per hash DOM, favicon, immagini e JARM.", lang)}</p>
      </div>
      {error && <ErrorBanner message={error} onRepaired={load} />}
      <div className="panel">
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
                        <button
                          className="secondary"
                          onClick={() => {
                            localStorage.setItem("lab_target_id", String(c.sample_target_id));
                            window.dispatchEvent(
                              new CustomEvent("open-lab", { detail: { targetId: c.sample_target_id } })
                            );
                          }}
                        >
                          Apri Lab
                        </button>
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
    </div>
  );
}
