import React from "react";
import ErrorBanner from "../components/ErrorBanner";
import { getLang, tr } from "../i18n";
import { API_BASE, safeGet, safePost } from "../utils/api";

interface LabResponse {
  target: Record<string, string | number> | null;
  assets: Array<Record<string, string | number>>;
  indicators: Array<Record<string, string | number>>;
  matches: Array<Record<string, string | number>>;
  yara?: Array<Record<string, string | number>>;
}

interface Job {
  id: number;
  type: string;
  status: string;
  payload: Record<string, string>;
}

export default function LabTab() {
  const lang = getLang();
  const [targetId, setTargetId] = React.useState(() => localStorage.getItem("lab_target_id") || "");
  const [data, setData] = React.useState<LabResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [hashQuery, setHashQuery] = React.useState("");
  const [pivot, setPivot] = React.useState<{ local: any[]; urlscan: string[]; warning?: string | null } | null>(
    null
  );
  const [blockcypherData, setBlockcypherData] = React.useState<any | null>(null);
  const [blockcypherStatus, setBlockcypherStatus] = React.useState<string | null>(null);
  const [holeheData, setHoleheData] = React.useState<any | null>(null);
  const [holeheStatus, setHoleheStatus] = React.useState<string | null>(null);
  const [crtshData, setCrtshData] = React.useState<any | null>(null);
  const [crtshStatus, setCrtshStatus] = React.useState<string | null>(null);
  const [domainsdbData, setDomainsdbData] = React.useState<any | null>(null);
  const [domainsdbStatus, setDomainsdbStatus] = React.useState<string | null>(null);
  const [spiderStatus, setSpiderStatus] = React.useState<string | null>(null);
  const [spiderJobId, setSpiderJobId] = React.useState<number | null>(null);
  const [spiderMaxPages, setSpiderMaxPages] = React.useState(200);
  const [spiderMaxDepth, setSpiderMaxDepth] = React.useState(2);
  const [spiderUseSitemap, setSpiderUseSitemap] = React.useState(true);
  const [fofaField, setFofaField] = React.useState("body");
  const [fofaValue, setFofaValue] = React.useState("");
  const [fofaLimit, setFofaLimit] = React.useState(50);
  const [screenshotError, setScreenshotError] = React.useState(false);
  const [screenshotErrorMessage, setScreenshotErrorMessage] = React.useState<string | null>(null);
  const [faviconError, setFaviconError] = React.useState(false);
  const [faviconErrorMessage, setFaviconErrorMessage] = React.useState<string | null>(null);
  const [showRaw, setShowRaw] = React.useState(false);
  const [showDom, setShowDom] = React.useState(false);
  const [showHeaders, setShowHeaders] = React.useState(false);
  const [domFull, setDomFull] = React.useState<string | null>(null);
  const [domLoading, setDomLoading] = React.useState(false);
  const [domError, setDomError] = React.useState<string | null>(null);
  const [iocStatus, setIocStatus] = React.useState<string | null>(null);
  const [targetJobs, setTargetJobs] = React.useState<Job[]>([]);
  const [jobStatus, setJobStatus] = React.useState<string | null>(null);
  const [whoisData, setWhoisData] = React.useState<any | null>(null);
  const [whoisLoading, setWhoisLoading] = React.useState(false);
  const [whoisError, setWhoisError] = React.useState<string | null>(null);
  const [fofaStatus, setFofaStatus] = React.useState<string | null>(null);
  const [showWhoisRaw, setShowWhoisRaw] = React.useState(false);
  const [actionStatus, setActionStatus] = React.useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = React.useState("");
  const [aiReply, setAiReply] = React.useState<string | null>(null);
  const [aiStatus, setAiStatus] = React.useState<string | null>(null);
  const [aiIncludeDom, setAiIncludeDom] = React.useState(false);
  const [aiIncludeIocs, setAiIncludeIocs] = React.useState(true);
  const [showRedirects, setShowRedirects] = React.useState(false);
  const [queueNotice, setQueueNotice] = React.useState<string | null>(null);
  const queueTimer = React.useRef<number | null>(null);
  const [verifiedOnly, setVerifiedOnly] = React.useState(false);
  const [minConfidence, setMinConfidence] = React.useState(0);
  const [timeline, setTimeline] = React.useState<Array<Record<string, any>>>([]);
  const [timelineStatus, setTimelineStatus] = React.useState<string | null>(null);
  const [diffLeft, setDiffLeft] = React.useState("");
  const [diffRight, setDiffRight] = React.useState("");
  const [diffResult, setDiffResult] = React.useState<{ html: string; headers: string } | null>(null);
  const [diffStatus, setDiffStatus] = React.useState<string | null>(null);

  const load = async () => {
    if (!targetId) return;
    const res = await safeGet<LabResponse>(`/api/lab/${targetId}`);
    if (res.ok) {
      setData(res.data);
      setError(null);
      setScreenshotError(false);
      setScreenshotErrorMessage(null);
      setFaviconError(false);
      setFaviconErrorMessage(null);
      setDomFull(null);
      setDomError(null);
      setDomLoading(false);
      setIocStatus(null);
      setWhoisData(null);
      setWhoisError(null);
      setBlockcypherData(null);
      setBlockcypherStatus(null);
      setHoleheData(null);
      setHoleheStatus(null);
      setCrtshData(null);
      setCrtshStatus(null);
      setDomainsdbData(null);
      setDomainsdbStatus(null);
      setSpiderStatus(null);
      setSpiderJobId(null);
      await loadJobs(res.data.target?.url ? String(res.data.target.url) : null);
      await loadWhois();
      await loadTimeline();
    } else {
      setError(res.error);
    }
  };

  const loadTimeline = async () => {
    if (!targetId) return;
    setTimelineStatus(tr("Loading timeline...", "Caricamento timeline...", lang));
    const res = await safeGet<Array<Record<string, any>>>(`/api/lab/${targetId}/timeline`);
    if (res.ok) {
      setTimeline(res.data);
      setTimelineStatus(null);
    } else {
      setTimelineStatus(res.error);
    }
  };

  const loadConfidenceSetting = async () => {
    const res = await safeGet<{ key: string; value: string | null }>("/api/settings/CONFIDENCE_MIN");
    if (res.ok && res.data.value) {
      const value = Number(res.data.value);
      if (Number.isFinite(value)) {
        setMinConfidence(value);
      }
    }
  };

  React.useEffect(() => {
    if (targetId) {
      load();
    }
    loadConfidenceSetting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (targetId) {
      localStorage.setItem("lab_target_id", targetId);
    }
  }, [targetId]);

  const flashQueueNotice = (message: string) => {
    setQueueNotice(message);
    if (queueTimer.current) {
      window.clearTimeout(queueTimer.current);
    }
    queueTimer.current = window.setTimeout(() => setQueueNotice(null), 4000);
  };

  const queuePivotUrls = async (rawUrls: Array<string | null | undefined>, sourceLabel: string, limit = 200) => {
    const urls = Array.from(
      new Set(rawUrls.map((url) => (url ? String(url).trim() : "")).filter(Boolean))
    );
    if (urls.length === 0) {
      setActionStatus(tr("No pivot results to queue.", "Nessun risultato pivot da mettere in coda.", lang));
      return;
    }
    const queued = await safePost<{ queued: number[] }>("/api/scan/bulk", { urls: urls.slice(0, limit) });
    if (queued.ok) {
      const message = tr(
        `Queued ${queued.data.queued?.length ?? 0} scans from ${sourceLabel}.`,
        `Messi in coda ${queued.data.queued?.length ?? 0} scan da ${sourceLabel}.`,
        lang
      );
      setActionStatus(message);
      flashQueueNotice(message);
    } else {
      setActionStatus(queued.error);
    }
  };

  const normalizeHostUrl = (host: string) => {
    const trimmed = host.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
    const defaultScheme = (() => {
      try {
        const base = data?.target?.url ? new URL(String(data.target.url)) : null;
        return base?.protocol || "https:";
      } catch (err) {
        return "https:";
      }
    })();
    return `${defaultScheme}//${trimmed}`;
  };

  const runBlockcypherPivot = async (address: string) => {
    const value = address.trim();
    if (!value) return;
    setBlockcypherStatus(tr("Blockcypher lookup...", "Ricerca Blockcypher...", lang));
    const res = await safeGet<any>(`/api/pivot/blockcypher?address=${encodeURIComponent(value)}&limit=20`);
    if (res.ok) {
      setBlockcypherData(res.data);
      setBlockcypherStatus(null);
    } else {
      setBlockcypherStatus(res.error);
    }
  };

  const runHolehePivot = async (email: string) => {
    const value = email.trim();
    if (!value) return;
    setHoleheStatus(tr("Holehe lookup...", "Ricerca Holehe...", lang));
    const res = await safeGet<any>(`/api/pivot/holehe?email=${encodeURIComponent(value)}`);
    if (res.ok) {
      setHoleheData(res.data);
      setHoleheStatus(null);
    } else {
      setHoleheStatus(res.error);
    }
  };

  const runCrtshPivot = async (domain: string) => {
    const value = domain.trim();
    if (!value) return;
    setCrtshStatus(tr("CRT.sh lookup...", "Ricerca CRT.sh...", lang));
    const res = await safeGet<{ subdomains: string[] }>(`/api/pivot/crtsh?domain=${encodeURIComponent(value)}`);
    if (res.ok) {
      setCrtshData(res.data);
      setCrtshStatus(null);
      const urls = (res.data.subdomains || []).map((host) => normalizeHostUrl(host)).filter(Boolean);
      if (urls.length > 0) {
        await queuePivotUrls(urls, tr("CRT.sh", "CRT.sh", lang), 200);
      }
    } else {
      setCrtshStatus(res.error);
    }
  };

  const runDomainsdbPivot = async (domain: string) => {
    const value = domain.trim();
    if (!value) return;
    setDomainsdbStatus(tr("DomainsDB lookup...", "Ricerca DomainsDB...", lang));
    const res = await safeGet<{ domains: string[] }>(
      `/api/pivot/domainsdb?domain=${encodeURIComponent(value)}&limit=100`
    );
    if (res.ok) {
      setDomainsdbData(res.data);
      setDomainsdbStatus(null);
      const urls = (res.data.domains || []).map((host) => normalizeHostUrl(host)).filter(Boolean);
      if (urls.length > 0) {
        await queuePivotUrls(urls, tr("DomainsDB", "DomainsDB", lang), 200);
      }
    } else {
      setDomainsdbStatus(res.error);
    }
  };

  const startSpider = async () => {
    const url = data?.target?.url ? String(data.target.url) : "";
    if (!url) return;
    setSpiderStatus(tr("Spider queued...", "Spider in coda...", lang));
    const res = await safePost<{ job_id: number }>("/api/spider/manual", {
      url,
      max_pages: spiderMaxPages,
      max_depth: spiderMaxDepth,
      use_sitemap: spiderUseSitemap
    });
    if (res.ok) {
      setSpiderJobId(res.data.job_id);
      setSpiderStatus(tr(`Spider job queued (#${res.data.job_id}).`, `Spider in coda (#${res.data.job_id}).`, lang));
    } else {
      setSpiderStatus(res.error);
    }
  };

  const stopSpider = async () => {
    if (!spiderJobId) return;
    setSpiderStatus(tr("Stopping spider...", "Stop spider in corso...", lang));
    const res = await safePost(`/api/jobs/${spiderJobId}/stop`, {});
    if (res.ok) {
      setSpiderStatus(tr("Spider stopped.", "Spider fermato.", lang));
    } else {
      setSpiderStatus(res.error);
    }
  };

  const runPivot = async () => {
    if (!hashQuery) return;
    setActionStatus(tr("Pivot hash requested.", "Pivot hash richiesto.", lang));
    const res = await safeGet<{ local: any[]; urlscan: string[]; warning?: string | null }>(
      `/api/pivot/hash?value=${encodeURIComponent(hashQuery)}`
    );
    if (res.ok) {
      setPivot(res.data);
      setError(null);
      const localCount = res.data.local?.length ?? 0;
      const urlscanCount = res.data.urlscan?.length ?? 0;
      setActionStatus(
        tr(
          `Pivot hash completed. Local: ${localCount}, Urlscan: ${urlscanCount}.`,
          `Pivot hash completato. Locali: ${localCount}, Urlscan: ${urlscanCount}.`,
          lang
        )
      );
      const localUrls = (res.data.local || []).map((row) => String(row?.url || "")).filter(Boolean);
      const urlscanUrls = (res.data.urlscan || []).map((url) => String(url || "")).filter(Boolean);
      const pivotLabel = tr("pivot results", "risultati pivot", lang);
      await queuePivotUrls([...localUrls, ...urlscanUrls], pivotLabel);
    } else {
      setError(res.error);
      setActionStatus(res.error);
    }
  };

  const runTargetPivot = async (field: string, value: string) => {
    setActionStatus(tr(`Pivot ${field} requested.`, `Pivot ${field} richiesto.`, lang));
    const res = await safeGet<{ local: any[] }>(`/api/pivot/target?field=${field}&value=${encodeURIComponent(value)}`);
    if (res.ok) {
      setPivot({ local: res.data.local, urlscan: [] });
      setError(null);
      const localCount = res.data.local?.length ?? 0;
      setActionStatus(
        tr(
          `Pivot ${field} completed. Local: ${localCount}.`,
          `Pivot ${field} completato. Locali: ${localCount}.`,
          lang
        )
      );
      const localUrls = (res.data.local || []).map((row) => String(row?.url || "")).filter(Boolean);
      const pivotLabel = tr("pivot results", "risultati pivot", lang);
      await queuePivotUrls(localUrls, pivotLabel);
    } else {
      setError(res.error);
      setActionStatus(res.error);
    }
  };

  const runFofaPivot = async (field: string, value: string) => {
    if (!value.trim()) {
      setFofaStatus(tr("FOFA value is empty.", "Valore FOFA vuoto.", lang));
      return;
    }
    const size = Math.max(1, fofaLimit || 50);
    setActionStatus(tr("FOFA pivot requested.", "Pivot FOFA richiesto.", lang));
    setFofaStatus(tr("FOFA search running...", "Ricerca FOFA in corso...", lang));
    const res = await safeGet<{ results: string[]; query: string; warning?: string | null }>(
      `/api/pivot/fofa?field=${field}&value=${encodeURIComponent(value)}&size=${size}`
    );
    if (res.ok) {
      setPivot({ local: [], urlscan: res.data.results, warning: res.data.warning });
      setError(null);
      if (res.data.warning) {
        setFofaStatus(res.data.warning);
        setActionStatus(res.data.warning);
      } else {
        setFofaStatus(tr("FOFA search completed.", "Ricerca FOFA completata.", lang));
        const fofaCount = res.data.results?.length ?? 0;
        setActionStatus(
          tr(
            `FOFA pivot completed. Results: ${fofaCount}.`,
            `Pivot FOFA completato. Risultati: ${fofaCount}.`,
            lang
          )
        );
      }
      const fofaLabel = tr("FOFA results", "risultati FOFA", lang);
      await queuePivotUrls(res.data.results || [], fofaLabel, size);
    } else {
      setError(res.error);
      setFofaStatus(res.error);
      setActionStatus(res.error);
    }
  };

  const loadJobs = async (url: string | null) => {
    if (!url) {
      setTargetJobs([]);
      return;
    }
    const res = await safeGet<Job[]>("/api/jobs");
    if (res.ok) {
      const filtered = res.data.filter((job) => job.payload?.url === url);
      setTargetJobs(filtered);
      setJobStatus(null);
    } else {
      setJobStatus(res.error);
    }
  };

  const rescanTarget = async () => {
    const url = data?.target?.url;
    if (!url) return;
    const ok = window.confirm(
      tr(
        "Queue a rescan for this target?",
        "Mettere in coda una riscansione per questo target?",
        lang
      )
    );
    if (!ok) return;
    const res = await safePost<{ queued: number[] }>("/api/scan", { url });
    if (res.ok) {
      setJobStatus(tr("Rescan queued.", "Riscansione in coda.", lang));
      flashQueueNotice(tr("Rescan queued.", "Riscansione in coda.", lang));
      await loadJobs(String(url));
    } else {
      setJobStatus(res.error);
    }
  };

  const deleteTarget = async () => {
    if (!targetId) return;
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
      setJobStatus(tr("Target removed.", "Target rimosso.", lang));
      setData(null);
      setTargetJobs([]);
      setTargetId("");
      localStorage.removeItem("lab_target_id");
    } else {
      setJobStatus(res.error);
    }
  };

  const updateJob = async (jobId: number, action: "stop" | "skip" | "remove") => {
    const res = await safePost(`/api/jobs/${jobId}/${action}`, {});
    if (res.ok) {
      setJobStatus(tr(`Job ${action} OK.`, `Job ${action} OK.`, lang));
      await loadJobs(data?.target?.url ? String(data.target.url) : null);
    } else {
      setJobStatus(res.error);
    }
  };

  const runDiff = async () => {
    if (!diffLeft || !diffRight) return;
    setDiffStatus(tr("Diff running...", "Diff in corso...", lang));
    const res = await safeGet<{ html: string; headers: string }>(
      `/api/lab/diff?left_id=${encodeURIComponent(diffLeft)}&right_id=${encodeURIComponent(diffRight)}`
    );
    if (res.ok) {
      setDiffResult(res.data);
      setDiffStatus(null);
    } else {
      setDiffStatus(res.error);
    }
  };

  const copyChain = async (chain: any[]) => {
    if (!chain.length) return;
    const text = chain.map((step) => `${step.status || ""} ${step.url} ${step.location ? `-> ${step.location}` : ""}`.trim()).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      flashQueueNotice(tr("Redirect chain copied.", "Redirect chain copiato.", lang));
    } catch (err) {
      flashQueueNotice(tr("Copy failed.", "Copia fallita.", lang));
    }
  };

  const saveChainAsIocs = async (chain: any[], finalOnly = false, domainsOnly = false) => {
    if (!chain.length) return;
    const steps = finalOnly ? [chain[chain.length - 1]] : chain.slice(0, 20);
    const seen = new Set<string>();
    let count = 0;
    for (const step of steps) {
      if (!step?.url) continue;
      let iocKind = "url";
      let value = String(step.url);
      let dom = data?.target?.domain || null;
      if (domainsOnly) {
        try {
          const parsed = new URL(String(step.url));
          iocKind = "domain";
          value = parsed.hostname;
          dom = parsed.hostname;
        } catch (err) {
          continue;
        }
      }
      const key = `${iocKind}:${value}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      await safePost("/api/iocs", {
        kind: iocKind,
        value,
        source: "redirect_chain",
        target_id: targetId ? Number(targetId) : null,
        url: iocKind === "url" ? String(step.url) : null,
        domain: dom
      });
      count += 1;
    }
    const message = domainsOnly
      ? tr(`Saved ${count} domains as IOCs.`, `Salvati ${count} domini come IOC.`, lang)
      : tr(`Saved ${count} URLs as IOCs.`, `Salvati ${count} URL come IOC.`, lang);
    flashQueueNotice(message);
  };

  const runAi = async () => {
    if (!data) return;
    setAiStatus(tr("AI analysis running...", "Analisi AI in corso...", lang));
    const res = await safePost<{ reply?: string }>("/api/ai/task", {
      task: "lab_analysis",
      prompt: aiPrompt || null,
      data: {
        target: data.target,
        indicators: (data.indicators || []).slice(0, 50),
        assets: (data.assets || []).slice(0, 50),
        matches: (data.matches || []).slice(0, 50),
        yara: (data.yara || []).slice(0, 50)
      },
      target_id: targetId ? Number(targetId) : null,
      include_dom: aiIncludeDom,
      include_iocs: aiIncludeIocs
    });
    if (res.ok) {
      setAiReply(res.data.reply || "");
      setAiStatus(null);
    } else {
      setAiStatus(res.error);
    }
  };

  const parseChain = (raw: any) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (err) {
        return [];
      }
    }
    return [];
  };

  const rescanJob = async (job: Job) => {
    const url = job.payload?.url;
    if (!url) return;
    const ok = window.confirm(
      tr(
        "Queue a rescan for this URL?",
        "Mettere in coda una riscansione per questo URL?",
        lang
      )
    );
    if (!ok) return;
    const res = await safePost<{ queued: number[] }>("/api/scan", { url });
    if (res.ok) {
      setJobStatus(tr("Rescan queued.", "Riscansione in coda.", lang));
      flashQueueNotice(tr("Rescan queued.", "Riscansione in coda.", lang));
      await loadJobs(String(url));
    } else {
      setJobStatus(res.error);
    }
  };

  const handleScreenshotError = async () => {
    setScreenshotError(true);
    try {
      const res = await fetch(`${API_BASE}/api/lab/${targetId}/screenshot`, { cache: "no-store" });
      if (res.status === 404) {
        let detail = "";
        try {
          const data = await res.json();
          detail = data?.detail ? ` (${data.detail})` : "";
        } catch (err) {
          detail = "";
        }
        setScreenshotErrorMessage(
          tr(
            "Screenshot not found.",
            "Screenshot non trovato.",
            lang
          ) + detail
        );
      } else if (!res.ok) {
        setScreenshotErrorMessage(tr("Screenshot unavailable.", "Screenshot non disponibile.", lang));
      } else {
        setScreenshotErrorMessage(null);
      }
    } catch (err) {
      setScreenshotErrorMessage(tr("Error loading screenshot.", "Errore nel caricamento screenshot.", lang));
    }
  };

  const markIoc = async (kind: string, value: string, source: string) => {
    setActionStatus(tr(`Saving IOC (${kind})...`, `Salvataggio IOC (${kind})...`, lang));
    const res = await safePost<{ id: number }>("/api/iocs", {
      kind,
      value,
      source,
      target_id: data?.target?.id,
      url: data?.target?.url,
      domain: data?.target?.domain
    });
    if (res.ok) {
      setIocStatus(tr(`IOC saved (${kind})`, `IOC salvato (${kind})`, lang));
      setActionStatus(tr(`IOC saved (${kind}).`, `IOC salvato (${kind}).`, lang));
    } else {
      setIocStatus(tr(`IOC error: ${res.error}`, `Errore IOC: ${res.error}`, lang));
      setActionStatus(res.error);
    }
  };

  const loadWhois = async () => {
    if (!targetId) return;
    setWhoisLoading(true);
    setWhoisError(null);
    setActionStatus(tr("WHOIS requested.", "WHOIS richiesto.", lang));
    const res = await safeGet<{ domain: string | null; ip: string | null; rdap_domain: any; rdap_ip: any; warning?: string | null }>(
      `/api/lab/${targetId}/whois`
    );
    if (res.ok) {
      setWhoisData(res.data);
      setActionStatus(tr("WHOIS loaded.", "WHOIS caricato.", lang));
    } else {
      setWhoisError(res.error);
      setActionStatus(res.error);
    }
    setWhoisLoading(false);
  };

  const pickRdapEvent = (rdap: any, action: string) => {
    const events = rdap?.events || [];
    const event = events.find((e: any) => e?.eventAction === action);
    return event?.eventDate || "-";
  };

  const listRdapNameservers = (rdap: any) => {
    const ns = rdap?.nameservers || [];
    return ns.map((n: any) => n?.ldhName).filter(Boolean);
  };

  const renderWhoisSummary = () => {
    if (!whoisData) return null;
    const domain = whoisData.rdap_domain;
    const ip = whoisData.rdap_ip;
    const domainNs = listRdapNameservers(domain);
    return (
      <div className="meta-grid">
        <div><strong>Domain:</strong> {whoisData.domain || "-"}</div>
        <div><strong>IP:</strong> {whoisData.ip || "-"}</div>
        <div><strong>Registrar:</strong> {domain?.registrar?.name || domain?.registrar?.handle || "-"}</div>
        <div><strong>Registered:</strong> {pickRdapEvent(domain, "registration")}</div>
        <div><strong>Updated:</strong> {pickRdapEvent(domain, "last changed")}</div>
        <div><strong>Expires:</strong> {pickRdapEvent(domain, "expiration")}</div>
        <div><strong>Nameservers:</strong> {domainNs.length ? domainNs.join(", ") : "-"}</div>
        <div><strong>IP Country:</strong> {ip?.country || "-"}</div>
        <div><strong>IP Name:</strong> {ip?.name || "-"}</div>
      </div>
    );
  };

  const handleFaviconError = async () => {
    setFaviconError(true);
    try {
      const res = await fetch(`${API_BASE}/api/lab/${targetId}/favicon`, { cache: "no-store" });
      if (res.status === 403) {
        setFaviconErrorMessage(
          tr(
            "Remote favicon disabled. Enable REMOTE_FAVICON_ENABLED in Settings.",
            "Favicon remoto disabilitato. Abilita REMOTE_FAVICON_ENABLED in Settings.",
            lang
          )
        );
      } else if (res.status === 404) {
        let detail = "";
        try {
          const data = await res.json();
          detail = data?.detail ? ` (${data.detail})` : "";
        } catch (err) {
          detail = "";
        }
        setFaviconErrorMessage(
          tr(
            "Favicon not found for this target.",
            "Favicon non trovato per questo target.",
            lang
          ) + detail
        );
      } else if (!res.ok) {
        setFaviconErrorMessage(tr("Favicon unavailable.", "Favicon non disponibile.", lang));
      } else {
        setFaviconErrorMessage(null);
      }
    } catch (err) {
      setFaviconErrorMessage(tr("Error loading favicon.", "Errore nel caricamento favicon.", lang));
    }
  };

  return (
    <div className="tab">
      <div className="tab-header">
        <h2>Lab</h2>
        <p>{tr("Target detail, assets, and extracted indicators.", "Dettaglio target, asset e indicatori estratti.", lang)}</p>
      </div>
      {error && <ErrorBanner message={error} onRepaired={load} />}
      <div className="panel">
        <div className="form-grid">
          <label>
            {tr("Target ID", "Target ID", lang)}
            <input value={targetId} onChange={(e) => setTargetId(e.target.value)} />
          </label>
          <button onClick={load}>{tr("Load", "Carica", lang)}</button>
        </div>
        {queueNotice && <div className="warning-banner">{queueNotice}</div>}
      </div>
      {data && (
        <div className="panel">
          <h3>{tr("Target", "Target", lang)}</h3>
          <div className="meta-grid">
            <div><strong>URL:</strong> {data.target?.url || "-"}</div>
            <div><strong>{tr("Domain", "Domain", lang)}:</strong> {data.target?.domain || "-"}</div>
            <div><strong>IP:</strong> {data.target?.ip || "-"}</div>
            <div><strong>JARM:</strong> {data.target?.jarm || "-"}</div>
            <div><strong>{tr("Favicon", "Favicon", lang)}:</strong> {data.target?.favicon_hash || "-"}</div>
            <div><strong>{tr("Tags", "Tag", lang)}:</strong> {data.target?.tags || "-"}</div>
          </div>
          {(() => {
            const chain = parseChain((data.target as any)?.redirect_chain);
            const chainCount = chain.length;
            if (chainCount === 0) return null;
            return (
              <div className="panel" style={{ marginTop: "12px" }}>
                <div className="row-actions">
                  <button className="secondary" onClick={() => setShowRedirects(!showRedirects)}>
                    {showRedirects ? tr("Hide Redirects", "Nascondi Redirects", lang) : tr("Show Redirects", "Mostra Redirects", lang)} ({chainCount})
                  </button>
                  <button className="secondary" onClick={() => copyChain(chain)}>
                    {tr("Copy Chain", "Copia chain", lang)}
                  </button>
                  <button className="secondary" onClick={() => saveChainAsIocs(chain)}>
                    {tr("Save IOCs", "Salva IOC", lang)}
                  </button>
                  <button className="secondary" onClick={() => saveChainAsIocs(chain, true)}>
                    {tr("Save Final URL", "Salva URL finale", lang)}
                  </button>
                  <button className="secondary" onClick={() => saveChainAsIocs(chain, false, true)}>
                    {tr("Save Domains", "Salva domini", lang)}
                  </button>
                </div>
                {showRedirects && (
                  <div className="muted">
                    {chain.map((step: any, idx: number) => (
                      <div key={`redir-${idx}`}>
                        {step.status ? `${step.status} ` : ""}{step.url}
                        {step.location ? ` -> ${step.location}` : ""}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
          <div className="row-actions" style={{ marginBottom: "12px" }}>
            {data.target?.url && (
              <button onClick={rescanTarget} className="secondary" title={tr("Queue a new scan for this target URL", "Metti in coda una nuova scansione per questo target", lang)}>
                {tr("Rescan target URL", "Riscansiona URL target", lang)}
              </button>
            )}
            {data.target?.domain && (
              <button onClick={() => runCrtshPivot(String(data.target?.domain))} className="secondary">
                {tr("CRT.sh Subdomains", "Sottodomini CRT.sh", lang)}
              </button>
            )}
            {data.target?.domain && (
              <button onClick={() => runDomainsdbPivot(String(data.target?.domain))} className="secondary">
                DomainsDB
              </button>
            )}
            <button onClick={deleteTarget} className="secondary danger" title={tr("Delete target and all related data", "Elimina il target e tutti i dati correlati", lang)}>
              {tr("Delete target", "Elimina target", lang)}
            </button>
            {actionStatus && <span className="status">{actionStatus}</span>}
            {jobStatus && <span className="status">{jobStatus}</span>}
          </div>
          <div className="panel" style={{ marginBottom: "12px" }}>
            <h3>{tr("Manual Spider", "Spider Manuale", lang)}</h3>
            <div className="form-grid">
              <label>
                {tr("Max pages", "Max pagine", lang)}
                <input
                  type="number"
                  min={1}
                  value={spiderMaxPages}
                  onChange={(e) => setSpiderMaxPages(Number(e.target.value))}
                />
              </label>
              <label>
                {tr("Max depth", "Profondita max", lang)}
                <input
                  type="number"
                  min={0}
                  value={spiderMaxDepth}
                  onChange={(e) => setSpiderMaxDepth(Number(e.target.value))}
                />
              </label>
              <label>
                {tr("Use sitemap", "Usa sitemap", lang)}
                <input
                  type="checkbox"
                  checked={spiderUseSitemap}
                  onChange={(e) => setSpiderUseSitemap(e.target.checked)}
                />
              </label>
              <button onClick={startSpider}>{tr("Start Spider", "Avvia Spider", lang)}</button>
              {spiderJobId && (
                <button className="secondary" onClick={stopSpider}>
                  {tr("Stop Spider", "Ferma Spider", lang)}
                </button>
              )}
            </div>
            {spiderStatus && <div className="muted">{spiderStatus}</div>}
          </div>
          <div className="hash-grid">
            <div className="hash-card">
              <span className="hash-label">{tr("DOM hash (HTML)", "DOM hash (HTML)", lang)}</span>
              <span className="hash-value">{data.target?.dom_hash || "-"}</span>
              {data.target?.dom_hash && (
                <div className="row-actions">
                  <button onClick={() => setHashQuery(String(data.target?.dom_hash))}>{tr("Pivot", "Pivot", lang)}</button>
                  <button
                    className="secondary"
                    onClick={() => markIoc("dom_hash", String(data.target?.dom_hash), "lab")}
                  >
                    {tr("IOC", "IOC", lang)}
                  </button>
                </div>
              )}
            </div>
            <div className="hash-card">
              <span className="hash-label">{tr("Headers hash", "Headers hash", lang)}</span>
              <span className="hash-value">{data.target?.headers_hash || "-"}</span>
              {data.target?.headers_hash && (
                <div className="row-actions">
                  <button onClick={() => setHashQuery(String(data.target?.headers_hash))}>{tr("Pivot", "Pivot", lang)}</button>
                  <button
                    className="secondary"
                    onClick={() => markIoc("headers_hash", String(data.target?.headers_hash), "lab")}
                  >
                    {tr("IOC", "IOC", lang)}
                  </button>
                </div>
              )}
            </div>
            <div className="hash-card">
              <span className="hash-label">{tr("Favicon hash", "Favicon hash", lang)}</span>
              <span className="hash-value">{data.target?.favicon_hash || "-"}</span>
              {data.target?.favicon_hash && (
                <div className="row-actions">
                  <button onClick={() => runTargetPivot("favicon_hash", String(data.target?.favicon_hash))}>{tr("Pivot", "Pivot", lang)}</button>
                  <button
                    className="secondary"
                    onClick={() => markIoc("favicon_hash", String(data.target?.favicon_hash), "lab")}
                  >
                    {tr("IOC", "IOC", lang)}
                  </button>
                </div>
              )}
            </div>
            <div className="hash-card">
              <span className="hash-label">{tr("Screenshot pHash", "Screenshot pHash", lang)}</span>
              <span className="hash-value">{data.target?.screenshot_phash || "-"}</span>
              {data.target?.screenshot_phash && (
                <div className="row-actions">
                  <button onClick={() => runTargetPivot("screenshot_phash", String(data.target?.screenshot_phash))}>{tr("Pivot", "Pivot", lang)}</button>
                  <button
                    className="secondary"
                    onClick={() => markIoc("screenshot_phash", String(data.target?.screenshot_phash), "lab")}
                  >
                    {tr("IOC", "IOC", lang)}
                  </button>
                </div>
              )}
            </div>
          </div>
          {iocStatus && <div className="muted">{iocStatus}</div>}
          <h3>{tr("Favicon Preview", "Anteprima Favicon", lang)}</h3>
          {!faviconError ? (
            <img
              className="screenshot"
              src={`${API_BASE}/api/lab/${targetId}/favicon`}
              alt="Favicon"
              onError={handleFaviconError}
            />
          ) : (
            <div className="muted">
              {faviconErrorMessage ||
                tr(
                  "Favicon not available.",
                  "Favicon non disponibile.",
                  lang
                )}
            </div>
          )}
          <div className="row-actions">
            {data.target?.dom_hash && (
              <button onClick={() => setHashQuery(String(data.target?.dom_hash))}>{tr("Pivot DOM Hash", "Pivot DOM Hash", lang)}</button>
            )}
            {data.target?.headers_hash && (
              <button onClick={() => setHashQuery(String(data.target?.headers_hash))}>{tr("Pivot Headers Hash", "Pivot Headers Hash", lang)}</button>
            )}
            {data.target?.ip && (
              <button onClick={() => runTargetPivot("ip", String(data.target?.ip))}>{tr("Pivot IP", "Pivot IP", lang)}</button>
            )}
            {data.target?.jarm && (
              <button onClick={() => runTargetPivot("jarm", String(data.target?.jarm))}>{tr("Pivot JARM", "Pivot JARM", lang)}</button>
            )}
            {data.target?.favicon_hash && (
              <button onClick={() => runTargetPivot("favicon_hash", String(data.target?.favicon_hash))}>{tr("Pivot Favicon", "Pivot Favicon", lang)}</button>
            )}
            {data.target?.ip && (
              <button onClick={() => runFofaPivot("ip", String(data.target?.ip))} className="secondary">FOFA IP</button>
            )}
            {data.target?.jarm && (
              <button onClick={() => runFofaPivot("jarm", String(data.target?.jarm))} className="secondary">FOFA JARM</button>
            )}
            {data.target?.favicon_hash && (
              <button onClick={() => runFofaPivot("favicon_hash", String(data.target?.favicon_hash))} className="secondary">FOFA Favicon</button>
            )}
          </div>
          <h3>{tr("Screenshot", "Screenshot", lang)}</h3>
          {data.target?.screenshot_path && !screenshotError ? (
            <img
              className="screenshot"
              src={`${API_BASE}/api/lab/${targetId}/screenshot`}
              alt="Screenshot"
              onError={handleScreenshotError}
            />
          ) : (
            <div className="muted">
              {tr("No screenshot available. Status:", "Nessuno screenshot disponibile. Stato:", lang)}{" "}
              {String(data.target?.screenshot_status || "-")}{" "}
              {data.target?.screenshot_reason ? `(${data.target?.screenshot_reason})` : ""}
              {screenshotErrorMessage ? ` ${screenshotErrorMessage}` : ""}
            </div>
          )}
          {data.target?.screenshot_path && !screenshotError && (
            <div className="row-actions" style={{ marginBottom: "12px" }}>
              <a
                className="button-link"
                href={`${API_BASE}/api/lab/${targetId}/screenshot`}
                download={`target-${targetId}.png`}
              >
                {tr("Download screenshot", "Scarica screenshot", lang)}
              </a>
            </div>
          )}
          <h3>{tr("DOM HTML (excerpt)", "DOM HTML (excerpt)", lang)}</h3>
          <div className="row-actions" style={{ marginBottom: "8px" }}>
            <button className="secondary" onClick={() => setShowDom(!showDom)}>
              {showDom ? tr("Hide DOM", "Nascondi DOM", lang) : tr("Show DOM", "Mostra DOM", lang)}
            </button>
            <button
              className="secondary"
              onClick={async () => {
                if (!targetId) return;
                setActionStatus(tr("Loading full DOM...", "Caricamento DOM completo...", lang));
                setDomLoading(true);
                setDomError(null);
                try {
                  const res = await fetch(`${API_BASE}/api/lab/${targetId}/dom`);
                  if (!res.ok) {
                    let detail = "";
                    try {
                      const data = await res.json();
                      detail = data?.detail ? ` (${data.detail})` : "";
                    } catch (err) {
                      detail = "";
                    }
                    setDomError(tr("Full DOM not available.", "DOM completo non disponibile.", lang) + detail);
                  } else {
                    const text = await res.text();
                    setDomFull(text);
                    setActionStatus(tr("Full DOM loaded.", "DOM completo caricato.", lang));
                  }
                } catch (err) {
                  setDomError(tr("Error downloading DOM.", "Errore nel download del DOM.", lang));
                  setActionStatus(tr("DOM download error.", "Errore download DOM.", lang));
                } finally {
                  setDomLoading(false);
                }
              }}
            >
              {tr("Load full DOM", "Carica DOM completo", lang)}
            </button>
            {targetId && (
              <a
                className="button-link"
                href={`${API_BASE}/api/lab/${targetId}/dom`}
                download={`target-${targetId}.html`}
              >
                {tr("Download DOM", "Scarica DOM", lang)}
              </a>
            )}
          </div>
          {showDom ? (
            data.target?.html_excerpt ? (
              <pre className="code-pre">{String(data.target.html_excerpt)}</pre>
            ) : (
              <div className="muted">{tr("No DOM saved (empty excerpt).", "Nessun DOM salvato (excerpt vuoto).", lang)}</div>
            )
          ) : null}
          {domLoading && <div className="muted">{tr("Loading full DOM...", "Caricamento DOM completo...", lang)}</div>}
          {domError && <div className="muted">{domError}</div>}
          {domFull && <pre className="code-pre">{domFull}</pre>}
          <h3>{tr("Headers (captured)", "Headers (captured)", lang)}</h3>
          <div className="row-actions" style={{ marginBottom: "8px" }}>
            <button className="secondary" onClick={() => setShowHeaders(!showHeaders)}>
              {showHeaders ? tr("Hide Headers", "Nascondi Headers", lang) : tr("Show Headers", "Mostra Headers", lang)}
            </button>
          </div>
          {showHeaders ? (
            data.target?.headers_text ? (
              <pre className="code-pre">{String(data.target.headers_text)}</pre>
            ) : (
              <div className="muted">{tr("No headers saved.", "Nessun header salvato.", lang)}</div>
            )
          ) : null}
          <h3>{tr("Indicators", "Indicatori", lang)}</h3>
          {data.indicators.length === 0 ? (
            <div className="muted">{tr("No indicators found.", "Nessun indicatore trovato.", lang)}</div>
          ) : (
            <div className="table">
              {data.indicators.map((ind) => (
                <div key={String(ind.id)} className="row simple-row">
                  <span>#{ind.id}</span>
                  <span>{ind.kind}</span>
                  <span className="hash-value">{ind.value}</span>
                  <div className="row-actions">
                    {ind.kind === "wallet" && (
                      <button className="secondary" onClick={() => runBlockcypherPivot(String(ind.value))}>
                        Blockcypher
                      </button>
                    )}
                    {ind.kind === "email" && (
                      <button className="secondary" onClick={() => runHolehePivot(String(ind.value))}>
                        Holehe
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <h3>{tr("Assets", "Asset", lang)}</h3>
          {data.assets.length === 0 ? (
            <div className="muted">{tr("No assets found.", "Nessun asset trovato.", lang)}</div>
          ) : (
            <div className="table">
              {data.assets.map((asset) => (
                <div key={String(asset.id)} className="row asset-row">
                  <span>#{asset.id}</span>
                  <span>{asset.type}</span>
                  <span className="truncate">{asset.url}</span>
                  <span className="hash-value">{asset.md5 || asset.sha256 || "-"}</span>
                  <div className="row-actions">
                    {asset.md5 && <button onClick={() => setHashQuery(String(asset.md5))}>MD5</button>}
                    {asset.sha256 && <button onClick={() => setHashQuery(String(asset.sha256))}>SHA256</button>}
                    {asset.md5 && (
                      <button
                        className="secondary"
                        onClick={() => markIoc("md5", String(asset.md5), "asset")}
                      >
                        {tr("IOC", "IOC", lang)}
                      </button>
                    )}
                    {asset.sha256 && (
                      <button
                        className="secondary"
                        onClick={() => markIoc("sha256", String(asset.sha256), "asset")}
                      >
                        {tr("IOC", "IOC", lang)}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <h3>{tr("WHOIS / RDAP", "WHOIS / RDAP", lang)}</h3>
          <div className="row-actions" style={{ marginBottom: "8px" }}>
            <button className="secondary" onClick={loadWhois} title={tr("Refresh WHOIS/RDAP data", "Aggiorna i dati WHOIS/RDAP", lang)}>
              {tr("Refresh WHOIS", "Aggiorna WHOIS", lang)}
            </button>
            <button className="secondary" onClick={() => setShowWhoisRaw(!showWhoisRaw)}>
              {showWhoisRaw ? tr("Hide raw", "Nascondi raw", lang) : tr("Show raw", "Mostra raw", lang)}
            </button>
            {whoisLoading && <span className="status">{tr("Loading...", "Caricamento...", lang)}</span>}
            {whoisError && <span className="status">{whoisError}</span>}
          </div>
          {whoisData && (
            <div className="pivot-results">
              {whoisData.warning && <div className="muted">{whoisData.warning}</div>}
              {renderWhoisSummary()}
              {showWhoisRaw && <pre>{JSON.stringify(whoisData, null, 2)}</pre>}
            </div>
          )}
          <h3>{tr("Target Queue", "Coda Target", lang)}</h3>
          {targetJobs.length === 0 ? (
            <div className="muted">{tr("No jobs for this target.", "Nessun job per questo target.", lang)}</div>
          ) : (
            <div className="table">
              {targetJobs.map((job) => (
                <div key={job.id} className="row job-row">
                  <span>#{job.id}</span>
                  <span>{job.type}</span>
                  <span className={`status ${job.status.toLowerCase()}`}>{job.status}</span>
                  <span>{job.payload?.url || "-"}</span>
                  <div className="row-actions">
                    {job.payload?.url && (
                      <button
                        onClick={() => rescanJob(job)}
                        className="secondary"
                        title={tr("Queue a new scan for this URL", "Metti in coda una nuova scansione per questo URL", lang)}
                      >
                        {tr("Rescan URL", "Riscansiona URL", lang)}
                      </button>
                    )}
                    {(job.status === "QUEUED" || job.status === "RUNNING") && (
                      <>
                        <button
                          onClick={() => updateJob(job.id, "stop")}
                          className="secondary"
                          title={tr("Stop this job", "Ferma questo job", lang)}
                        >
                          {tr("Stop job", "Ferma job", lang)}
                        </button>
                        <button
                          onClick={() => updateJob(job.id, "skip")}
                          className="secondary"
                          title={tr("Skip this job", "Salta questo job", lang)}
                        >
                          {tr("Skip job", "Salta job", lang)}
                        </button>
                      </>
                    )}
                  <button
                    onClick={() => updateJob(job.id, "remove")}
                    className="secondary danger"
                    title={tr("Remove this job from the queue", "Rimuovi questo job dalla coda", lang)}
                  >
                      {tr("Remove job", "Rimuovi job", lang)}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <h3>{tr("Pivot Hash", "Pivot Hash", lang)}</h3>
          <div className="form-grid">
            <label>
              {tr("Hash (md5/sha256)", "Hash (md5/sha256)", lang)}
              <input value={hashQuery} onChange={(e) => setHashQuery(e.target.value)} />
            </label>
            <button onClick={runPivot}>{tr("Search", "Cerca", lang)}</button>
          </div>
          <h3>{tr("Pivot FOFA", "Pivot FOFA", lang)}</h3>
          <div className="form-grid">
            <label>
              {tr("Field", "Campo", lang)}
              <select value={fofaField} onChange={(e) => setFofaField(e.target.value)}>
                <option value="ip">ip</option>
                <option value="jarm">jarm</option>
                <option value="favicon_hash">favicon_hash</option>
                <option value="cert">cert</option>
                <option value="body">body</option>
              </select>
            </label>
            <label>
              {tr("Value", "Valore", lang)}
              <input value={fofaValue} onChange={(e) => setFofaValue(e.target.value)} />
            </label>
            <label>
              {tr("Limit", "Limite", lang)}
              <input
                type="number"
                min={1}
                value={fofaLimit}
                onChange={(e) => setFofaLimit(Number(e.target.value))}
              />
            </label>
            <button onClick={() => runFofaPivot(fofaField, fofaValue)}>{tr("Search", "Cerca", lang)}</button>
          </div>
          {fofaStatus && <div className="muted">{fofaStatus}</div>}
          {pivot && (
            <div className="pivot-results">
              {pivot.warning && <div className="muted">{pivot.warning}</div>}
              <h4>{tr("Local Matches", "Match Locali", lang)}</h4>
              {pivot.local.length === 0 ? (
                <div className="muted">{tr("No local results.", "Nessun risultato locale.", lang)}</div>
              ) : (
                <pre>{JSON.stringify(pivot.local, null, 2)}</pre>
              )}
              <h4>{tr("Urlscan Matches", "Match Urlscan", lang)}</h4>
              {pivot.urlscan.length === 0 ? (
                <div className="muted">{tr("No urlscan results.", "Nessun risultato urlscan.", lang)}</div>
              ) : (
                <pre>{JSON.stringify(pivot.urlscan, null, 2)}</pre>
              )}
            </div>
          )}
          {crtshStatus && <div className="muted">{crtshStatus}</div>}
          {crtshData && (
            <div className="pivot-results">
              <h4>{tr("CRT.sh Subdomains", "Sottodomini CRT.sh", lang)}</h4>
              {(crtshData.subdomains || []).length === 0 ? (
                <div className="muted">{tr("No subdomains found.", "Nessun sottodominio trovato.", lang)}</div>
              ) : (
                <div className="table">
                  {(crtshData.subdomains || []).slice(0, 200).map((host: string) => (
                    <div key={host} className="row simple-row">
                      <span className="hash-value">{host}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {domainsdbStatus && <div className="muted">{domainsdbStatus}</div>}
          {domainsdbData && (
            <div className="pivot-results">
              <h4>DomainsDB</h4>
              {(domainsdbData.domains || []).length === 0 ? (
                <div className="muted">{tr("No domains found.", "Nessun dominio trovato.", lang)}</div>
              ) : (
                <div className="table">
                  {(domainsdbData.domains || []).slice(0, 200).map((host: string) => (
                    <div key={host} className="row simple-row">
                      <span className="hash-value">{host}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {blockcypherStatus && <div className="muted">{blockcypherStatus}</div>}
          {blockcypherData && (
            <div className="pivot-results">
              <h4>Blockcypher</h4>
              {blockcypherData.warning && <div className="muted">{blockcypherData.warning}</div>}
              {blockcypherData.summary && (
                <div className="muted">
                  <div>{tr("Chain", "Chain", lang)}: {blockcypherData.chain || "-"}</div>
                  <div>{tr("Total received", "Totale ricevuto", lang)}: {blockcypherData.summary.total_received ?? "-"}</div>
                  <div>{tr("Total sent", "Totale inviato", lang)}: {blockcypherData.summary.total_sent ?? "-"}</div>
                  <div>{tr("Balance", "Bilancio", lang)}: {blockcypherData.summary.balance ?? "-"}</div>
                  <div>{tr("Transactions", "Transazioni", lang)}: {blockcypherData.summary.tx_count ?? "-"}</div>
                </div>
              )}
              {blockcypherData.related_addresses && blockcypherData.related_addresses.length > 0 && (
                <>
                  <h4>{tr("Related Addresses", "Indirizzi correlati", lang)}</h4>
                  <div className="table">
                    {blockcypherData.related_addresses.slice(0, 200).map((addr: string) => (
                      <div key={addr} className="row simple-row">
                        <span className="hash-value">{addr}</span>
                        <div className="row-actions">
                          <button onClick={() => runBlockcypherPivot(addr)}>{tr("Pivot", "Pivot", lang)}</button>
                          <button className="secondary" onClick={() => markIoc("wallet", addr, "blockcypher")}>
                            {tr("IOC", "IOC", lang)}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {holeheStatus && <div className="muted">{holeheStatus}</div>}
          {holeheData && (
            <div className="pivot-results">
              <h4>Holehe</h4>
              {holeheData.warning && <div className="muted">{holeheData.warning}</div>}
              <pre>{JSON.stringify(holeheData.results || holeheData, null, 2)}</pre>
            </div>
          )}
          <h3>{tr("Signature Matches", "Match Firme", lang)}</h3>
          <div className="row-actions" style={{ marginBottom: "8px" }}>
            <label>
              {tr("Verified only", "Solo verificati", lang)}
              <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />
            </label>
            <label>
              {tr("Min confidence", "Confidenza min", lang)}
              <input
                type="number"
                min={0}
                max={100}
                value={minConfidence}
                onChange={(e) => setMinConfidence(Number(e.target.value))}
              />
            </label>
          </div>
          {(() => {
            const filteredMatches = data.matches.filter((m) => {
              const conf = Number(m.confidence ?? 0);
              const verified = m.verified === true;
              if (verifiedOnly && !verified) return false;
              if (conf < minConfidence) return false;
              return true;
            });
            if (filteredMatches.length === 0) {
              return <div className="muted">{tr("No signature matches found.", "Nessun match di firma trovato.", lang)}</div>;
            }
            return (
              <div className="table">
                {filteredMatches.map((m) => (
                  <div key={String(m.id)} className="row simple-row">
                    <span>#{m.id}</span>
                    <span className="truncate">{m.name || m.signature_id}</span>
                    <span>{m.target_field || "-"}</span>
                    <span className="hash-value truncate">{m.pattern || "-"}</span>
                    <span>{m.verified === true ? "verified" : "unverified"}</span>
                    <span>{m.confidence ?? "-"}</span>
                    <div className="row-actions">
                      {m.pattern && (
                        <button
                          className="secondary"
                          onClick={() =>
                            window.dispatchEvent(
                              new CustomEvent("open-signatures", {
                                detail: { pattern: m.pattern, targetField: m.target_field || "html" }
                              })
                            )
                          }
                        >
                          {tr("Pivot", "Pivot", lang)}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
          <h3>{tr("YARA Matches", "Match YARA", lang)}</h3>
          {(() => {
            const yaraMatches = (data.yara || []).filter((m) => {
              const conf = Number(m.confidence ?? 0);
              const verified = m.verified === true;
              if (verifiedOnly && !verified) return false;
              if (conf < minConfidence) return false;
              return true;
            });
            if (yaraMatches.length === 0) {
              return <div className="muted">{tr("No YARA matches found.", "Nessun match YARA trovato.", lang)}</div>;
            }
            return (
              <div className="table">
                {yaraMatches.map((m) => (
                  <div key={String(m.id)} className="row simple-row">
                    <span>#{m.id}</span>
                    <span>{m.name || m.rule_id}</span>
                    <span>{m.target_field || "-"}</span>
                    <span>{m.verified === true ? "verified" : "unverified"}</span>
                    <span>{m.confidence ?? "-"}</span>
                  </div>
                ))}
              </div>
            );
          })()}
          <div className="row-actions" style={{ marginTop: "12px" }}>
            <button className="secondary" onClick={() => setShowRaw(!showRaw)}>
              {showRaw ? tr("Hide JSON", "Nascondi JSON", lang) : tr("Show JSON", "Mostra JSON", lang)}
            </button>
          </div>
          {showRaw && <pre>{JSON.stringify(data, null, 2)}</pre>}
        </div>
      )}
      <div className="panel">
        <h3>{tr("Timeline", "Timeline", lang)}</h3>
        <div className="row-actions">
          <button className="secondary" onClick={loadTimeline}>{tr("Refresh", "Aggiorna", lang)}</button>
          {timelineStatus && <span className="status">{timelineStatus}</span>}
        </div>
        <div className="table">
          {timeline.map((item, idx) => (
            <div key={`${item.kind}-${idx}`} className="row">
              <span>{item.kind}</span>
              <span className="truncate">{item.message}</span>
              <span className="hash-value">{item.created_at || "-"}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="panel">
        <h3>{tr("Diff Targets", "Diff Target", lang)}</h3>
        <div className="form-grid">
          <label>
            {tr("Left Target ID", "Target ID sinistro", lang)}
            <input value={diffLeft} onChange={(e) => setDiffLeft(e.target.value)} />
          </label>
          <label>
            {tr("Right Target ID", "Target ID destro", lang)}
            <input value={diffRight} onChange={(e) => setDiffRight(e.target.value)} />
          </label>
          <button onClick={runDiff} className="secondary">{tr("Run Diff", "Esegui Diff", lang)}</button>
        </div>
        {diffStatus && <div className="muted">{diffStatus}</div>}
        {diffResult && (
          <div className="diff-panel">
            <h4>HTML</h4>
            <pre>{diffResult.html || "-"}</pre>
            <h4>Headers</h4>
            <pre>{diffResult.headers || "-"}</pre>
          </div>
        )}
      </div>
      <div className="panel">
        <h3>{tr("AI Analysis", "Analisi AI", lang)}</h3>
        <div className="form-grid">
          <label>
            {tr("Optional prompt", "Prompt opzionale", lang)}
            <input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder={tr("e.g. highlight phishing indicators", "Es: evidenzia indicatori di phishing", lang)} />
          </label>
          <label>
            {tr("Include full DOM", "Include DOM completo", lang)}
            <input type="checkbox" checked={aiIncludeDom} onChange={(e) => setAiIncludeDom(e.target.checked)} />
          </label>
          <label>
            {tr("Include saved IOCs", "Include IOC salvati", lang)}
            <input type="checkbox" checked={aiIncludeIocs} onChange={(e) => setAiIncludeIocs(e.target.checked)} />
          </label>
          <button onClick={runAi} className="secondary" disabled={!data}>{tr("Analyze Target", "Analizza target", lang)}</button>
        </div>
        {aiStatus && <div className="muted">{aiStatus}</div>}
        {aiReply && <div className="muted">{aiReply}</div>}
      </div>
    </div>
  );
}
