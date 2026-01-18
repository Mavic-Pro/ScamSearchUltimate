import React from "react";
import KeyStatusBanner from "./components/KeyStatusBanner";
import UpdateBanner from "./components/UpdateBanner";
import LogPanel from "./components/LogPanel";
import AlertsTab from "./tabs/AlertsTab";
import CampaignsTab from "./tabs/CampaignsTab";
import ExportTab from "./tabs/ExportTab";
import GraphTab from "./tabs/GraphTab";
import HuntTab from "./tabs/HuntTab";
import IocsTab from "./tabs/IocsTab";
import LabTab from "./tabs/LabTab";
import ScanTab from "./tabs/ScanTab";
import SettingsTab from "./tabs/SettingsTab";
import SignaturesTab from "./tabs/SignaturesTab";
import UrlscanTab from "./tabs/UrlscanTab";
import AiChatTab from "./tabs/AiChatTab";
import YaraTab from "./tabs/YaraTab";
import { getLang, setLang, t, Lang } from "./i18n";

export default function App() {
  const [active, setActive] = React.useState("scan");
  const [lang, setLangState] = React.useState<Lang>(() => getLang());
  const tabs = [
    { key: "scan", label: t("tab_scan", lang), component: <ScanTab /> },
    { key: "hunt", label: t("tab_hunt", lang), component: <HuntTab /> },
    { key: "urlscan", label: t("tab_urlscan", lang), component: <UrlscanTab /> },
    { key: "campaigns", label: t("tab_campaigns", lang), component: <CampaignsTab /> },
    { key: "lab", label: t("tab_lab", lang), component: <LabTab /> },
    { key: "signatures", label: t("tab_signatures", lang), component: <SignaturesTab /> },
    { key: "yara", label: t("tab_yara", lang), component: <YaraTab /> },
    { key: "alerts", label: t("tab_alerts", lang), component: <AlertsTab /> },
    { key: "iocs", label: t("tab_iocs", lang), component: <IocsTab /> },
    { key: "graph", label: t("tab_graph", lang), component: <GraphTab /> },
    { key: "export", label: t("tab_export", lang), component: <ExportTab /> },
    { key: "ai", label: t("tab_ai", lang), component: <AiChatTab /> },
    { key: "settings", label: t("tab_settings", lang), component: <SettingsTab /> }
  ];
  const current = tabs.find((tab) => tab.key === active) || tabs[0];

  React.useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.targetId) {
        localStorage.setItem("lab_target_id", String(detail.targetId));
      }
      setActive("lab");
    };
    window.addEventListener("open-lab", handler);
    return () => window.removeEventListener("open-lab", handler);
  }, []);

  React.useEffect(() => {
    const handler = () => {
      setActive("signatures");
    };
    window.addEventListener("open-signatures", handler);
    return () => window.removeEventListener("open-signatures", handler);
  }, []);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="title-block">
          <h1>{t("app_title", lang)}</h1>
          <span className="subtitle">{t("app_subtitle", lang)}</span>
        </div>
        <div className="row-actions">
          <label className="muted">
            {t("lang_label", lang)}
            <select
              value={lang}
              onChange={(e) => {
                const next = e.target.value as Lang;
                setLang(next);
                setLangState(next);
              }}
            >
              <option value="en">{t("lang_en", lang)}</option>
              <option value="it">{t("lang_it", lang)}</option>
            </select>
          </label>
        </div>
        <div className="nav">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={tab.key === active ? "tab-button active" : "tab-button"}
              onClick={() => setActive(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>
      <main className="app-main">
        <KeyStatusBanner onOpenSettings={() => setActive("settings")} />
        <UpdateBanner />
        {active === "scan" && (
          <div className="hint-card">
            <span>{t("hint_dork", lang)}</span>
            <button onClick={() => setActive("hunt")}>{t("hint_go_hunt", lang)}</button>
          </div>
        )}
        {current.component}
      </main>
      <LogPanel />
    </div>
  );
}
