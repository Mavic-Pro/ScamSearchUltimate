import React from "react";
import { safeGet, safePost } from "../utils/api";
import { getLang, tr } from "../i18n";

interface UpdateStatus {
  ok: boolean;
  local_version?: string;
  latest_version?: string;
  latest_url?: string;
  update_available?: boolean;
  dirty?: boolean;
  error?: string;
}

export default function UpdateBanner() {
  const lang = getLang();
  const [status, setStatus] = React.useState<UpdateStatus | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const load = async () => {
    const res = await safeGet<UpdateStatus>("/api/update/status");
    if (res.ok) {
      setStatus(res.data);
      setMessage(null);
    } else {
      setMessage(res.error);
    }
  };

  const runUpdate = async () => {
    setMessage(tr("Updating...", "Aggiornamento in corso...", lang));
    const res = await safePost<{ message?: string }>("/api/update/run", {});
    if (res.ok) {
      setMessage(res.data.message || tr("Update done. Restart may be required.", "Aggiornato. Potrebbe servire riavvio.", lang));
      await load();
    } else {
      setMessage(res.error);
    }
  };

  React.useEffect(() => {
    load();
    const interval = window.setInterval(load, 5 * 60 * 1000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (message) {
    return <div className="warning-banner">{message}</div>;
  }

  if (!status?.ok || !status.update_available) {
    return null;
  }

  return (
    <div className="warning-banner">
      <div>
        <strong>{tr("Update available:", "Aggiornamento disponibile:", lang)}</strong>{" "}
        {status.local_version} → {status.latest_version}
        {status.dirty && (
          <div className="muted">
            {tr(
              "Local changes detected. Auto-update may be blocked.",
              "Modifiche locali rilevate. L'auto-update potrebbe essere bloccato.",
              lang
            )}
          </div>
        )}
        {status.latest_url && (
          <div className="muted">
            <a href={status.latest_url} target="_blank" rel="noreferrer">
              {tr("Release details", "Dettagli release", lang)}
            </a>
          </div>
        )}
      </div>
      <div className="warning-actions">
        <button className="secondary" onClick={runUpdate}>
          {tr("Update now", "Aggiorna ora", lang)}
        </button>
      </div>
    </div>
  );
}
