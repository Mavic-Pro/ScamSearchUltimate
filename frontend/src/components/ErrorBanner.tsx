import React from "react";
import { safePost } from "../utils/api";
import { getLang, tr } from "../i18n";

interface Props {
  message: string;
  onRepaired?: () => void;
}

export default function ErrorBanner({ message, onRepaired }: Props) {
  const lang = getLang();
  const [status, setStatus] = React.useState<string | null>(null);

  const handleRepair = async () => {
    setStatus(tr("Repair in progress...", "Riparazione in corso...", lang));
    const res = await safePost<{ ok: boolean }>("/api/db/repair", {});
    if (res.ok) {
      setStatus(tr("DB repaired.", "DB riparato.", lang));
      onRepaired?.();
    } else {
      setStatus(res.error);
    }
  };

  return (
    <div className="error-banner">
      <div>
        <strong>{tr("Error:", "Errore:", lang)}</strong> {message}
      </div>
      <div className="error-actions">
        <button onClick={handleRepair}>{tr("Repair DB", "Ripara DB", lang)}</button>
        {status && <span className="status">{status}</span>}
      </div>
    </div>
  );
}
