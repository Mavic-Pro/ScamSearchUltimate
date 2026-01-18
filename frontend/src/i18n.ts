export type Lang = "en" | "it";

const STORAGE_KEY = "ui_lang";

const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    app_title: "ScamHunter Ultimate",
    app_subtitle: "Defensive scan & hunt console",
    tab_scan: "Scan",
    tab_hunt: "Hunt",
    tab_urlscan: "Urlscan",
    tab_campaigns: "Campaigns",
    tab_lab: "Lab",
    tab_signatures: "Signatures",
    tab_yara: "YARA",
    tab_alerts: "Alerts",
    tab_iocs: "IOCs",
    tab_graph: "Graph",
    tab_export: "Export",
    tab_ai: "AI Chat",
    tab_automation: "Automation",
    tab_settings: "Settings",
    hint_dork: "Dorks run from the Hunt tab.",
    hint_go_hunt: "Go to Hunt",
    lang_label: "Language",
    lang_en: "English",
    lang_it: "Italian",
  },
  it: {
    app_title: "ScamHunter Ultimate",
    app_subtitle: "Console difensiva per scan e hunt",
    tab_scan: "Scan",
    tab_hunt: "Hunt",
    tab_urlscan: "Urlscan",
    tab_campaigns: "Campaigns",
    tab_lab: "Lab",
    tab_signatures: "Signatures",
    tab_yara: "YARA",
    tab_alerts: "Alerts",
    tab_iocs: "IOCs",
    tab_graph: "Graph",
    tab_export: "Export",
    tab_ai: "AI Chat",
    tab_automation: "Automazione",
    tab_settings: "Settings",
    hint_dork: "Le dork si avviano dal tab Hunt.",
    hint_go_hunt: "Vai a Hunt",
    lang_label: "Lingua",
    lang_en: "Inglese",
    lang_it: "Italiano",
  },
};

export function getLang(): Lang {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === "it" || raw === "en") return raw;
  return "en";
}

export function setLang(lang: Lang) {
  localStorage.setItem(STORAGE_KEY, lang);
}

export function t(key: string, lang: Lang): string {
  return STRINGS[lang][key] || key;
}

export function tr(enText: string, itText: string, lang: Lang): string {
  return lang === "it" ? itText : enText;
}
