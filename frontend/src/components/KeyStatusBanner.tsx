import React from "react";
import { safeGet } from "../utils/api";
import { getLang, tr } from "../i18n";

interface Props {
  onOpenSettings?: () => void;
}

export default function KeyStatusBanner({ onOpenSettings }: Props) {
  const lang = getLang();
  const [status, setStatus] = React.useState<string>("unknown");

  const load = async () => {
    const res = await safeGet<{ status: string }>("/api/settings/key-status");
    if (res.ok) {
      setStatus(res.data.status);
    }
  };

  React.useEffect(() => {
    load();
  }, []);

  if (status !== "missing" && status !== "invalid") {
    return null;
  }

  return (
    <div className="warning-banner">
      <div>
        <strong>{tr("Warning:", "Attenzione:", lang)}</strong>{" "}
        {status === "missing"
          ? tr(
              "APP_SECRET_KEY missing. Keys may not persist after restart.",
              "APP_SECRET_KEY mancante. Le chiavi potrebbero non persistere dopo un riavvio.",
              lang
            )
          : tr(
              "APP_SECRET_KEY invalid. Encryption will fail until you replace it.",
              "APP_SECRET_KEY non valida. La cifratura fallira' finche non la sostituisci.",
              lang
            )}
        <div className="muted">
          {tr(
            "Go to Settings to generate a key, paste it in `.env`, then restart Docker.",
            "Vai in Settings per generare una chiave e inserirla in `.env`, poi riavvia Docker.",
            lang
          )}
        </div>
      </div>
      <div className="warning-actions">
        <button className="secondary" onClick={onOpenSettings}>
          {tr("Open Settings", "Apri Settings", lang)}
        </button>
      </div>
    </div>
  );
}
