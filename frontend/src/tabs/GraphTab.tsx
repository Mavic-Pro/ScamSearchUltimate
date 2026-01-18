import React from "react";
import ErrorBanner from "../components/ErrorBanner";
import { getLang, tr } from "../i18n";
import { safeGet, safePost } from "../utils/api";

interface GraphData {
  nodes: Array<Record<string, string | number>>;
  edges: Array<Record<string, string | number>>;
}

export default function GraphTab() {
  const lang = getLang();
  const [graph, setGraph] = React.useState<GraphData>({ nodes: [], edges: [] });
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [kind, setKind] = React.useState("domain");
  const [value, setValue] = React.useState("");
  const [selected, setSelected] = React.useState<{ kind: string; value: string } | null>(null);
  const [aiPrompt, setAiPrompt] = React.useState("");
  const [aiReply, setAiReply] = React.useState<string | null>(null);
  const [aiStatus, setAiStatus] = React.useState<string | null>(null);

  const size = 520;
  const radius = 200;
  const center = size / 2;

  const load = async () => {
    const res = await safeGet<GraphData>("/api/graph");
    if (res.ok) {
      setGraph(res.data);
      setError(null);
    } else {
      setError(res.error);
    }
  };

  const expand = async (k?: string, v?: string) => {
    setStatus(tr("Expanding graph...", "Espansione grafo...", lang));
    const res = await safePost<GraphData>("/api/graph/expand", { kind: k ?? kind, value: v ?? value });
    if (res.ok) {
      setGraph(res.data);
      setError(null);
      setStatus(tr("Graph expanded.", "Grafo espanso.", lang));
    } else {
      setError(res.error);
      setStatus(res.error);
    }
  };

  React.useEffect(() => {
    load();
  }, []);

  const runAi = async () => {
    setAiStatus(tr("AI analysis running...", "Analisi AI in corso...", lang));
    const res = await safePost<{ reply?: string }>("/api/ai/task", {
      task: "graph_insights",
      prompt: aiPrompt || null,
      data: {
        nodes: graph.nodes.slice(0, 80),
        edges: graph.edges.slice(0, 120),
        selected
      }
    });
    if (res.ok) {
      setAiReply(res.data.reply || "");
      setAiStatus(null);
    } else {
      setAiStatus(res.error);
    }
  };

  const nodes = graph.nodes.slice(0, 80);
  const edges = graph.edges.slice(0, 120);
  const positions = new Map<number, { x: number; y: number }>();
  nodes.forEach((node, idx) => {
    const angle = (idx / nodes.length) * Math.PI * 2;
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius;
    positions.set(Number(node.id), { x, y });
  });

  const colorFor = (kindValue: string) => {
    switch (kindValue) {
      case "domain":
        return "#00d4ff";
      case "url":
        return "#ff7a18";
      case "dom_hash":
        return "#5eead4";
      case "ip":
        return "#facc15";
      case "jarm":
        return "#a78bfa";
      case "favicon_hash":
        return "#38bdf8";
      default:
        return "#cbd5f5";
    }
  };

  return (
    <div className="tab">
      <div className="tab-header">
        <h2>{tr("Graph", "Graph", lang)}</h2>
        <p>{tr("Maltego-style graph view with node expansion.", "Vista grafo stile Maltego con espansione nodi.", lang)}</p>
      </div>
      {error && <ErrorBanner message={error} onRepaired={load} />}
      <div className="panel">
        <div className="form-grid">
          <label>
            {tr("Kind", "Tipo", lang)}
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="domain">domain</option>
              <option value="url">url</option>
              <option value="dom_hash">dom_hash</option>
            </select>
          </label>
          <label>
            {tr("Value", "Valore", lang)}
            <input value={value} onChange={(e) => setValue(e.target.value)} />
          </label>
          <button onClick={() => expand()}>{tr("Expand", "Espandi", lang)}</button>
        </div>
        {status && <div className="muted">{status}</div>}
      </div>
      <div className="panel">
        <h3>{tr("Nodes", "Nodi", lang)}</h3>
        <div className="graph-canvas">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {edges.map((edge) => {
              const from = positions.get(Number(edge.from_node));
              const to = positions.get(Number(edge.to_node));
              if (!from || !to) return null;
              return (
                <line
                  key={`e-${edge.id}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth="1"
                />
              );
            })}
            {nodes.map((node) => {
              const pos = positions.get(Number(node.id));
              if (!pos) return null;
              return (
                <g key={`n-${node.id}`}>
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r="8"
                    fill={colorFor(String(node.kind))}
                    onClick={() => {
                      const nk = String(node.kind);
                      const nv = String(node.value);
                      setKind(nk);
                      setValue(nv);
                      setSelected({ kind: nk, value: nv });
                      expand(nk, nv);
                      setStatus(tr("Node expanded.", "Nodo espanso.", lang));
                    }}
                  />
                  <title>{`${node.kind}: ${node.value}`}</title>
                </g>
              );
            })}
          </svg>
        </div>
        {selected && (
          <div className="row-actions" style={{ marginTop: "10px" }}>
            <span className="muted">
              {tr("Selected:", "Selezionato:", lang)} {selected.kind} = {selected.value}
            </span>
            {(selected.kind === "domain" || selected.kind === "url") && (
              <button
                className="secondary"
                onClick={async () => {
                  const res = await safeGet<{ target: Record<string, any> | null }>(
                    `/api/targets/resolve?field=${encodeURIComponent(selected.kind)}&value=${encodeURIComponent(selected.value)}`
                  );
                  if (res.ok && res.data.target?.id) {
                    const targetId = res.data.target.id;
                    localStorage.setItem("lab_target_id", String(targetId));
                    window.dispatchEvent(new CustomEvent("open-lab", { detail: { targetId } }));
                    setStatus(tr("Opening Lab for target.", "Apertura Lab per target.", lang));
                  } else {
                    setError(tr("Target not found for this node.", "Target non trovato per questo nodo.", lang));
                  }
                }}
              >
                {tr("Open Lab", "Apri Lab", lang)}
              </button>
            )}
          </div>
        )}
        <div className="graph-legend">
          <span className="legend domain">domain</span>
          <span className="legend url">url</span>
          <span className="legend dom">dom_hash</span>
          <span className="legend ip">ip</span>
          <span className="legend jarm">jarm</span>
          <span className="legend fav">favicon</span>
        </div>
      </div>
      <div className="panel">
        <h3>{tr("AI Insights", "AI Insights", lang)}</h3>
        <div className="form-grid">
          <label>
            {tr("Optional prompt", "Prompt opzionale", lang)}
            <input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder={tr("e.g. suggest next expansion", "Es: suggerisci prossime espansioni", lang)} />
          </label>
          <button onClick={runAi} className="secondary">{tr("Analyze Graph", "Analizza grafo", lang)}</button>
        </div>
        {aiStatus && <div className="muted">{aiStatus}</div>}
        {aiReply && <div className="muted">{aiReply}</div>}
      </div>
    </div>
  );
}
