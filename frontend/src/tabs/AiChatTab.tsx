import React from "react";
import ErrorBanner from "../components/ErrorBanner";
import { safePost } from "../utils/api";
import { getLang, tr } from "../i18n";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function AiChatTab() {
  const lang = getLang();
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [targetId, setTargetId] = React.useState(() => localStorage.getItem("lab_target_id") || "");
  const [includeDom, setIncludeDom] = React.useState(false);
  const [includeIocs, setIncludeIocs] = React.useState(false);
  const [prompt, setPrompt] = React.useState("");
  const [suggestions, setSuggestions] = React.useState<{
    hunts: Array<Record<string, any>>;
    signatures: Array<Record<string, any>>;
    source: string;
  } | null>(null);

  const send = async () => {
    if (!input.trim()) return;
    setStatus(tr("Sending message...", "Invio messaggio...", lang));
    const next = [...messages, { role: "user", content: input.trim() }];
    setMessages(next);
    setInput("");
    const res = await safePost<{ reply: string }>("/api/ai/chat", {
      messages: next,
      target_id: targetId ? Number(targetId) : null,
      include_dom: includeDom,
      include_iocs: includeIocs
    });
    if (res.ok) {
      setMessages([...next, { role: "assistant", content: res.data.reply }]);
      setError(null);
      setStatus(tr("Reply received.", "Risposta ricevuta.", lang));
    } else {
      setError(res.error);
      setStatus(res.error);
    }
  };

  const suggest = async () => {
    if (!prompt.trim()) return;
    setStatus(tr("Requesting suggestions...", "Richiesta suggerimenti...", lang));
    const res = await safePost<{ hunts: Array<Record<string, any>>; signatures: Array<Record<string, any>>; source: string }>(
      "/api/ai/suggest",
      {
        prompt,
        target_id: targetId ? Number(targetId) : null,
        include_dom: includeDom,
        include_iocs: includeIocs
      }
    );
    if (res.ok) {
      setSuggestions(res.data);
      setError(null);
      setStatus(tr("Suggestions ready.", "Suggerimenti pronti.", lang));
    } else {
      setError(res.error);
      setStatus(res.error);
    }
  };

  const applyHunt = async (hunt: Record<string, any>) => {
    setStatus(tr("Creating hunt...", "Creazione hunt...", lang));
    const res = await safePost("/api/hunt", hunt);
    if (res.ok) {
      setError(null);
      setStatus(tr("Hunt created.", "Hunt creato.", lang));
    } else {
      setError(res.error);
      setStatus(res.error);
    }
  };

  const applySignature = async (sig: Record<string, any>) => {
    setStatus(tr("Creating signature...", "Creazione firma...", lang));
    const res = await safePost("/api/signatures", sig);
    if (res.ok) {
      setError(null);
      setStatus(tr("Signature created.", "Firma creata.", lang));
    } else {
      setError(res.error);
      setStatus(res.error);
    }
  };

  return (
    <div className="tab">
      <div className="tab-header">
        <h2>{tr("AI Chat", "AI Chat", lang)}</h2>
        <p>{tr("Chat with AI to generate queries/rules/signatures (optional).", "Chat con AI per generare query/regole/firme (opzionale).", lang)}</p>
      </div>
      {error && <ErrorBanner message={error} />}
      <div className="panel chat-panel">
        {status && <div className="muted">{status}</div>}
        <div className="form-grid">
          <label>
            {tr("Target ID (optional)", "Target ID (opzionale)", lang)}
            <input value={targetId} onChange={(e) => setTargetId(e.target.value)} />
          </label>
          <label>
            {tr("Include full DOM", "Include DOM completo", lang)}
            <input
              type="checkbox"
              checked={includeDom}
              onChange={(e) => setIncludeDom(e.target.checked)}
            />
          </label>
          <label>
            {tr("Include saved IOCs", "Include IOC salvati", lang)}
            <input
              type="checkbox"
              checked={includeIocs}
              onChange={(e) => setIncludeIocs(e.target.checked)}
            />
          </label>
        </div>
        <div className="muted">
          {tr(
            "Tip: use Target ID from Lab for context (DOM + IOC) and more precise rules.",
            "Suggerimento: usa Target ID da Lab per dare contesto (DOM + IOC) e ottenere regole piu' precise.",
            lang
          )}
        </div>
        <div className="chat-log">
          {messages.map((msg, idx) => (
            <div key={idx} className={`chat-bubble ${msg.role}`}>
              <strong>{msg.role}</strong>
              <span>{msg.content}</span>
            </div>
          ))}
        </div>
        <div className="chat-input">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Chiedi alla AI..." />
          <button onClick={send}>{tr("Send", "Invia", lang)}</button>
        </div>
      </div>
      <div className="panel">
        <h3>{tr("AI Suggestions", "AI Suggestions", lang)}</h3>
        <div className="form-grid">
          <label>
            {tr("Goal", "Obiettivo", lang)}
            <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={tr("e.g. bank login phishing", "Es: phishing login bancario", lang)} />
          </label>
          <button onClick={suggest}>{tr("Suggest Rules", "Suggerisci Regole", lang)}</button>
        </div>
        {suggestions && (
          <div className="suggestions">
            <div className="muted">{tr("Source:", "Fonte:", lang)} {suggestions.source}</div>
            <h4>{tr("Hunt Rules", "Hunt Rules", lang)}</h4>
            <div className="table">
              {suggestions.hunts.map((hunt, idx) => (
                <div key={`hunt-${idx}`} className="row">
                  <span>{hunt.name}</span>
                  <span>{hunt.rule_type}</span>
                  <span>{hunt.rule}</span>
                  <div className="row-actions">
                    <button onClick={() => applyHunt(hunt)} className="secondary">{tr("Create", "Crea", lang)}</button>
                  </div>
                </div>
              ))}
            </div>
            <h4>{tr("Signatures", "Signatures", lang)}</h4>
            <div className="table">
              {suggestions.signatures.map((sig, idx) => (
                <div key={`sig-${idx}`} className="row">
                  <span>{sig.name}</span>
                  <span>{sig.target_field}</span>
                  <span>{sig.pattern}</span>
                  <div className="row-actions">
                    <button onClick={() => applySignature(sig)} className="secondary">{tr("Create", "Crea", lang)}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
