import React from "react";
import ErrorBanner from "../components/ErrorBanner";
import { safeGet } from "../utils/api";
import { getLang, tr } from "../i18n";

interface Alert {
  id: number;
  target_id: number;
  kind: string;
  message: string;
  url?: string;
  domain?: string;
}

export default function AlertsTab() {
  const lang = getLang();
  const [alerts, setAlerts] = React.useState<Alert[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);

  const load = async () => {
    const res = await safeGet<Alert[]>("/api/alerts");
    if (res.ok) {
      setAlerts(res.data);
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
        <h2>{tr("Alerts", "Alerts", lang)}</h2>
        <p>{tr("Alert history and optional webhook.", "Storico alert e webhook opzionale.", lang)}</p>
      </div>
      {error && <ErrorBanner message={error} onRepaired={load} />}
      <div className="panel">
        {status && <div className="muted">{status}</div>}
        <div className="table">
          {alerts.map((alert) => (
            <div key={alert.id} className="row alert-row">
              <span>#{alert.id}</span>
              <span>{alert.kind}</span>
              <span className="truncate">{alert.message}</span>
              <span className="truncate">{alert.domain || alert.url || "-"}</span>
              <div className="row-actions">
                {alert.target_id && (
                  <button
                    className="secondary"
                    onClick={() => {
                      localStorage.setItem("lab_target_id", String(alert.target_id));
                      window.dispatchEvent(
                        new CustomEvent("open-lab", { detail: { targetId: alert.target_id } })
                      );
                      setStatus(tr("Opening Lab for alert target.", "Apertura Lab per target alert.", lang));
                    }}
                  >
                    Apri Lab
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
