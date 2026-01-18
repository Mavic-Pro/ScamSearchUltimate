import React from "react";
import { safeGet } from "../utils/api";
import { getLang, tr } from "../i18n";

interface Job {
  id: number;
  status: string;
}

export default function QueueStatusBadge() {
  const lang = getLang();
  const [counts, setCounts] = React.useState<{ queued: number; running: number }>({ queued: 0, running: 0 });

  const load = async () => {
    const res = await safeGet<Job[]>("/api/jobs");
    if (!res.ok) return;
    const queued = res.data.filter((job) => job.status === "QUEUED").length;
    const running = res.data.filter((job) => job.status === "RUNNING").length;
    setCounts({ queued, running });
  };

  React.useEffect(() => {
    load();
    const interval = window.setInterval(load, 15000);
    return () => window.clearInterval(interval);
  }, []);

  const total = counts.queued + counts.running;
  if (total === 0) return null;

  return (
    <button
      className="secondary"
      onClick={() => window.dispatchEvent(new CustomEvent("open-scan"))}
      title={tr("Open Scan queue", "Apri coda Scan", lang)}
    >
      {tr("Queue", "Coda", lang)}: {counts.queued} | {tr("Running", "In corso", lang)}: {counts.running}
    </button>
  );
}
