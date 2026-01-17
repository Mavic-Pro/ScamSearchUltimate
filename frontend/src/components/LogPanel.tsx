import React from "react";
import { safeGet } from "../utils/api";
import { getLang, tr } from "../i18n";

interface LogEntry {
  id: number;
  level: string;
  message: string;
  created_at: string;
}

export default function LogPanel() {
  const lang = getLang();
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    const poll = async () => {
      const res = await safeGet<LogEntry[]>("/api/logs/tail");
      if (!active) return;
      if (res.ok) {
        setLogs(res.data);
        setError(null);
      } else {
        setError(res.error);
      }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="log-panel">
      <div className="log-panel-header">
        <span>{tr("Log Panel", "Log Panel", lang)}</span>
        {error && <span className="log-error">{error}</span>}
      </div>
      <div className="log-panel-body">
        {logs.map((log) => (
          <div key={log.id} className="log-row">
            <span className={`log-level ${log.level.toLowerCase()}`}>{log.level}</span>
            <span className="log-message">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
