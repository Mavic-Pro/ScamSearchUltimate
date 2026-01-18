import React from "react";
import { getLang, tr, t } from "../i18n";
import { safeDelete, safeGet, safePost, safePut } from "../utils/api";
import ErrorBanner from "../components/ErrorBanner";

type Automation = {
  id?: number;
  name: string;
  enabled: boolean;
  trigger_type: string;
  trigger_config: Record<string, any>;
  graph: { nodes: any[]; edges: any[] };
};

type AutomationRun = Record<string, any>;

const DEFAULT_GRAPH = {
  nodes: [{ id: "start", type: "start", label: "Start", config: {} }],
  edges: []
};

const NODE_TYPES = [
  "start",
  "condition",
  "switch",
  "set_var",
  "queue_scan",
  "pivot_crtsh",
  "pivot_domainsdb",
  "pivot_blockcypher",
  "pivot_holehe",
  "spider",
  "normalize",
  "dedupe",
  "filter_regex",
  "select_indicators",
  "extract_domains",
  "save_iocs",
  "webhook"
];

export default function AutomationTab() {
  const lang = getLang();
  const [automations, setAutomations] = React.useState<Automation[]>([]);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [current, setCurrent] = React.useState<Automation | null>(null);
  const [runs, setRuns] = React.useState<AutomationRun[]>([]);
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [triggerJson, setTriggerJson] = React.useState("{}");
  const [newNodeId, setNewNodeId] = React.useState("");
  const [newNodeType, setNewNodeType] = React.useState("queue_scan");
  const [newNodeLabel, setNewNodeLabel] = React.useState("");
  const [newEdgeFrom, setNewEdgeFrom] = React.useState("");
  const [newEdgeTo, setNewEdgeTo] = React.useState("");
  const [newEdgeCondition, setNewEdgeCondition] = React.useState("always");
  const [dryRun, setDryRun] = React.useState(false);
  const [eventName, setEventName] = React.useState("scan_done");
  const [eventPayload, setEventPayload] = React.useState("{\"domain\":\"example.com\"}");
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = React.useState<string[]>([]);
  const [graphWarnings, setGraphWarnings] = React.useState<string[]>([]);
  const dragRef = React.useRef<{ id: string; offsetX: number; offsetY: number; startPositions?: Record<string, { x: number; y: number }> } | null>(null);
  const canvasRef = React.useRef<HTMLDivElement | null>(null);
  const [snapToGrid, setSnapToGrid] = React.useState(true);
  const [snapStep, setSnapStep] = React.useState(20);
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const panRef = React.useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const [selectionBox, setSelectionBox] = React.useState<{ active: boolean; startX: number; startY: number; endX: number; endY: number; merge?: boolean } | null>(null);

  const [scanPlaybookName, setScanPlaybookName] = React.useState("");
  const [scanPlaybooks, setScanPlaybooks] = React.useState<Array<Record<string, string>>>(() => {
    const raw = localStorage.getItem("scan_playbooks");
    return raw ? JSON.parse(raw) : [];
  });
  const [huntPlaybookName, setHuntPlaybookName] = React.useState("");
  const [huntPlaybooks, setHuntPlaybooks] = React.useState<Array<Record<string, string>>>(() => {
    const raw = localStorage.getItem("hunt_playbooks");
    return raw ? JSON.parse(raw) : [];
  });
  const [scanUrl, setScanUrl] = React.useState("");
  const [scanKeyword, setScanKeyword] = React.useState("");
  const [scanFofa, setScanFofa] = React.useState("");
  const [huntRuleType, setHuntRuleType] = React.useState("fofa");
  const [huntRule, setHuntRule] = React.useState("");

  const validateGraph = (graph: { nodes?: any[]; edges?: any[] }) => {
    const warnings: string[] = [];
    const nodes = graph.nodes || [];
    const edges = graph.edges || [];
    const ids = new Set(nodes.map((n) => n.id));
    const duplicates = nodes.filter((node, idx) => nodes.findIndex((n) => n.id === node.id) !== idx);
    if (duplicates.length > 0) {
      warnings.push(tr("Duplicate node IDs detected.", "ID nodo duplicati.", lang));
    }
    if (!ids.has("start")) {
      warnings.push(tr("Missing start node.", "Manca il nodo start.", lang));
    }
    for (const edge of edges) {
      if (!ids.has(edge.from) || !ids.has(edge.to)) {
        warnings.push(tr("Edge references missing node.", "Edge con nodo mancante.", lang));
        break;
      }
    }
    return warnings;
  };

  const computeLevels = (nodes: any[], edges: any[]) => {
    const incoming: Record<string, number> = {};
    const outgoing: Record<string, string[]> = {};
    nodes.forEach((node) => {
      incoming[node.id] = 0;
      outgoing[node.id] = [];
    });
    edges.forEach((edge) => {
      if (outgoing[edge.from]) {
        outgoing[edge.from].push(edge.to);
      }
      if (edge.to in incoming) {
        incoming[edge.to] += 1;
      }
    });
    const queue: string[] = nodes.filter((n) => incoming[n.id] === 0).map((n) => n.id);
    const levels = new Map<string, number>();
    while (queue.length > 0) {
      const nodeId = queue.shift() as string;
      const level = levels.get(nodeId) ?? 0;
      for (const neighbor of outgoing[nodeId] || []) {
        const nextLevel = Math.max(levels.get(neighbor) ?? 0, level + 1);
        levels.set(neighbor, nextLevel);
        incoming[neighbor] -= 1;
        if (incoming[neighbor] <= 0) queue.push(neighbor);
      }
    }
    const grouped: Record<number, string[]> = {};
    nodes.forEach((node) => {
      const level = levels.get(node.id) ?? 0;
      if (!grouped[level]) grouped[level] = [];
      grouped[level].push(node.id);
    });
    Object.entries(grouped).forEach(([, ids]) => {
      ids.forEach((id, idx) => levels.set(`idx:${id}`, idx));
    });
    return levels;
  };

  const load = async () => {
    const res = await safeGet<Automation[]>("/api/automations");
    if (res.ok) {
      setAutomations(res.data);
      if (res.data.length > 0 && selectedId === null) {
        setSelectedId(res.data[0].id || null);
      }
    } else {
      setError(res.error);
    }
  };

  const loadAutomation = async (id: number) => {
    const res = await safeGet<{ automation: Automation; runs: AutomationRun[] }>(`/api/automations/${id}`);
    if (res.ok) {
      const auto = res.data.automation;
      auto.graph = auto.graph || DEFAULT_GRAPH;
      auto.graph.nodes = (auto.graph.nodes || []).map((node: any, idx: number) => ({
        ...node,
        x: node.x ?? 80 + (idx % 4) * 200,
        y: node.y ?? 80 + Math.floor(idx / 4) * 140
      }));
      setCurrent(auto);
      setRuns(res.data.runs || []);
      setTriggerJson(JSON.stringify(auto.trigger_config || {}, null, 2));
      setStatus(null);
      setError(null);
      setGraphWarnings(validateGraph(auto.graph));
    } else {
      setError(res.error);
    }
  };

  React.useEffect(() => {
    load();
  }, []);

  React.useEffect(() => {
    if (selectedId) {
      loadAutomation(selectedId);
    } else {
      setCurrent(null);
    }
  }, [selectedId]);

  const createAutomation = async () => {
    const payload: Automation = {
      name: "New automation",
      enabled: true,
      trigger_type: "manual",
      trigger_config: {},
      graph: DEFAULT_GRAPH
    };
    const res = await safePost<{ id: number }>("/api/automations", payload);
    if (res.ok) {
      setSelectedId(res.data.id);
      await load();
    } else {
      setError(res.error);
    }
  };

  const saveAutomation = async () => {
    if (!current || !current.id) return;
    let trigger: Record<string, any> = {};
    try {
      trigger = triggerJson.trim() ? JSON.parse(triggerJson) : {};
    } catch (err) {
      setStatus(tr("Invalid trigger JSON.", "JSON trigger non valido.", lang));
      return;
    }
    const graph = {
      nodes: (current.graph?.nodes || []).map((node: any) => {
        if (typeof node.configText === "string") {
          try {
            const parsed = JSON.parse(node.configText);
            const next = { ...node, config: parsed };
            delete (next as any).configText;
            return next;
          } catch (err) {
            return { ...node, config: node.config || {} };
          }
        }
        return node;
      }),
      edges: current.graph?.edges || []
    };
    const warnings = validateGraph(graph);
    setGraphWarnings(warnings);
    if (warnings.length > 0) {
      setStatus(tr("Fix graph warnings before saving.", "Correggi i warning del grafo prima di salvare.", lang));
      return;
    }
    const payload: Automation = {
      ...current,
      trigger_config: trigger,
      graph
    };
    const res = await safePut(`/api/automations/${current.id}`, payload);
    if (res.ok) {
      setStatus(tr("Saved.", "Salvato.", lang));
      await loadAutomation(current.id);
      await load();
    } else {
      setStatus(res.error);
    }
  };

  const runAutomation = async () => {
    if (!current?.id) return;
    setStatus(tr("Running...", "Esecuzione...", lang));
    const res = await safePost(`/api/automations/${current.id}/run?dry_run=${dryRun ? "1" : "0"}`, {});
    if (res.ok) {
      setStatus(tr("Run completed.", "Esecuzione completata.", lang));
      await loadAutomation(current.id);
    } else {
      setStatus(res.error);
    }
  };

  const triggerEvent = async () => {
    let payload: Record<string, any> = {};
    try {
      payload = eventPayload.trim() ? JSON.parse(eventPayload) : {};
    } catch (err) {
      setStatus(tr("Invalid event payload JSON.", "JSON payload evento non valido.", lang));
      return;
    }
    const res = await safePost("/api/automations/event", { event: eventName.trim(), payload });
    if (res.ok) {
      setStatus(tr("Event queued.", "Evento in coda.", lang));
    } else {
      setStatus(res.error);
    }
  };

  const deleteAutomation = async () => {
    if (!current?.id) return;
    const okConfirm = window.confirm(tr("Delete this automation?", "Eliminare questa automazione?", lang));
    if (!okConfirm) return;
    const res = await safeDelete(`/api/automations/${current.id}`);
    if (res.ok) {
      setSelectedId(null);
      await load();
    } else {
      setError(res.error);
    }
  };

  const updateNode = (nodeId: string, patch: Record<string, any>) => {
    if (!current) return;
    const nodes = (current.graph?.nodes || []).map((node: any) => {
      if (node.id === nodeId) {
        return { ...node, ...patch };
      }
      return node;
    });
    setCurrent({ ...current, graph: { ...current.graph, nodes } });
  };

  const removeNode = (nodeId: string) => {
    if (!current) return;
    const nodes = (current.graph?.nodes || []).filter((node: any) => node.id !== nodeId);
    const edges = (current.graph?.edges || []).filter(
      (edge: any) => edge.from !== nodeId && edge.to !== nodeId
    );
    setCurrent({ ...current, graph: { ...current.graph, nodes, edges } });
  };

  const addNode = () => {
    if (!current) return;
    const id = newNodeId.trim() || `node_${Date.now()}`;
    if ((current.graph?.nodes || []).some((node: any) => node.id === id)) {
      setStatus(tr("Node ID already exists.", "ID nodo gia' esistente.", lang));
      return;
    }
    const node = {
      id,
      type: newNodeType,
      label: newNodeLabel.trim() || newNodeType,
      configText: "{}",
      x: 80,
      y: 80
    };
    const nodes = [...(current.graph?.nodes || []), node];
    setCurrent({ ...current, graph: { ...current.graph, nodes } });
    setNewNodeId("");
    setNewNodeLabel("");
  };

  const addEdge = () => {
    if (!current || !newEdgeFrom.trim() || !newEdgeTo.trim()) return;
    const edges = [
      ...(current.graph?.edges || []),
      { from: newEdgeFrom.trim(), to: newEdgeTo.trim(), condition: newEdgeCondition }
    ];
    setCurrent({ ...current, graph: { ...current.graph, edges } });
  };

  const removeEdge = (idx: number) => {
    if (!current) return;
    const edges = (current.graph?.edges || []).filter((_, index: number) => index !== idx);
    setCurrent({ ...current, graph: { ...current.graph, edges } });
  };

  const autoLayout = () => {
    if (!current) return;
    const graph = current.graph || DEFAULT_GRAPH;
    const nodes = graph.nodes || [];
    const edges = graph.edges || [];
    const levels = computeLevels(nodes, edges);
    const spacingX = 220;
    const spacingY = 140;
    const positioned = nodes.map((node: any) => {
      const level = levels.get(node.id) ?? 0;
      const index = levels.get(`idx:${node.id}`) ?? 0;
      return {
        ...node,
        x: 80 + level * spacingX,
        y: 80 + index * spacingY
      };
    });
    setCurrent({ ...current, graph: { ...graph, nodes: positioned } });
  };

  const startDrag = (event: React.MouseEvent, nodeId: string) => {
    event.preventDefault();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const node = (current?.graph?.nodes || []).find((n: any) => n.id === nodeId);
    if (!node) return;
    const selection = (() => {
      if (event.shiftKey) {
        return selectedNodeIds.includes(nodeId)
          ? selectedNodeIds.filter((id) => id !== nodeId)
          : [...selectedNodeIds, nodeId];
      }
      return [nodeId];
    })();
    setSelectedNodeIds(selection);
    setSelectedNodeId(nodeId);
    const selected = new Set(selection);
    const startPositions: Record<string, { x: number; y: number }> = {};
    (current?.graph?.nodes || []).forEach((n: any) => {
      if (selected.has(n.id) || n.id === nodeId) {
        startPositions[n.id] = { x: n.x || 0, y: n.y || 0 };
      }
    });
    const point = toCanvasPoint(event.clientX, event.clientY, rect);
    const x = node.x || 0;
    const y = node.y || 0;
    dragRef.current = {
      id: nodeId,
      offsetX: point.x - x,
      offsetY: point.y - y,
      startPositions
    };
  };

  const onMouseMove = (event: React.MouseEvent) => {
    if (selectionBox?.active && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const point = toCanvasPoint(event.clientX, event.clientY, rect);
      setSelectionBox({ ...selectionBox, endX: point.x, endY: point.y });
      return;
    }
    if (panRef.current && canvasRef.current) {
      const dx = event.clientX - panRef.current.startX;
      const dy = event.clientY - panRef.current.startY;
      setPan({ x: panRef.current.originX + dx, y: panRef.current.originY + dy });
      return;
    }
    if (!dragRef.current || !canvasRef.current || !current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const point = toCanvasPoint(event.clientX, event.clientY, rect);
    const x = point.x - dragRef.current.offsetX;
    const y = point.y - dragRef.current.offsetY;
    const snap = snapToGrid ? Math.max(5, snapStep) : 1;
    const snappedX = Math.round(x / snap) * snap;
    const snappedY = Math.round(y / snap) * snap;
    const origin = dragRef.current.startPositions?.[dragRef.current.id] || { x: 0, y: 0 };
    const deltaX = snappedX - origin.x;
    const deltaY = snappedY - origin.y;
    const nodes = (current.graph?.nodes || []).map((node: any) => {
      if (dragRef.current?.startPositions?.[node.id]) {
        const base = dragRef.current.startPositions[node.id];
        const nextX = base.x + deltaX;
        const nextY = base.y + deltaY;
        return { ...node, x: Math.max(0, nextX), y: Math.max(0, nextY) };
      }
      return node;
    });
    setCurrent({ ...current, graph: { ...current.graph, nodes } });
  };

  const stopDrag = () => {
    dragRef.current = null;
    panRef.current = null;
    if (selectionBox?.active) {
      finalizeSelection();
    }
  };

  const finalizeSelection = () => {
    if (!selectionBox || !current) {
      setSelectionBox(null);
      return;
    }
    const x1 = Math.min(selectionBox.startX, selectionBox.endX);
    const y1 = Math.min(selectionBox.startY, selectionBox.endY);
    const x2 = Math.max(selectionBox.startX, selectionBox.endX);
    const y2 = Math.max(selectionBox.startY, selectionBox.endY);
    const NODE_WIDTH = 180;
    const NODE_HEIGHT = 64;
    const nextSelected = (current.graph?.nodes || [])
      .filter((node: any) => {
        const nx = node.x || 0;
        const ny = node.y || 0;
        const inside =
          nx + NODE_WIDTH >= x1 &&
          nx <= x2 &&
          ny + NODE_HEIGHT >= y1 &&
          ny <= y2;
        return inside;
      })
      .map((node: any) => node.id);
    const merge = selectionBox.merge ?? false;
    const base = merge ? new Set(selectedNodeIds) : new Set<string>();
    nextSelected.forEach((id) => base.add(id));
    const merged = Array.from(base);
    setSelectedNodeIds(merged);
    setSelectedNodeId(merged[0] || null);
    setSelectionBox(null);
  };

  const startPan = (event: React.MouseEvent) => {
    if (event.target !== canvasRef.current) return;
    if (event.shiftKey) {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const point = toCanvasPoint(event.clientX, event.clientY, rect);
      setSelectionBox({
        active: true,
        startX: point.x,
        startY: point.y,
        endX: point.x,
        endY: point.y,
        merge: event.altKey || event.metaKey || event.ctrlKey
      });
      return;
    }
    panRef.current = { startX: event.clientX, startY: event.clientY, originX: pan.x, originY: pan.y };
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
  };

  const onWheel = (event: React.WheelEvent) => {
    if (!canvasRef.current) return;
    event.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const nextZoom = Math.min(2.5, Math.max(0.4, zoom - event.deltaY * 0.0015));
    const scale = nextZoom / zoom;
    const nextPan = {
      x: mouseX - scale * (mouseX - pan.x),
      y: mouseY - scale * (mouseY - pan.y)
    };
    setZoom(nextZoom);
    setPan(nextPan);
  };

  const toCanvasPoint = (clientX: number, clientY: number, rect: DOMRect) => {
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom
    };
  };

  const renderEdges = (nodes: any[], edges: any[]) => {
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    return edges.map((edge, idx) => {
      const from = nodeMap.get(edge.from);
      const to = nodeMap.get(edge.to);
      if (!from || !to) return null;
      const x1 = (from.x || 0) + 90;
      const y1 = (from.y || 0) + 24;
      const x2 = (to.x || 0) + 90;
      const y2 = (to.y || 0) + 24;
      return (
        <line
          key={`${edge.from}-${edge.to}-${idx}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          className="automation-edge"
        />
      );
    });
  };

  const runScanPlaybook = async (payload: { url?: string; keyword?: string; fofa_query?: string }, label: string) => {
    setStatus(tr("Queueing scan...", "Messa in coda scan...", lang));
    const res = await safePost("/api/scan", payload);
    if (res.ok) {
      setStatus(tr(`Playbook queued: ${label}`, `Playbook in coda: ${label}`, lang));
    } else {
      setStatus(res.error);
    }
  };

  const saveScanPlaybook = () => {
    if (!scanPlaybookName.trim()) {
      setStatus(tr("Playbook name is required.", "Nome playbook richiesto.", lang));
      return;
    }
    const next = [
      { name: scanPlaybookName.trim(), url: scanUrl.trim(), keyword: scanKeyword.trim(), fofa_query: scanFofa.trim() },
      ...scanPlaybooks.filter((pb) => pb.name !== scanPlaybookName.trim())
    ];
    setScanPlaybooks(next);
    localStorage.setItem("scan_playbooks", JSON.stringify(next));
    setStatus(tr("Playbook saved.", "Playbook salvato.", lang));
    setScanPlaybookName("");
  };

  const exportScanPlaybooks = () => {
    const blob = new Blob([JSON.stringify(scanPlaybooks, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "scan-playbooks.json";
    link.click();
  };

  const importScanPlaybooks = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "[]"));
        if (!Array.isArray(parsed)) {
          setStatus(tr("Invalid playbook file.", "File playbook non valido.", lang));
          return;
        }
        setScanPlaybooks(parsed);
        localStorage.setItem("scan_playbooks", JSON.stringify(parsed));
        setStatus(tr("Playbooks imported.", "Playbook importati.", lang));
      } catch (err) {
        setStatus(tr("Invalid playbook file.", "File playbook non valido.", lang));
      }
    };
    reader.readAsText(file);
  };

  const saveHuntPlaybook = () => {
    if (!huntPlaybookName.trim()) {
      setStatus(tr("Playbook name is required.", "Nome playbook richiesto.", lang));
      return;
    }
    const next = [
      { name: huntPlaybookName.trim(), rule_type: huntRuleType, rule: huntRule.trim() },
      ...huntPlaybooks.filter((pb) => pb.name !== huntPlaybookName.trim())
    ];
    setHuntPlaybooks(next);
    localStorage.setItem("hunt_playbooks", JSON.stringify(next));
    setStatus(tr("Playbook saved.", "Playbook salvato.", lang));
    setHuntPlaybookName("");
  };

  const exportHuntPlaybooks = () => {
    const blob = new Blob([JSON.stringify(huntPlaybooks, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "hunt-playbooks.json";
    link.click();
  };

  const importHuntPlaybooks = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "[]"));
        if (!Array.isArray(parsed)) {
          setStatus(tr("Invalid playbook file.", "File playbook non valido.", lang));
          return;
        }
        setHuntPlaybooks(parsed);
        localStorage.setItem("hunt_playbooks", JSON.stringify(parsed));
        setStatus(tr("Playbooks imported.", "Playbook importati.", lang));
      } catch (err) {
        setStatus(tr("Invalid playbook file.", "File playbook non valido.", lang));
      }
    };
    reader.readAsText(file);
  };

  const runHuntPlaybook = async (pb: { name: string; rule_type: string; rule: string }) => {
    setStatus(tr("Queueing hunt...", "Messa in coda hunt...", lang));
    const res = await safePost("/api/hunt/run", { rule_type: pb.rule_type, rule: pb.rule, budget: 50, delay: 0, ttl: 0 });
    if (res.ok) {
      setStatus(tr(`Playbook queued: ${pb.name}`, `Playbook in coda: ${pb.name}`, lang));
    } else {
      setStatus(res.error);
    }
  };

  const removeScanPlaybook = (name: string) => {
    const next = scanPlaybooks.filter((pb) => pb.name !== name);
    setScanPlaybooks(next);
    localStorage.setItem("scan_playbooks", JSON.stringify(next));
  };

  const removeHuntPlaybook = (name: string) => {
    const next = huntPlaybooks.filter((pb) => pb.name !== name);
    setHuntPlaybooks(next);
    localStorage.setItem("hunt_playbooks", JSON.stringify(next));
  };

  return (
    <div className="tab-content">
      <h2>{t("tab_automation", lang)}</h2>
      {error && <ErrorBanner message={error} onRepaired={load} />}
      <div className="panel">
        <h3>{tr("Playbooks", "Playbook", lang)}</h3>
        <div className="grid two-col">
          <div>
            <h4>{tr("Scan Playbooks", "Playbook Scan", lang)}</h4>
            <div className="form-grid">
              <label>
                {tr("Playbook name", "Nome playbook", lang)}
                <input value={scanPlaybookName} onChange={(e) => setScanPlaybookName(e.target.value)} />
              </label>
              <label>
                URL
                <input value={scanUrl} onChange={(e) => setScanUrl(e.target.value)} />
              </label>
              <label>
                Keyword
                <input value={scanKeyword} onChange={(e) => setScanKeyword(e.target.value)} />
              </label>
              <label>
                FOFA Query
                <input value={scanFofa} onChange={(e) => setScanFofa(e.target.value)} />
              </label>
              <button className="secondary" onClick={saveScanPlaybook}>{tr("Save Playbook", "Salva playbook", lang)}</button>
            </div>
            <div className="row-actions">
              <button className="secondary" onClick={exportScanPlaybooks}>{tr("Export", "Export", lang)}</button>
              <input
                id="scan-playbook-import"
                type="file"
                accept="application/json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) importScanPlaybooks(file);
                }}
                style={{ display: "none" }}
              />
              <label className="secondary" htmlFor="scan-playbook-import">
                {tr("Import", "Import", lang)}
              </label>
            </div>
            {scanPlaybooks.length === 0 ? (
              <div className="muted">{tr("No scan playbooks saved.", "Nessun playbook scan salvato.", lang)}</div>
            ) : (
              <div className="table">
                {scanPlaybooks.map((pb) => (
                  <div key={pb.name} className="row simple-row">
                    <span className="truncate">{pb.name}</span>
                    <span className="truncate">{pb.url || pb.keyword || pb.fofa_query || "-"}</span>
                    <div className="row-actions">
                      <button className="secondary" onClick={() => runScanPlaybook(pb, pb.name)}>{tr("Run", "Avvia", lang)}</button>
                      <button className="secondary danger" onClick={() => removeScanPlaybook(pb.name)}>{tr("Delete", "Elimina", lang)}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <h4>{tr("Hunt Playbooks", "Playbook Hunt", lang)}</h4>
            <div className="form-grid">
              <label>
                {tr("Playbook name", "Nome playbook", lang)}
                <input value={huntPlaybookName} onChange={(e) => setHuntPlaybookName(e.target.value)} />
              </label>
              <label>
                {tr("Rule type", "Tipo regola", lang)}
                <select value={huntRuleType} onChange={(e) => setHuntRuleType(e.target.value)}>
                  <option value="fofa">fofa</option>
                  <option value="urlscan">urlscan</option>
                  <option value="dork">dork</option>
                </select>
              </label>
              <label>
                {tr("Rule", "Regola", lang)}
                <input value={huntRule} onChange={(e) => setHuntRule(e.target.value)} />
              </label>
              <button className="secondary" onClick={saveHuntPlaybook}>{tr("Save Playbook", "Salva playbook", lang)}</button>
            </div>
            <div className="row-actions">
              <button className="secondary" onClick={exportHuntPlaybooks}>{tr("Export", "Export", lang)}</button>
              <input
                id="hunt-playbook-import"
                type="file"
                accept="application/json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) importHuntPlaybooks(file);
                }}
                style={{ display: "none" }}
              />
              <label className="secondary" htmlFor="hunt-playbook-import">
                {tr("Import", "Import", lang)}
              </label>
            </div>
            {huntPlaybooks.length === 0 ? (
              <div className="muted">{tr("No hunt playbooks saved.", "Nessun playbook hunt salvato.", lang)}</div>
            ) : (
              <div className="table">
                {huntPlaybooks.map((pb) => (
                  <div key={pb.name} className="row simple-row">
                    <span className="truncate">{pb.name}</span>
                    <span className="truncate">{pb.rule}</span>
                    <div className="row-actions">
                      <button className="secondary" onClick={() => runHuntPlaybook(pb)}>{tr("Run", "Avvia", lang)}</button>
                      <button className="secondary danger" onClick={() => removeHuntPlaybook(pb.name)}>{tr("Delete", "Elimina", lang)}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="panel">
        <h3>{tr("Automation Builder", "Builder Automazioni", lang)}</h3>
        <div className="row-actions" style={{ marginBottom: "8px" }}>
          <button className="secondary" onClick={createAutomation}>{tr("New", "Nuova", lang)}</button>
          <button onClick={saveAutomation}>{tr("Save", "Salva", lang)}</button>
          <button className="secondary" onClick={runAutomation}>{tr("Run", "Avvia", lang)}</button>
          <button className="secondary danger" onClick={deleteAutomation}>{tr("Delete", "Elimina", lang)}</button>
          {status && <span className="status">{status}</span>}
        </div>
        <div className="row-actions" style={{ marginBottom: "12px" }}>
          <label>
            {tr("Dry run", "Dry run", lang)}
            <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
          </label>
          <label>
            {tr("Event", "Evento", lang)}
            <input value={eventName} onChange={(e) => setEventName(e.target.value)} />
          </label>
          <label>
            {tr("Payload (JSON)", "Payload (JSON)", lang)}
            <input value={eventPayload} onChange={(e) => setEventPayload(e.target.value)} />
          </label>
          <button className="secondary" onClick={triggerEvent}>{tr("Trigger Event", "Trigger Evento", lang)}</button>
        </div>
        {graphWarnings.length > 0 && (
          <div className="warning-banner">
            {graphWarnings.join(" | ")}
          </div>
        )}
        <div className="grid two-col">
          <div>
            <h4>{tr("Automations", "Automazioni", lang)}</h4>
            {automations.length === 0 ? (
              <div className="muted">{tr("No automations yet.", "Nessuna automazione.", lang)}</div>
            ) : (
              <div className="table">
                {automations.map((item) => (
                  <div key={String(item.id)} className="row simple-row">
                    <span className="truncate">{item.name}</span>
                    <span>{item.trigger_type}</span>
                    <span>{item.enabled ? "on" : "off"}</span>
                    <div className="row-actions">
                      <button className="secondary" onClick={() => setSelectedId(item.id || null)}>
                        {tr("Open", "Apri", lang)}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {current && (
              <div className="panel" style={{ marginTop: "12px" }}>
                <label>
                  {tr("Name", "Nome", lang)}
                  <input value={current.name} onChange={(e) => setCurrent({ ...current, name: e.target.value })} />
                </label>
                <label>
                  {tr("Enabled", "Abilitata", lang)}
                  <input
                    type="checkbox"
                    checked={current.enabled}
                    onChange={(e) => setCurrent({ ...current, enabled: e.target.checked })}
                  />
                </label>
                <label>
                  {tr("Trigger Type", "Tipo Trigger", lang)}
                  <select
                    value={current.trigger_type}
                    onChange={(e) => setCurrent({ ...current, trigger_type: e.target.value })}
                  >
                    <option value="manual">manual</option>
                    <option value="event">event</option>
                    <option value="schedule">schedule</option>
                  </select>
                </label>
                <label>
                  {tr("Trigger Config (JSON)", "Config Trigger (JSON)", lang)}
                  <textarea
                    value={triggerJson}
                    onChange={(e) => setTriggerJson(e.target.value)}
                    rows={6}
                  />
                  <div className="muted">
                    {tr("Example: {\"event\":\"scan_done\",\"domain_regex\":\".*\"}", "Esempio: {\"event\":\"scan_done\",\"domain_regex\":\".*\"}", lang)}
                  </div>
                </label>
              </div>
            )}
          </div>
          <div>
            <h4>{tr("Graph", "Grafo", lang)}</h4>
            {!current ? (
              <div className="muted">{tr("Select an automation to edit.", "Seleziona un'automazione da modificare.", lang)}</div>
            ) : (
              <>
                <div className="automation-toolbar">
                  <button className="secondary" onClick={autoLayout}>{tr("Auto Layout", "Layout automatico", lang)}</button>
                  <label>
                    {tr("Snap", "Snap", lang)}
                    <input type="checkbox" checked={snapToGrid} onChange={(e) => setSnapToGrid(e.target.checked)} />
                  </label>
                  <label>
                    {tr("Grid", "Griglia", lang)}
                    <input
                      type="number"
                      min={5}
                      max={100}
                      value={snapStep}
                      onChange={(e) => setSnapStep(Number(e.target.value))}
                      style={{ width: "80px" }}
                    />
                  </label>
                  <label>
                    Zoom
                    <input
                      type="range"
                      min="0.4"
                      max="2.5"
                      step="0.1"
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                    />
                  </label>
                  <div className="muted">{tr("Drag nodes to reposition.", "Trascina i nodi per spostarli.", lang)}</div>
                </div>
                <div
                  className="automation-canvas"
                  ref={canvasRef}
                  onMouseMove={onMouseMove}
                  onMouseUp={stopDrag}
                  onMouseLeave={stopDrag}
                  onMouseDown={startPan}
                  onWheel={onWheel}
                  style={{
                    backgroundPosition: `${pan.x}px ${pan.y}px`,
                    backgroundSize: `${20 * zoom}px ${20 * zoom}px`
                  }}
                >
                  <div
                    className="automation-viewport"
                    style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
                  >
                    <svg className="automation-edges">
                      {renderEdges(current.graph?.nodes || [], current.graph?.edges || [])}
                    </svg>
                    {selectionBox?.active && (
                      <div
                        className="automation-selection"
                        style={{
                          left: Math.min(selectionBox.startX, selectionBox.endX),
                          top: Math.min(selectionBox.startY, selectionBox.endY),
                          width: Math.abs(selectionBox.endX - selectionBox.startX),
                          height: Math.abs(selectionBox.endY - selectionBox.startY)
                        }}
                      />
                    )}
                    {(current.graph?.nodes || []).map((node: any) => (
                      <div
                        key={node.id}
                        className={`automation-node ${selectedNodeIds.includes(node.id) ? "active" : ""}`}
                        style={{ left: node.x || 0, top: node.y || 0 }}
                        onMouseDown={(e) => startDrag(e, node.id)}
                        onClick={(e) => {
                          if (e.shiftKey) {
                            setSelectedNodeIds((prev) =>
                              prev.includes(node.id) ? prev.filter((id) => id !== node.id) : [...prev, node.id]
                            );
                          } else {
                            setSelectedNodeIds([node.id]);
                          }
                          setSelectedNodeId(node.id);
                        }}
                      >
                        <div className="node-title">{node.label || node.id}</div>
                        <div className="node-type">{node.type}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="panel">
                  <div className="form-grid">
                    <label>
                      ID
                      <input value={newNodeId} onChange={(e) => setNewNodeId(e.target.value)} />
                    </label>
                    <label>
                      {tr("Type", "Tipo", lang)}
                      <select value={newNodeType} onChange={(e) => setNewNodeType(e.target.value)}>
                        {NODE_TYPES.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {tr("Label", "Etichetta", lang)}
                      <input value={newNodeLabel} onChange={(e) => setNewNodeLabel(e.target.value)} />
                    </label>
                    <button className="secondary" onClick={addNode}>{tr("Add Node", "Aggiungi nodo", lang)}</button>
                  </div>
                </div>
                {(current.graph?.nodes || []).length === 0 ? (
                  <div className="muted">{tr("No nodes yet.", "Nessun nodo.", lang)}</div>
                ) : (
                  <div className="table">
                    {(current.graph?.nodes || []).map((node: any) => (
                      <div key={node.id} className="row simple-row">
                        <span className="truncate">{node.id}</span>
                        <span>{node.type}</span>
                        <span className="truncate">{node.label}</span>
                        <div className="row-actions">
                          <button className="secondary" onClick={() => removeNode(node.id)}>
                            {tr("Remove", "Rimuovi", lang)}
                          </button>
                        </div>
                        <div style={{ marginTop: "8px" }}>
                          <label>
                            {tr("Config (JSON)", "Config (JSON)", lang)}
                            <textarea
                              value={node.configText ?? JSON.stringify(node.config || {}, null, 2)}
                              onChange={(e) => updateNode(node.id, { configText: e.target.value })}
                              rows={4}
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="panel" style={{ marginTop: "12px" }}>
                  <div className="form-grid">
                    <label>
                      {tr("From", "Da", lang)}
                      <input value={newEdgeFrom} onChange={(e) => setNewEdgeFrom(e.target.value)} />
                    </label>
                    <label>
                      {tr("To", "A", lang)}
                      <input value={newEdgeTo} onChange={(e) => setNewEdgeTo(e.target.value)} />
                    </label>
                    <label>
                      {tr("Condition", "Condizione", lang)}
                      <input
                        list="edge-condition-options"
                        value={newEdgeCondition}
                        onChange={(e) => setNewEdgeCondition(e.target.value)}
                      />
                      <datalist id="edge-condition-options">
                        <option value="always" />
                        <option value="true" />
                        <option value="false" />
                        <option value="equals:" />
                        <option value="contains:" />
                        <option value="regex:" />
                        <option value="gte:" />
                        <option value="lte:" />
                      </datalist>
                    </label>
                    <button className="secondary" onClick={addEdge}>{tr("Add Edge", "Aggiungi edge", lang)}</button>
                  </div>
                </div>
                {(current.graph?.edges || []).length === 0 ? (
                  <div className="muted">{tr("No edges yet.", "Nessun edge.", lang)}</div>
                ) : (
                  <div className="table">
                    {(current.graph?.edges || []).map((edge: any, idx: number) => (
                      <div key={`${edge.from}-${edge.to}-${idx}`} className="row simple-row">
                        <span className="truncate">{edge.from}</span>
                        <span>{edge.condition || "always"}</span>
                        <span className="truncate">{edge.to}</span>
                        <div className="row-actions">
                          <button className="secondary" onClick={() => removeEdge(idx)}>
                            {tr("Remove", "Rimuovi", lang)}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="panel" style={{ marginTop: "12px" }}>
                  <h4>{tr("Recent Runs", "Esecuzioni recenti", lang)}</h4>
                  {runs.length === 0 ? (
                    <div className="muted">{tr("No runs yet.", "Nessuna esecuzione.", lang)}</div>
                  ) : (
                    <div className="table">
                      {runs.map((run) => (
                        <div key={String(run.id)} className="row simple-row">
                          <span>#{run.id}</span>
                          <span>{run.status}</span>
                          <span className="truncate">{run.reason || "-"}</span>
                          <span>{run.finished_at || "-"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
