"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  Fragment,
} from "react";
import { createPortal } from "react-dom";
import { LLMInspector, type LLMConfig } from "./inspectors/LLMInspector";
import { CodeInspector, type CodeConfig } from "./inspectors/CodeInspector";
import { SelectorInspector, type SelectorConfig } from "./inspectors/SelectorInspector";
import EndInspector, { type EndNodeData } from "./inspectors/EndInspector";
import Link from "next/link";
import {
  ChevronDown,
  Coins,
  Image as ImageIcon,
  Laptop,
  LogIn,
  Maximize2,
  Minimize2,
  MessageSquareText,
  Mouse,
  Play,
  Plus,
  Search as SearchIcon,
  Sparkles,
  Wrench,
  Workflow as WorkflowIcon,
  X,
} from "lucide-react";
import { API } from "@/lib/env";
import { jsonBody, studioApi } from "@/lib/studioApi";
import { useClickOutside } from "@/hooks/useClickOutside";
import { STEP_KIND_META, stepKindOf, stepNameOf } from "@/utils/templateStep";
import type { TemplateDetail } from "@/types/template";
import type { ModelRef, WorkflowDefinition, WorkflowField, WorkflowStage } from "@weavl/shared";
import { BASE_NODES, NODE_GROUPS, NODE_META, TOP_GROUPS, TOP_GROUP_NODES, type NodeTypeMeta } from "./nodeTypes";
import type { NodeGroup, NodeRow } from "./types";
import styles from "./page.module.scss";

/** 节点卡片的展示数据 */
/** step.type 归一化到的图标主色 —— 与画布 KIND_META 一致 */
const KIND_ACCENT: Record<string, { color: string; icon: string }> = {
  llm: { color: "#d44b7e", icon: "✦" },
  "image-gen": { color: "#d4537e", icon: "✦" },
  "video-gen": { color: "#378add", icon: "▷" },
  tts: { color: "#378add", icon: "♪" },
  ffmpeg: { color: "#378add", icon: "◐" },
  code: { color: "#378add", icon: "{}" },
  selector: { color: "#378add", icon: "⤳" },
  http: { color: "#5e5e66", icon: "↗" },
  mcp: { color: "#5e5e66", icon: "◇" },
};

/**
 * 工作流编辑器（/workflow?id=xxx）—— 全屏独占页面
 * 静态导出兼容：query string 读 id；不挂 AppShell，铺满整个视口。
 *
 * 布局：顶栏（标题 / tab / 发布） + 中间节点流（CSS Grid 横向） + 底部工具条
 * 数据来自 GET /templates/:id，steps 按顺序水平排列，连线用 ::after 伪元素绘制。
 *
 * @returns 全屏工作流编辑器。
 */
export default function WorkflowPage() {
  const [id, setId] = useState("");
  const [workflowId, setWorkflowId] = useState("");
  const [workflowDefinition, setWorkflowDefinition] = useState<WorkflowDefinition | null>(null);
  const [graphReady, setGraphReady] = useState(false);

  /* 读 id —— window.location.search 避免 useSearchParams 静态导出问题 */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    setId(sp.get("id") ?? "");
    setWorkflowId(sp.get("workflowId") ?? "");
  }, []);

  const [template, setTemplate] = useState<TemplateDetail | null>(null);

  /* 是否空白工作流（直接新建，无 id） */
  const isBlank = id === "";
  const blankLoadedRef = useRef(false);

  /* 空白工作流：自动注入 start + end 两个节点（无连线，让用户主动从 start 端口拉线）
     默认把两个节点分别放在视口可见区域两端（开始靠左、结束靠右），给用户最大的可扩展空间 */
  useEffect(() => {
    if (!isBlank || blankLoadedRef.current) return;
    blankLoadedRef.current = true;
    setStartNode({
      id: "start",
      vars: [],
    });
    setCustomNodes([
      { id: "end", type: "end", title: "结束", color: "#5e5e66" },
      // 演示用：默认放一个 LLM 节点在中央
      { id: "llm-demo", type: "llm", title: "大模型", color: "#d44b7e" },
    ]);
    /* 初始化 endNode（结束节点配置：返回变量/返回文本模式 + outputs + 文本 + 流式） */
    setEndNode({
      id: "end",
      mode: "variables",
      outputs: [{ name: "output", ref: "" }],
      text: "{{output}}",
      streaming: true,
    });
    /* 空白模式默认无连线（让用户从 start 端口主动拉线连接） */
    setEdges([]);

    /* 把两个节点放在视口两端（左/右各留 40px 边距），垂直居中
       用画布坐标直接 = 视口像素（不缩放、不平移），让首次进入就有最大的工作空间 */
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const yCenter = vh / 2 - NODE_H / 2 - 40; /* 上移 40 让画布头/底栏不遮 */
    setPositions({
      start: { x: 40, y: yCenter },
      end: { x: vw - NODE_W - 40, y: yCenter },
    });
    /* 同步调整 view 为 1:1 + 零偏移，确保上述坐标就是 viewport 实际位置 */
    setView({ scale: 1, x: 0, y: 0 });
  }, [isBlank]);

  /* 拉模板详情 */
  useEffect(() => {
    if (!id) return;
    fetch(`${API}/templates/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((t: TemplateDetail) => setTemplate(t))
      .catch(() => setTemplate(null));
  }, [id]);

  /* 交互模式（鼠标 / 触控板）—— 弹层 + click-outside 关闭 */
  type InteractionMode = "mouse" | "trackpad";
  const [mode, setMode] = useState<InteractionMode>("trackpad");
  const [modeOpen, setModeOpen] = useState(false);
  const modeRef = useRef<HTMLDivElement | null>(null);
  const modeBtnRef = useRef<HTMLButtonElement | null>(null);
  useClickOutside(modeOpen, [modeRef, modeBtnRef], () => setModeOpen(false));

  /* 画布视口：scale + pan（参考画布 React Flow 视口）
     初始 scale 0.5 + 适度偏移，让第一屏刚好框住初始节点行 */
  const [view, setView] = useState({ scale: 0.55, x: 60, y: 20 });
  const flowRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef<{ active: boolean; startX: number; startY: number; baseX: number; baseY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0,
  });

  /* 缩放：以光标位置为锚点 */
  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    setView((v) => {
      const next = Math.max(0.2, Math.min(3, v.scale * factor));
      const k = next / v.scale;
      return {
        scale: next,
        x: cx - (cx - v.x) * k,
        y: cy - (cy - v.y) * k,
      };
    });
  }, []);

  /* 滚轮（原生 non-passive 监听，preventDefault 才能拦掉浏览器整页缩放）：
     - 鼠标模式：wheel = 缩放（光标为锚点）
     - 触控板模式：wheel = 平移（deltaX/deltaY）；ctrl+wheel = 捏合缩放
     deps 含 !!template：loading 态 flowRef 为 null，模板到位后需重挂监听 */
  useEffect(() => {
    const el = flowRef.current;
    if (!el) return;
    const handler = (e: globalThis.WheelEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      if (mode === "mouse") {
        e.preventDefault();
        zoomAt(e.deltaY < 0 ? 1.08 : 1 / 1.08, cx, cy);
      } else if (e.ctrlKey || e.metaKey) {
        /* 触控板捏合：浏览器自动转成 ctrl+wheel，必须拦下否则整页缩放 */
        e.preventDefault();
        zoomAt(e.deltaY < 0 ? 1.02 : 1 / 1.02, cx, cy);
      } else {
        /* 触控板两指拖动 = 平移 */
        e.preventDefault();
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [mode, zoomAt, template]);

  /* 按下开始平移（鼠标左键 / 触控板单指） */
  const onFlowMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      /* 节点卡片 / 弹层 / 端口内部不触发平移 */
      const target = e.target as HTMLElement;
      if (
        target.closest(`.${styles.nodeCard}`) ||
        target.closest("[data-port-out]") ||
        target.closest(`.${styles.modePopover}`) ||
        target.closest(`.${styles.zoomPopover}`) ||
        target.closest(`.${styles.pickerPopover}`) ||
        target.closest(`.${styles.inspector}`)
      )
        return;
      panRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        baseX: view.x,
        baseY: view.y,
      };
    },
    [view.x, view.y],
  );

  /* 全局 mousemove / mouseup 监听平移 */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!panRef.current.active) return;
      setView((v) => ({
        ...v,
        x: panRef.current.baseX + (e.clientX - panRef.current.startX),
        y: panRef.current.baseY + (e.clientY - panRef.current.startY),
      }));
    };
    const onUp = () => {
      panRef.current.active = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  /* 缩放 select 同步 */
  const setScale = useCallback((percent: number) => {
    setView((v) => ({ ...v, scale: percent / 100 }));
  }, []);

  /* 缩放档位弹层 —— 实时百分比显示 + 点选档位（滚轮缩放可产生任意中间值） */
  const ZOOM_STEPS = [25, 50, 75, 100, 150, 200];
  const [zoomOpen, setZoomOpen] = useState(false);
  const zoomRef = useRef<HTMLDivElement | null>(null);
  const zoomBtnRef = useRef<HTMLButtonElement | null>(null);
  useClickOutside(zoomOpen, [zoomRef, zoomBtnRef], () => setZoomOpen(false));
  const zoomPercent = Math.round(view.scale * 100);

  /* 节点库弹层（点"添加节点"） */
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const pickerBtnRef = useRef<HTMLButtonElement | null>(null);
  useClickOutside(pickerOpen, [pickerRef, pickerBtnRef], () => {
    setPickerOpen(false);
    setPickerSearch("");
  });

  /* 选中节点：id 形如 "start" / "step:topics"，null = 未选中 */
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  /* "开始" 节点（用户动态添加） */
  const [startNode, setStartNode] = useState<{ id: string; vars: StartVar[]; description?: string } | null>(null);

  /* 已删除的 step id（Delete 键删除节点后从画布隐藏） */
  const [deletedStepIds, setDeletedStepIds] = useState<Set<string>>(new Set());

  /* JSON 导入弹窗：把 StartInspector 内的弹窗状态提升到外层，让顶部"全屏"按钮也能触发 */
  const [jsonOpen, setJsonOpen] = useState(false);

  /** 已计算的连线 path 数据（在 useLayoutEffect 里读 DOM 后存进来，保证拖拽/缩放/平移后路径实时跟随卡片） */
  const [edgePaths, setEdgePaths] = useState<
    Record<string, { x1: number; y1: number; x2: number; y2: number; d: string }>
  >({});

  /* Portal tooltip 状态：渲染到 body 根部，彻底摆脱任何 stacking context 限制 */
  const [tip, setTip] = useState<{ text: string; x: number; y: number; place: "top" | "bottom" } | null>(null);
  const showTip = useCallback((el: HTMLElement, text: string, place: "top" | "bottom" = "top") => {
    const r = el.getBoundingClientRect();
    setTip({
      text,
      x: r.left + r.width / 2,
      y: place === "top" ? r.top - 8 : r.bottom + 8,
      place,
    });
  }, []);
  const hideTip = useCallback(() => setTip(null), []);

  /* 用户动态添加的节点（快速添加 / 节点库非 start 类型） */
  interface CustomNode {
    id: string;
    type: string;
    title: string;
    color: string;
    tag?: string;
  }
  const [customNodes, setCustomNodes] = useState<CustomNode[]>([]);

  /* 结束节点配置（参考扣子 End 节点：返回变量 / 返回文本） */
  const [endNode, setEndNode] = useState<EndNodeData | null>(null);

  /** LLM 节点配置：按节点 id 存（多 LLM 节点独立） */
  const defaultLLMConfig = (): LLMConfig => ({
    model: { provider: "doubao", model: "doubao-2.0-pro" },
    batchMode: "single",
    systemPrompt: "",
    userPrompt: "",
    inputs: [{ name: "input", type: "str", required: true }],
    batchInputLists: [{ name: "item1", items: "" }],
    visionInputs: [],
    outputFormat: "markdown",
    outputs: [{ name: "output", type: "str" }],
    skills: [],
  });
  const [llmConfigs, setLlmConfigs] = useState<Record<string, LLMConfig>>({});

  /** 代码节点配置：按节点 id 存（多代码节点独立） */
  const defaultCodeConfig = (): CodeConfig => ({
    language: "javascript",
    code: "",
    inputs: [{ name: "input", type: "str" }],
    outputs: [{ name: "filename", type: "str" }],
    errorHandling: { timeout: 60, retryTimes: 0, onError: "abort" },
  });
  const [codeConfigs, setCodeConfigs] = useState<Record<string, CodeConfig>>({});

  /** 选择器节点配置：按节点 id 存 */
  const defaultSelectorConfig = (): SelectorConfig => ({
    branches: [
      {
        id: "b1",
        logic: "and",
        conditions: [{ id: "c1", op: "==", left: "", right: "", leftType: "str" }],
      },
    ],
  });
  const [selectorConfigs, setSelectorConfigs] = useState<Record<string, SelectorConfig>>({});

  /* ====================== 节点自由拖拽（v2 画布） ====================== */
  /** 节点尺寸常量（与 SCSS .nodeCard 对应） */
  const NODE_W = 240;
  const NODE_H = 132;
  /** 选择器卡片尺寸（与 SCSS .nodeCardSelector / .nodeHeadSelector / .nodeSelectorRow 对应） */
  const SELECTOR_W = 280;
  const SELECTOR_HEAD_H = 42;
  const SELECTOR_ROW_H = 34; // 28px row + 6px gap
  /** 画布虚拟尺寸（SVG 连线层 + 绝对定位节点的坐标系范围） */
  const CANVAS_W = 3600;
  const CANVAS_H = 1800;

  /** 各节点位置（画布坐标系）；未设置的节点按初始网格布局 */
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});

  /* ====================== 连线（显式边） ====================== */
  /** 边：source → target。初始 null = 按节点顺序自动连（首次渲染时固化） */
  interface FlowEdge {
    id: string;
    source: string;
    target: string;
    /** 选择器分支 key（"if_0"/"if_1"/.../"else"，普通边为空）；用于连线从对应端口精确引出 + 同源同分支去重 */ branch?: string;
  }
  const [edges, setEdges] = useState<FlowEdge[] | null>(null);

  /** 编辑器状态作为图快照保存；表单式运行的数据契约独立于视觉布局。 */
  const graphSnapshot = useCallback(() => ({
    startNode, customNodes, endNode, positions, edges, llmConfigs, codeConfigs, selectorConfigs,
    deletedStepIds: [...deletedStepIds], view,
  }), [startNode, customNodes, endNode, positions, edges, llmConfigs, codeConfigs, selectorConfigs, deletedStepIds, view]);

  useEffect(() => {
    if (!workflowId) return;
    let active = true;
    void studioApi<WorkflowDefinition>(`/studio/workflows/${workflowId}`).then((definition) => {
      if (!active) return;
      setWorkflowDefinition(definition);
      const graph = definition.graph;
      if (graph) {
        if (graph.startNode !== undefined) setStartNode(graph.startNode as typeof startNode);
        if (Array.isArray(graph.customNodes)) setCustomNodes(graph.customNodes as CustomNode[]);
        if (graph.endNode !== undefined) setEndNode(graph.endNode as EndNodeData | null);
        if (graph.positions) setPositions(graph.positions as typeof positions);
        if (graph.edges !== undefined) setEdges(graph.edges as FlowEdge[] | null);
        if (graph.llmConfigs) setLlmConfigs(graph.llmConfigs as typeof llmConfigs);
        if (graph.codeConfigs) setCodeConfigs(graph.codeConfigs as typeof codeConfigs);
        if (graph.selectorConfigs) setSelectorConfigs(graph.selectorConfigs as typeof selectorConfigs);
        if (Array.isArray(graph.deletedStepIds)) setDeletedStepIds(new Set(graph.deletedStepIds as string[]));
        if (graph.view) setView(graph.view as typeof view);
      }
      setGraphReady(true);
    }).catch(() => { if (active) setGraphReady(true); });
    return () => { active = false; };
    // 加载一次图快照，后续修改由保存效果处理。
  }, [workflowId]);

  useEffect(() => {
    if (!workflowId || !graphReady || !workflowDefinition || workflowDefinition.ownerId === null) return;
    const timer = window.setTimeout(() => {
      void studioApi(`/studio/workflows/${workflowId}`, { method: "PATCH", body: jsonBody({ graph: graphSnapshot() }) });
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [workflowId, graphReady, workflowDefinition, graphSnapshot]);

  const publishWorkflow = useCallback(async () => {
    const graph = graphSnapshot();
    const fields: WorkflowField[] = (startNode?.vars ?? []).map((item) => ({ id: item.name, label: item.name, type: item.type === "int" || item.type === "float" ? "number" : "text", required: item.required }));
    if (fields.length === 0) fields.push({ id: "brief", label: "任务说明", type: "textarea", required: true });
    const stages: WorkflowStage[] = customNodes.filter((item) => item.type !== "end").map((item) => ({ id: item.id, title: item.title, instruction: item.type === "llm" ? llmConfigs[item.id]?.userPrompt || "根据输入处理内容" : `执行${item.title}节点`, outputKind: "text", visibility: "preview" }));
    if (stages.length === 0) stages.push({ id: "draft", title: "内容初稿", instruction: "根据输入生成初稿", outputKind: "text", visibility: "review" });
    try {
      if (workflowId && workflowDefinition?.ownerId) {
        const next = await studioApi<WorkflowDefinition>(`/studio/workflows/${workflowId}`, { method: "PATCH", body: jsonBody({ graph, fields, stages, status: "published" }) });
        setWorkflowDefinition(next);
      } else {
        const title = window.prompt("工作流名称", template?.name || "未命名工作流")?.trim();
        if (!title) return;
        const created = await studioApi<WorkflowDefinition>("/studio/workflows", { method: "POST", body: jsonBody({ title, description: "由节点编辑器创建的工作流", category: "自定义", fields, stages, graph }) });
        const next = await studioApi<WorkflowDefinition>(`/studio/workflows/${created.id}`, { method: "PATCH", body: jsonBody({ status: "published" }) });
        setWorkflowId(next.id); setWorkflowDefinition(next); setGraphReady(true);
        window.history.replaceState(null, "", `/workflow?workflowId=${next.id}`);
      }
      window.alert("工作流已保存并发布，可在工作流列表中运行。");
    } catch (cause) { window.alert((cause as Error).message); }
  }, [graphSnapshot, startNode, customNodes, llmConfigs, workflowId, workflowDefinition, template]);

  /** 待连接状态：从某节点 output 端口拖出时记录（选择器分支端口带 branch），鼠标到目标 input 端口松手时建边 */
  const [pendingEdge, setPendingEdge] = useState<{
    from: string;
    x: number;
    y: number;
    valid: boolean;
    hoverTarget: string | null;
  } | null>(null);
  const pendingRef = useRef<{ from: string; branch?: string } | null>(null);
  /** 成功建边后，目标节点短暂闪光（用 ref 拿 setTimeout，避免闭包过期） */
  const flashTimerRef = useRef<{ id: string; timer: number } | null>(null);
  const [flashNodeId, setFlashNodeId] = useState<string | null>(null);

  /** 建/删边 —— edges 初始为 null（fallback 按 nodes 顺序生成连线），首次增删前先固化
     空白模式 setEdges([]) 后 edges = [] → 直接返回 []，不触发 fallback */
  const currentEdges = useCallback(
    (nodeList: NodeRow[]): FlowEdge[] => {
      if (edges !== null) return edges;
      return nodeList
        .slice(0, -1)
        .map((n, i) => {
          const next = nodeList[i + 1];
          return next ? { id: `${n.id}->${next.id}`, source: n.id, target: next.id } : null;
        })
        .filter(Boolean as unknown as (v: unknown) => boolean) as FlowEdge[];
    },
    [edges],
  );

  const connectNodes = useCallback(
    (source: string, target: string, nodeList: NodeRow[], branch?: string) => {
      if (source === target) return;
      setEdges(() => {
        const list = currentEdges(nodeList);
        if (list.some((e) => e.source === source && e.target === target && e.branch === branch)) return list; // 去重（同源同分支同目标）
        return [...list, { id: `${source}${branch ? ":" + branch : ""}->${target}`, source, target, branch }];
      });
    },
    [currentEdges],
  );

  const removeEdge = useCallback(
    (edgeId: string, nodeList: NodeRow[]) => {
      setEdges(() => currentEdges(nodeList).filter((e) => e.id !== edgeId));
    },
    [currentEdges],
  );

  /** output 端口 mousedown：开始拉线（坐标用事件实际位置初始化，避免闪向左上角的虚线）；选择器双端口带 branch */
  const onPortOutDown = useCallback((e: ReactMouseEvent<HTMLSpanElement>, nodeId: string, branch?: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    pendingRef.current = { from: nodeId, branch };
    setPendingEdge({ from: nodeId, x: e.clientX, y: e.clientY, valid: false, hoverTarget: null });
  }, []);

  /** 触发目标节点闪光动画（参考主画布 v32 success-draw / node-flash） */
  const flashNode = useCallback((targetId: string) => {
    if (flashTimerRef.current) {
      window.clearTimeout(flashTimerRef.current.timer);
    }
    setFlashNodeId(targetId);
    const timer = window.setTimeout(() => setFlashNodeId(null), 450);
    flashTimerRef.current = { id: targetId, timer };
  }, []);

  /* 快速添加：拉线松手在空白处 → 弹出节点选择，选中后新建节点于松手点并自动连线 */
  const [quickAdd, setQuickAdd] = useState<{
    clientX: number;
    clientY: number;
    canvasX: number;
    canvasY: number;
    from: string;
    branch?: string;
  } | null>(null);
  const quickAddRef = useRef<HTMLDivElement | null>(null);
  useClickOutside(!!quickAdd, [quickAddRef], () => setQuickAdd(null));

  /** 快速添加里选中某类型 → 新建节点于松手点 + 自动连线 */
  const onQuickAddPick = useCallback(
    (type: string) => {
      const qa = quickAdd;
      if (!qa) return;
      const meta = NODE_META[type];
      if (!meta) return;
      const newId = `${type}-${Date.now().toString(36)}`;
      setCustomNodes((cs) => [...cs, { id: newId, type, title: meta.name, color: meta.color }]);
      /* 位置：松手点，往左偏半个卡片宽让视觉居中 */
      setPositions((p) => ({ ...p, [newId]: { x: Math.max(0, qa.canvasX - 80), y: Math.max(0, qa.canvasY - 40) } }));
      /* 自动连线 + 触发目标节点闪光动画 */
      setEdges(() => {
        const list = currentEdges(nodesRef.current);
        return [
          ...list,
          {
            id: `${qa.from}${qa.branch ? ":" + qa.branch : ""}->${newId}`,
            source: qa.from,
            target: newId,
            branch: qa.branch,
          },
        ];
      });
      flashNode(newId);
      setQuickAdd(null);
    },
    [quickAdd, currentEdges, flashNode],
  );

  /** 拉线中：mousemove 更新临时虚线 + 实时计算 valid/hoverTarget，mouseup 命中节点建边 + 目标节点闪光；空白处弹快速添加 */
  useEffect(() => {
    if (!pendingEdge) return;
    /* 计算落点信息（target id + 是否可连） */
    const probe = (clientX: number, clientY: number, from: string): { target: string | null; valid: boolean } => {
      const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
      const port = el?.closest("[data-port-in]") as HTMLElement | null;
      const card = el?.closest("[data-node-card]") as HTMLElement | null;
      const target = port?.dataset.nodeId ?? card?.dataset.nodeId ?? null;
      if (!target || target === from) return { target: null, valid: false };
      const existing = currentEdges(nodesRef.current);
      const dup = existing.some(
        (e2) => e2.source === from && e2.target === target && e2.branch === pendingRef.current?.branch,
      );
      return { target, valid: !dup };
    };
    const onMove = (e: MouseEvent) => {
      const from = pendingRef.current?.from;
      if (!from) return;
      const { target, valid } = probe(e.clientX, e.clientY, from);
      setPendingEdge((p) => (p ? { ...p, x: e.clientX, y: e.clientY, valid, hoverTarget: valid ? target : null } : p));
    };
    const onUp = (e: MouseEvent) => {
      const from = pendingRef.current?.from;
      const branch = pendingRef.current?.branch;
      pendingRef.current = null;
      const final = pendingEdge;
      setPendingEdge(null);
      if (!from || !final) return;
      const { target, valid } = probe(e.clientX, e.clientY, from);
      if (valid && target) {
        connectNodes(from, target, nodesRef.current, branch);
        flashNode(target);
        return;
      }
      /* 落点不可连（自身/重复/非节点）→ 空白处松手：换算画布坐标，弹出快速添加 */
      const wrapRect = flowRef.current?.getBoundingClientRect();
      if (!wrapRect) return;
      const scale = viewRef.current.scale || 1;
      setQuickAdd({
        clientX: e.clientX,
        clientY: e.clientY,
        canvasX: (e.clientX - wrapRect.left - viewRef.current.x) / scale,
        canvasY: (e.clientY - wrapRect.top - viewRef.current.y) / scale,
        from,
        branch,
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [connectNodes, currentEdges, pendingEdge, flashNode]);

  /* 删除节点（键盘 Delete + 双击 ⋯ 共用） */
  const deleteNode = useCallback(
    (id: string) => {
      if (id === "start") {
        setStartNode(null);
      } else if (customNodes.some((c) => c.id === id)) {
        setCustomNodes((cs) => cs.filter((c) => c.id !== id));
      } else {
        setDeletedStepIds((s) => new Set(s).add(id));
      }
      setEdges((es) => (es ?? []).filter((e2) => e2.source !== id && e2.target !== id));
      setPositions((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
    },
    [customNodes],
  );

  /* 选中边：点边选中（高亮），按 Delete/Backspace 才删除 */
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  /** 点边：只选中，不删 */
  const onEdgeClick = useCallback((edgeId: string) => {
    setSelectedEdgeId(edgeId);
  }, []);

  /** view 的 ref 镜像 —— 拖拽 mousemove 里要拿到最新 scale */
  const viewRef = useRef(view);
  viewRef.current = view;

  /** 拖拽会话 */
  const dragRef = useRef<{ id: string; startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const pendingDragRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  /** 是否真的移动过（>3px 才算拖拽，否则当点击处理） */
  const draggedRef = useRef(false);

  /** 初始网格位置：横排，y 固定在画布偏上位置（视口初始即可见） */
  const initialPos = useCallback((id: string, index: number) => {
    return { x: 120 + index * (NODE_W + 64), y: 160 };
  }, []);

  /** 节点 mousedown：开始拖拽（不触发画布平移 —— onFlowMouseDown 已排除 nodeCard）
      base 取 positions[id] ?? initialPos(id, index)：初始节点没进 positions state，
      若 fallback 到 (0,0) 会在点下的瞬间跳到画布左上角 */
  const onNodeDragStart = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>, id: string, index: number) => {
      /* 左键才拖 */
      if (e.button !== 0) return;
      const pos = positions[id] ?? initialPos(id, index);
      dragRef.current = { id, startX: e.clientX, startY: e.clientY, baseX: pos.x, baseY: pos.y };
      draggedRef.current = false;
      setDraggingId(id);
      e.stopPropagation();
    },
    [positions, initialPos],
  );

  /* 全局 mousemove / mouseup：处理节点拖拽（与画布平移同一组监听） */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const s = viewRef.current.scale || 1;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) draggedRef.current = true;
      /* 不 clamp：节点可拖到画布任何方向（含负坐标），连线跟随节点位置 */
      pendingDragRef.current = { id: d.id, x: d.baseX + dx / s, y: d.baseY + dy / s };
      if (dragFrameRef.current === null) dragFrameRef.current = window.requestAnimationFrame(() => {
        const next = pendingDragRef.current;
        if (next) setPositions((p) => ({ ...p, [next.id]: { x: next.x, y: next.y } }));
        dragFrameRef.current = null;
      });
    };
    const onUp = () => {
      if (dragRef.current) {
        if (dragFrameRef.current !== null) window.cancelAnimationFrame(dragFrameRef.current);
        const next = pendingDragRef.current;
        if (next) setPositions((p) => ({ ...p, [next.id]: { x: next.x, y: next.y } }));
        pendingDragRef.current = null; dragFrameRef.current = null;
        dragRef.current = null;
        setDraggingId(null);
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      if (dragFrameRef.current !== null) window.cancelAnimationFrame(dragFrameRef.current);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  /* 键盘：Esc 关抽屉/取消选中；Delete/Backspace 删除选中的边或节点
     （输入框里按键不触发） */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const inEditable =
        !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (e.key === "Escape") {
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        return;
      }
      if (inEditable) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedEdgeId) {
          removeEdge(selectedEdgeId, nodesRef.current);
          setSelectedEdgeId(null);
        } else if (selectedNodeId) {
          deleteNode(selectedNodeId);
          setSelectedNodeId(null);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedEdgeId, selectedNodeId, removeEdge, deleteNode]);

  /* 选中节点：点击"开始"以外的节点用 step:${s.id}
     开始：只添加卡片不自动打开抽屉 —— 抽屉在用户点击卡片时才打开 */
  const onPickNode = useCallback(
    (id: string) => {
      if (id === "start") {
        if (!startNode) {
          setStartNode({
            id: "start",
            vars: [
              { name: "query", type: "str", required: true },
              { name: "user_id", type: "str", required: false },
            ],
          });
        }
      } else {
        /* 其它"已实现"节点（大模型等）作为 customNode 追加到画布末尾 */
        const meta = NODE_META[id];
        if (meta) {
          const newId = `${id}-${Date.now().toString(36)}`;
          setCustomNodes((cs) => [...cs, { id: newId, type: meta.id, title: meta.name, color: meta.color }]);
          /* 位置：最后一个节点右下方（避免重叠） */
          setPositions((p) => {
            const baseX = 120 + Math.max(nodesRef.current.length - 1, 0) * (NODE_W + 64);
            return { ...p, [newId]: { x: baseX, y: 160 } };
          });
        }
      }
      setPickerOpen(false);
      setPickerSearch("");
    },
    [startNode],
  );

  /* 点击画布空白处取消选中 */
  const onFlowBgClick = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.closest(`.${styles.nodeCard}`) ||
      target.closest("[data-port-out]") ||
      target.closest(`.${styles.edgeGroup}`) ||
      target.closest(`.${styles.modePopover}`) ||
      target.closest(`.${styles.zoomPopover}`) ||
      target.closest(`.${styles.pickerPopover}`) ||
      target.closest(`.${styles.inspector}`) ||
      target.closest(`.${styles.toolbarBar}`)
    )
      return;
    if (panRef.current.active) return; /* 拖动中不取消 */
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  /* 节点显示列表：start 节点（可选） + template.steps/customNodes —— 必须在 if 之前用 useMemo */
  const nodes: NodeRow[] = useMemo(() => {
    const list: NodeRow[] = [];
    if (startNode) {
      list.push({
        id: "start",
        title: "开始",
        kind: "start",
        kindLabel: "触发器",
        kindColor: "#534ab7",
        step: 0,
        rows: [
          {
            key: "输入",
            value:
              startNode.vars
                .map(
                  (v) =>
                    `${v.type === "int" ? "int" : v.type === "float" ? "num" : v.type === "bool" ? "bool" : "str"}. ${v.name}`,
                )
                .join(" ") || "—",
            type: "plain",
          },
        ],
      });
    }
    if (template) {
      template.steps.forEach((s, i) => {
        if (deletedStepIds.has(s.id)) return;
        const kind = stepKindOf(s.type);
        const meta = STEP_KIND_META[kind] ?? STEP_KIND_META.llm!;
        list.push({
          id: s.id,
          title: stepNameOf(s.id),
          kind: s.type,
          kindLabel: meta.label,
          kindColor: meta.color,
          step: startNode ? i + 1 : i,
          rows: buildNodeRows(s, i),
          // LLM 节点走分组 chips 渲染（参考扣子节点卡：输入/输出/模型/技能 分段）
          groups: s.type === "llm" ? buildLLMGroups(s) : undefined,
        });
      });
    }
    /* 用户动态添加的节点（快速添加 / 空白工作流的 end 等） */
    customNodes.forEach((c) => {
      const meta = NODE_META[c.type];
      const isLLM = c.type === "llm";
      const isCode = c.type === "code";
      const codeCfg = isCode ? (codeConfigs[c.id] ?? defaultCodeConfig()) : null;
      list.push({
        id: c.id,
        title: c.title,
        kind: c.type,
        kindLabel: meta?.name ?? c.type,
        kindColor: c.color,
        step: list.length,
        rows: [{ key: "类型", value: meta?.name ?? c.type, type: "plain" }],
        // LLM 自定义节点也走分组 chips 渲染（与模板 LLM 一致）
        groups: isLLM
          ? [
              {
                label: "输入",
                chips: [
                  { label: "query", type: "str", variant: "default" },
                  { label: "context", type: "str", variant: "default" },
                ],
                trailing: "more",
              },
              {
                label: "输出",
                chips: [{ label: `${c.id}.output`, type: "str", variant: "default" }],
              },
              {
                label: "模型",
                chips: [{ label: "豆包·2.0·Pro", variant: "model", icon: "✦" }],
              },
              {
                label: "技能",
                chips: [{ label: "未配置技能", variant: "skill", icon: "⚡" }],
                trailing: "add",
              },
            ]
          : // 代码节点走分组 chips（参考扣子代码卡：输入 / 输出）
            isCode && codeCfg
            ? [
                {
                  label: "输入",
                  chips: codeCfg.inputs.map((v) => ({
                    label: v.name,
                    type: v.type,
                    variant: "default" as const,
                  })),
                  trailing: "more" as const,
                },
                {
                  label: "输出",
                  chips: codeCfg.outputs.map((v) => ({
                    label: v.name,
                    type: v.type,
                    variant: "default" as const,
                  })),
                },
              ]
            : undefined,
      });
    });
    return list;
  }, [startNode, template, deletedStepIds, customNodes, codeConfigs]);

  /** nodes 的 ref 镜像（连线 mouseup 闭包 / 点边删除里拿最新列表） */
  const nodesRef = useRef<NodeRow[]>([]);
  nodesRef.current = nodes;

  /** 连线 path 计算：用 positions + selectorConfigs 算出端口画布坐标，完全不用 DOM 查询
     关键：保证 line endpoint 总是从最新的 positions state 计算，与卡片位置严格同步 */
  useLayoutEffect(() => {
    const next: Record<string, { x1: number; y1: number; x2: number; y2: number; d: string }> = {};
    currentEdges(nodes).forEach((e) => {
      const sIdx = nodes.findIndex((n) => n.id === e.source);
      const tIdx = nodes.findIndex((n) => n.id === e.target);
      if (sIdx < 0 || tIdx < 0) return;
      const from = positions[e.source] ?? initialPos(e.source, sIdx);
      const to = positions[e.target] ?? initialPos(e.target, tIdx);

      /* source out port 画布坐标 */
      let x1: number, y1: number;
      if (e.branch) {
        const sc = selectorConfigs[e.source];
        const totalIf = sc ? sc.branches.length : 1;
        const bi = e.branch === "else" ? totalIf : parseInt(e.branch.replace(/^if_/, "") || "0", 10);
        x1 = from.x + SELECTOR_W;
        y1 = from.y + SELECTOR_HEAD_H + 14 + bi * SELECTOR_ROW_H;
      } else {
        x1 = from.x + NODE_W;
        y1 = from.y + NODE_H / 2;
      }

      /* target in port 画布坐标 */
      const x2 = to.x;
      const y2 = to.y + NODE_H / 2;

      next[e.id] = { x1, y1, x2, y2, d: smoothstepPath(x1, y1, x2, y2) };
    });
    setEdgePaths(next);
  }, [currentEdges, initialPos, nodes, positions, selectorConfigs]);

  /* 当前选中的节点（用于右侧抽屉） */
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find((n) => n.id === selectedNodeId) ?? null;
  }, [selectedNodeId, nodes]);

  /* 节点库搜索过滤 */
  const filteredGroups = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return NODE_GROUPS;
    return NODE_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((n) => n.name.toLowerCase().includes(q) || n.desc.toLowerCase().includes(q)),
    })).filter((g) => g.items.length > 0);
  }, [pickerSearch]);

  const filteredTops = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return TOP_GROUPS.filter((g) => !q || g.name.toLowerCase().includes(q));
  }, [pickerSearch]);

  const filteredBases = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return BASE_NODES.filter((n) => !q || n.name.toLowerCase().includes(q) || n.desc.toLowerCase().includes(q));
  }, [pickerSearch]);

  if (!template && !isBlank) {
    /* 有 id 但 template 还没加载完：loading */
    return (
      <div className={styles.fullscreen}>
        <div className={styles.loadingWrap}>
          <p className={styles.loadingText}>工作流加载中…</p>
        </div>
      </div>
    );
  }

  const costLabel = template ? Math.max(1, Math.round(template.cost.min * 100)) : 0;

  return (
    <div className={styles.fullscreen}>
      {/* 顶栏 */}
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <Link href="/workflows" className={styles.backBtn} aria-label="返回">
            ‹
          </Link>
          <div className={styles.titleWrap}>
            <h1 className={styles.title}>{workflowDefinition?.title ?? template?.name ?? "未命名工作流"}</h1>
            <button className={styles.editBtn} aria-label="编辑标题" onClick={() => { if (!workflowDefinition?.ownerId) return; const title = window.prompt("工作流名称", workflowDefinition.title)?.trim(); if (title) void studioApi<WorkflowDefinition>(`/studio/workflows/${workflowDefinition.id}`, { method: "PATCH", body: jsonBody({ title }) }).then(setWorkflowDefinition); }}>
              ✎
            </button>
          </div>
          <div className={styles.tabs}>
            <span className={`${styles.tab} ${styles.tabActive}`}>
              <WorkflowIcon size={11} /> 业务逻辑
            </span>
            <span className={styles.tab}>
              <Sparkles size={11} /> 用户界面
            </span>
          </div>
        </div>
        <div className={styles.topbarRight}>
          {template && (
            <span className={styles.costPill}>
              <Coins size={10} /> 预计消耗 {costLabel}
            </span>
          )}
          <button className={styles.publishBtn} onClick={() => void publishWorkflow()}>保存并发布</button>
        </div>
      </header>

      {/* 中间画布区：视口 + 与顶栏、底栏完全分层独立（缩放不会影响其他） */}
      <main className={styles.canvasArea}>
        <div
          ref={flowRef}
          className={`${styles.flowWrap} ${mode === "trackpad" ? styles.flowWrapTrackpad : styles.flowWrapMouse}`}
          onMouseDown={onFlowMouseDown}
          onClick={onFlowBgClick}
        >
          {nodes.length === 0 ? (
            <div className={styles.flowEmpty}>
              <span>暂无节点</span>
            </div>
          ) : (
            <div
              className={styles.flow}
              style={
                {
                  transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                  transformOrigin: "0 0",
                  width: CANVAS_W,
                  height: CANVAS_H,
                  position: "relative",
                } as CSSProperties
              }
            >
              {/* 连线层：SVG 是 .flow 的子元素，会自动跟随 .flow 的 transform
                 （translate(view.x, view.y) scale(view.scale)），所以这里不再额外设置 transform。
                 节点拖动 / 画布缩放 / 平移时 path 端点永远精确对齐端口。 */}
              <svg
                className={styles.flowEdges}
                viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
                width={CANVAS_W}
                height={CANVAS_H}
                preserveAspectRatio="xMinYMin meet"
              >
                {currentEdges(nodes).map((e) => {
                  const p = edgePaths[e.id];
                  if (!p) return null;
                  const { x2, y2, d } = p;
                  return (
                    <g
                      key={e.id}
                      className={`${styles.edgeGroup} ${selectedEdgeId === e.id ? styles.edgeGroupSelected : ""}`}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onEdgeClick(e.id);
                      }}
                    >
                      {/* 透明加宽命中区 */}
                      <path className={styles.edgeHit} d={d} />
                      <path className={styles.edgePath} d={d} />
                      <polygon
                        className={styles.edgeArrow}
                        points={`${x2},${y2} ${x2 - 7},${y2 - 4} ${x2 - 7},${y2 + 4}`}
                      />
                    </g>
                  );
                })}
                {/* 拉线中的临时虚线：从 source 输出端口到鼠标位置，按 valid 切绿/红色 */}
                {pendingEdge &&
                  (() => {
                    const sIdx = nodes.findIndex((n) => n.id === pendingEdge.from);
                    if (sIdx < 0) return null;
                    const from = positions[pendingEdge.from] ?? initialPos(pendingEdge.from, sIdx);
                    const wrapRect = flowRef.current?.getBoundingClientRect();
                    const mx = wrapRect ? (pendingEdge.x - wrapRect.left - view.x) / view.scale : from.x + NODE_W;
                    const my = wrapRect ? (pendingEdge.y - wrapRect.top - view.y) / view.scale : from.y + NODE_H / 2;
                    const branch = pendingRef.current?.branch;
                    let x1 = from.x + NODE_W;
                    let y1 = from.y + NODE_H / 2;
                    if (branch && flowRef.current) {
                      const portEl = flowRef.current.querySelector(
                        `[data-port-out][data-branch="${CSS.escape(branch)}"][data-node-id="${pendingEdge.from}"]`,
                      ) as HTMLElement | null;
                      if (portEl) {
                        const pr = portEl.getBoundingClientRect();
                        const fr = flowRef.current.getBoundingClientRect();
                        x1 = (pr.left + pr.width / 2 - fr.left) / view.scale;
                        y1 = (pr.top + pr.height / 2 - fr.top) / view.scale;
                      } else {
                        const sc = selectorConfigs[pendingEdge.from];
                        const totalIf = sc ? sc.branches.length : 1;
                        const bi = branch === "else" ? totalIf : parseInt(branch.replace(/^if_/, "") || "0", 10);
                        x1 = from.x + SELECTOR_W;
                        y1 = from.y + SELECTOR_HEAD_H + 14 + bi * SELECTOR_ROW_H;
                      }
                    }
                    return (
                      <path
                        className={`${styles.edgePending} ${pendingEdge.valid ? styles.edgePendingValid : styles.edgePendingInvalid}`}
                        d={smoothstepPath(x1, y1, mx, my)}
                      />
                    );
                  })()}
              </svg>

              {/* 节点层：绝对定位，可自由拖拽 */}
              {nodes.map((n, i) => {
                const isStart = n.kind === "start";
                const isEnd = n.kind === "end";
                const isSelected = selectedNodeId === n.id;
                const isConnecting = pendingEdge?.hoverTarget === n.id;
                const isFlashing = flashNodeId === n.id;
                const pos = positions[n.id] ?? initialPos(n.id, i);
                return (
                  <div
                    key={n.id}
                    data-node-card="1"
                    data-node-id={n.id}
                    className={`${styles.nodeCard} ${isStart ? styles.nodeCardStart : ""} ${isEnd ? styles.nodeCardEnd : ""} ${n.kind === "selector" ? styles.nodeCardSelector : ""} ${isSelected ? styles.nodeCardSelected : ""} ${draggingId === n.id ? styles.nodeCardDragging : ""} ${isConnecting ? styles.nodeCardConnecting : ""} ${isFlashing ? styles.nodeCardFlash : ""}`}
                    style={{ left: pos.x, top: pos.y }}
                    onMouseDown={(e) => onNodeDragStart(e, n.id, i)}
                    onClick={(e) => {
                      e.stopPropagation();
                      const wasDragged = draggedRef.current;
                      draggedRef.current = false; /* 消费即重置：下次 click 前必有 mousedown */
                      if (!wasDragged) setSelectedNodeId(n.id);
                    }}
                  >
                    {/* 左右端口：end 只有 in；start 无 in；selector 恢复 in（参考扣子截图） */}
                    {n.kind !== "end" && n.kind !== "start" && (
                      <span
                        className={`${styles.nodePort} ${styles.nodePortIn} ${isConnecting ? styles.nodePortConnecting : ""}`}
                        data-port-in="1"
                        data-node-id={n.id}
                      />
                    )}
                    {!isEnd && n.kind !== "selector" && (
                      <span
                        className={`${styles.nodePort} ${styles.nodePortOut}`}
                        data-port-out="1"
                        data-node-id={n.id}
                        onMouseDown={(e) => onPortOutDown(e, n.id)}
                      />
                    )}

                    {/* 头：选择器与 LLM 节点一致（白底 + 黑色 IF logo + ▶ ⋯） */}
                    {n.kind === "selector" ? (
                      <div className={`${styles.nodeHead} ${styles.nodeHeadSelector}`}>
                        <span className={`${styles.nodeIcon} ${styles.nodeIconSelector}`}>IF</span>
                        <span className={styles.nodeTitle}>选择器</span>
                        <button className={styles.nodeRun} aria-label="单节点试运行">
                          ▶
                        </button>
                        <button
                          className={styles.nodeMore}
                          aria-label="更多"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedNodeId(n.id);
                          }}
                          onDoubleClick={(e) => {
                            /* 双击 ⋯ = 删除节点（直观操作） */
                            e.stopPropagation();
                            deleteNode(n.id);
                          }}
                        >
                          ⋯
                        </button>
                      </div>
                    ) : (
                      <div className={styles.nodeHead}>
                        <span className={styles.nodeIcon}>
                          {isStart ? "▶" : isEnd ? "→" : (KIND_ACCENT[n.kind]?.icon ?? "✦")}
                        </span>
                        <span className={styles.nodeTitle}>{n.title}</span>
                        {isStart && <span className={styles.nodeTag}>{n.kindLabel}</span>}
                        <button className={styles.nodeRun} aria-label="单节点试运行">
                          ▶
                        </button>
                        <button
                          className={styles.nodeMore}
                          aria-label="更多"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedNodeId(n.id);
                          }}
                          onDoubleClick={(e) => {
                            /* 双击 ⋯ = 删除节点（直观操作） */
                            e.stopPropagation();
                            deleteNode(n.id);
                          }}
                        >
                          ⋯
                        </button>
                      </div>
                    )}

                    {/* 元数据多行：选择器走专属分支结构（每个分支独立行 + 所有条件 + 且/或 逻辑可视化） */}
                    {n.kind === "selector" ? (
                      <div className={styles.nodeSelectorBody}>
                        {(() => {
                          const sc = selectorConfigs[n.id] ?? defaultSelectorConfig();
                          const branches = sc.branches;
                          const compactOp = (op?: string) =>
                            op === "=="
                              ? "="
                              : op === "!="
                                ? "≠"
                                : op === ">"
                                  ? ">"
                                  : op === ">="
                                    ? "≥"
                                    : op === "<"
                                      ? "<"
                                      : op === "<="
                                        ? "≤"
                                        : op === "contains"
                                          ? "包含"
                                          : op === "not-contains"
                                            ? "不包含"
                                            : op === "is-empty"
                                              ? "为空"
                                              : op === "is-not-empty"
                                                ? "不为空"
                                                : "=";
                          const condText = (c: { left: string; op: string; right: string }) =>
                            c.left || c.right ? `${c.left || "…"} ${compactOp(c.op)} ${c.right || "…"}` : "";
                          const condBoxText = (c: { left: string; op: string; right: string }) =>
                            c.left || c.right ? condText(c) : "";
                          return (
                            <>
                              {/* 动态分支（如果 / 否则如果）：展示所有条件 + 且/或 逻辑 */}
                              {branches.map((branch, bi) => {
                                const label = bi === 0 ? "如果" : "否则如果";
                                const branchKey = `if_${bi}`;
                                const logicLabel = branch.logic === "or" ? "或" : "且";
                                const conds = branch.conditions;
                                return (
                                  <div key={branch.id} className={styles.nodeSelectorGroup}>
                                    <span className={styles.nodeSelectorLabel}>{label}</span>
                                    <div className={styles.nodeSelectorCondStack}>
                                      {conds.map((c, ci) => {
                                        const text = condBoxText(c);
                                        const isFirst = ci === 0;
                                        return (
                                          <div key={c.id} className={styles.nodeSelectorCondRow}>
                                            {!isFirst && <span className={styles.nodeSelectorLogic}>{logicLabel}</span>}
                                            <div className={styles.nodeSelectorCond}>
                                              <span
                                                className={
                                                  text ? styles.nodeSelectorCondText : styles.nodeSelectorCondTextDim
                                                }
                                              >
                                                {text || "设置条件…"}
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <span
                                      className={`${styles.nodePort} ${styles.nodePortOut}`}
                                      data-port-out="1"
                                      data-branch={branchKey}
                                      data-node-id={n.id}
                                      title={`${label}（${branchKey}）`}
                                      onMouseDown={(e) => onPortOutDown(e, n.id, branchKey)}
                                    />
                                  </div>
                                );
                              })}
                              {/* 否则固定行：branch = "else" */}
                              <div className={styles.nodeSelectorGroup}>
                                <span className={styles.nodeSelectorLabel}>否则</span>
                                <div className={styles.nodeSelectorCondStack}>
                                  <div className={styles.nodeSelectorCondRow}>
                                    <div className={styles.nodeSelectorCond}>
                                      <span className={styles.nodeSelectorCondTextDim}>不满足以上条件时</span>
                                    </div>
                                  </div>
                                </div>
                                <span
                                  className={`${styles.nodePort} ${styles.nodePortOut}`}
                                  data-port-out="1"
                                  data-branch="else"
                                  data-node-id={n.id}
                                  title="否则（不满足条件）"
                                  onMouseDown={(e) => onPortOutDown(e, n.id, "else")}
                                />
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className={styles.nodeBody}>
                        {n.groups && n.groups.length > 0
                          ? n.groups.map((g, gi) => (
                              <div key={gi} className={styles.nodeGroup}>
                                <div className={styles.nodeGroupLabel}>{g.label}</div>
                                <div className={styles.nodeGroupChips}>
                                  {g.chips.map((c, ci) => (
                                    <span
                                      key={ci}
                                      className={`${styles.nodeGroupChip} ${c.variant === "model" ? styles.nodeGroupChipModel : ""} ${c.variant === "skill" ? styles.nodeGroupChipSkill : ""}`}
                                    >
                                      {c.variant === "model" && (
                                        <span className={styles.nodeGroupIcon}>{c.icon ?? "✦"}</span>
                                      )}
                                      {c.variant === "skill" && (
                                        <span className={styles.nodeGroupIcon}>{c.icon ?? "⚡"}</span>
                                      )}
                                      {c.type && c.variant === "default" && (
                                        <span className={styles.nodeGroupType}>{c.type}</span>
                                      )}
                                      <span className={styles.nodeGroupLabelText}>{c.label}</span>
                                      {c.warning && (
                                        <span className={styles.nodeGroupWarning} aria-label="警告">
                                          !
                                        </span>
                                      )}
                                    </span>
                                  ))}
                                  {g.trailing === "more" && (
                                    <button className={styles.nodeGroupTrailing} aria-label="更多">
                                      ⋯
                                    </button>
                                  )}
                                  {g.trailing === "add" && (
                                    <button className={styles.nodeGroupAdd} aria-label="添加">
                                      +
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))
                          : n.rows.map((r, k) => (
                              <div key={k} className={styles.nodeRow}>
                                <span className={styles.nodeKey}>{r.key}</span>
                                <span className={styles.nodeVal}>
                                  {r.type === "chipAccent" && (
                                    <span className={`${styles.nodeChip} ${styles.nodeChipAccent}`}>{r.value}</span>
                                  )}
                                  {r.type === "chipMuted" && <span className={styles.nodeChip}>{r.value}</span>}
                                  {r.type === "plain" && r.value}
                                </span>
                              </div>
                            ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* 快速添加菜单：拉线松手在空白处弹出（fixed 定位于松手点） */}
      {quickAdd && (
        <div
          ref={quickAddRef}
          className={styles.quickAddMenu}
          style={{ left: quickAdd.clientX, top: quickAdd.clientY }}
        >
          <div className={styles.quickAddTitle}>添加节点并连接</div>
          <div className={styles.quickAddGrid}>
            {[
              NODE_META.start,
              TOP_GROUP_NODES.llm,
              ...BASE_NODES.filter((b) => b.id !== "start"),
              ...NODE_GROUPS.flatMap((g) => g.items.slice(0, 3)),
            ]
              .filter((m): m is NodeTypeMeta => !!m)
              .slice(0, 10)
              .map((meta) => (
                <button key={meta.id} className={styles.quickAddItem} onClick={() => onQuickAddPick(meta.id)}>
                  <span className={styles.quickAddIcon} style={{ background: meta.color }}>
                    <meta.icon size={14} />
                  </span>
                  <span className={styles.quickAddName}>{meta.name}</span>
                </button>
              ))}
          </div>
          <button className={styles.quickAddCancel} onClick={() => setQuickAdd(null)}>
            取消
          </button>
        </div>
      )}

      {/* 右侧节点配置抽屉（选中节点时滑出） */}
      {selectedNode && (
        <aside
          className={`${styles.inspector} ${selectedNode.kind === "start" ? styles.inspectorStart : ""}`}
          onClick={(e) => e.stopPropagation()}
        >
          <header className={styles.inspectorHead}>
            <span
              className={styles.inspectorIcon}
              style={{ background: selectedNode.kind === "start" ? "#534ab7" : selectedNode.kindColor }}
            >
              {selectedNode.kind === "start"
                ? "▶"
                : selectedNode.kind === "end"
                  ? "↪"
                  : (KIND_ACCENT[selectedNode.kind]?.icon ?? "✦")}
            </span>
            <div className={styles.inspectorTitleWrap}>
              <span className={styles.inspectorTitle}>{selectedNode.title}</span>
              {selectedNode.kind === "start" && <span className={styles.inspectorTag}>触发器</span>}
              {selectedNode.kind === "end" && endNode && (
                <span className={styles.inspectorTag}>{endNode.mode === "variables" ? "返回变量" : "返回文本"}</span>
              )}
              {selectedNode.kind === "llm" && <span className={styles.inspectorTag}>大模型</span>}
              {selectedNode.kind === "code" && <span className={styles.inspectorTag}>代码</span>}
              {selectedNode.kind === "selector" && <span className={styles.inspectorTag}>选择器</span>}
            </div>
            <div className={styles.inspectorHeadRight}>
              <button className={styles.inspectorIconBtn} aria-label="关闭" onClick={() => setSelectedNodeId(null)}>
                <X size={14} />
              </button>
            </div>
          </header>

          {selectedNode.kind === "start" && startNode ? (
            <div className={styles.inspectorDescEditable}>
              <textarea
                className={styles.inspectorDescTextarea}
                placeholder="工作流的起始节点，用于设定启动工作流需要的信息"
                maxLength={100}
                value={startNode.description ?? ""}
                onChange={(e) => setStartNode({ ...startNode, description: e.target.value })}
                rows={2}
              />
              <span className={styles.inspectorDescCount}>{(startNode.description ?? "").length}/100</span>
            </div>
          ) : selectedNode.kind === "end" && endNode ? (
            <div className={styles.inspectorDescEditable}>
              <textarea
                className={styles.inspectorDescTextarea}
                placeholder="工作流的最终节点，用于返回工作流运行后的结果信息"
                maxLength={100}
                value={endNode.description ?? NODE_META[selectedNode.kind]?.desc ?? ""}
                onChange={(e) => setEndNode({ ...endNode, description: e.target.value })}
                rows={2}
              />
              <span className={styles.inspectorDescCount}>
                {(endNode.description ?? NODE_META[selectedNode.kind]?.desc ?? "").length}/100
              </span>
            </div>
          ) : selectedNode.kind === "llm" ? (
            (() => {
              const llmCfg = llmConfigs[selectedNode.id] ?? defaultLLMConfig();
              const desc = llmCfg.description ?? "调用大语言模型，使用变量和提示词生成回复";
              return (
                <div className={styles.inspectorDescEditable}>
                  <textarea
                    className={styles.inspectorDescTextarea}
                    placeholder="调用大语言模型，使用变量和提示词生成回复"
                    maxLength={100}
                    value={desc}
                    onChange={(e) =>
                      setLlmConfigs((m) => ({
                        ...m,
                        [selectedNode.id]: { ...llmCfg, description: e.target.value },
                      }))
                    }
                    rows={2}
                  />
                  <span className={styles.inspectorDescCount}>{desc.length}/100</span>
                </div>
              );
            })()
          ) : selectedNode.kind === "code" ? (
            (() => {
              const codeCfg = codeConfigs[selectedNode.id] ?? defaultCodeConfig();
              const desc = codeCfg.description ?? "运行一段自定义 JS/Python 脚本处理数据";
              return (
                <div className={styles.inspectorDescEditable}>
                  <textarea
                    className={styles.inspectorDescTextarea}
                    placeholder="运行一段自定义 JS/Python 脚本处理数据"
                    maxLength={100}
                    value={desc}
                    onChange={(e) =>
                      setCodeConfigs((m) => ({
                        ...m,
                        [selectedNode.id]: { ...codeCfg, description: e.target.value },
                      }))
                    }
                    rows={2}
                  />
                  <span className={styles.inspectorDescCount}>{desc.length}/100</span>
                </div>
              );
            })()
          ) : selectedNode.kind === "selector" ? (
            (() => {
              const selCfg = selectorConfigs[selectedNode.id] ?? defaultSelectorConfig();
              const desc = selCfg.description ?? "按条件分支流转（如果 / 否则）";
              return (
                <div className={styles.inspectorDescEditable}>
                  <textarea
                    className={styles.inspectorDescTextarea}
                    placeholder="按条件分支流转（如果 / 否则）"
                    maxLength={100}
                    value={desc}
                    onChange={(e) =>
                      setSelectorConfigs((m) => ({
                        ...m,
                        [selectedNode.id]: { ...selCfg, description: e.target.value },
                      }))
                    }
                    rows={2}
                  />
                  <span className={styles.inspectorDescCount}>{desc.length}/100</span>
                </div>
              );
            })()
          ) : (
            <p className={styles.inspectorDesc}>
              {NODE_META[selectedNode.kind]?.desc ?? `${selectedNode.kindLabel} 节点`}
            </p>
          )}

          {/* 开始节点：基础设置 / 触发器设置 两个 tab */}
          {selectedNode.kind === "start" && startNode ? (
            <StartInspector
              vars={startNode.vars}
              onChange={(vars) => setStartNode({ ...startNode, vars })}
              jsonOpen={jsonOpen}
              setJsonOpen={setJsonOpen}
              showTip={showTip}
              hideTip={hideTip}
            />
          ) : selectedNode.kind === "end" && endNode ? (
            <EndInspector data={endNode} onChange={setEndNode} />
          ) : selectedNode.kind === "llm" ? (
            <LLMInspector
              config={llmConfigs[selectedNode.id] ?? defaultLLMConfig()}
              onChange={(c) => setLlmConfigs((m) => ({ ...m, [selectedNode.id]: c }))}
            />
          ) : selectedNode.kind === "code" ? (
            <CodeInspector
              config={codeConfigs[selectedNode.id] ?? defaultCodeConfig()}
              onChange={(c) => setCodeConfigs((m) => ({ ...m, [selectedNode.id]: c }))}
            />
          ) : selectedNode.kind === "selector" ? (
            <SelectorInspector
              config={selectorConfigs[selectedNode.id] ?? defaultSelectorConfig()}
              onChange={(c) => setSelectorConfigs((m) => ({ ...m, [selectedNode.id]: c }))}
            />
          ) : (
            <StepInspector node={selectedNode} />
          )}
        </aside>
      )}

      {/* 底部工具条 —— 与顶栏并列、flex-shrink:0；画布缩放完全不影响其位置 */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarBar}>
          {/* 交互模式切换（鼠标 / 触控板） */}
          <button
            ref={modeBtnRef}
            className={`${styles.toolbarIconBtn} ${styles.touchpadBtn} ${modeOpen ? styles.touchpadBtnActive : ""}`}
            aria-label="交互模式"
            onClick={() => setModeOpen((v) => !v)}
          >
            {mode === "trackpad" ? <Laptop size={14} /> : <Mouse size={14} />}
            <ChevronDown size={9} />

            {/* 弹层：两种交互模式选择 */}
            {modeOpen && (
              <div ref={modeRef} className={styles.modePopover}>
                <h3 className={styles.modeTitle}>交互模式</h3>
                <div className={styles.modeOptions}>
                  <button
                    className={`${styles.modeOption} ${mode === "mouse" ? styles.modeOptionActive : ""}`}
                    onClick={() => {
                      setMode("mouse");
                      setModeOpen(false);
                    }}
                  >
                    <Mouse size={32} strokeWidth={1.4} />
                    <span className={styles.modeOptionName}>鼠标友好模式</span>
                    <span className={styles.modeOptionDesc}>鼠标左键拖动画布，滚轮缩放</span>
                  </button>
                  <button
                    className={`${styles.modeOption} ${mode === "trackpad" ? styles.modeOptionActive : ""}`}
                    onClick={() => {
                      setMode("trackpad");
                      setModeOpen(false);
                    }}
                  >
                    <Laptop size={32} strokeWidth={1.4} />
                    <span className={styles.modeOptionName}>触控板友好模式</span>
                    <span className={styles.modeOptionDesc}>双指同向移动拖动，双指张开捏合缩放</span>
                  </button>
                </div>
              </div>
            )}
          </button>

          {/* 缩放比例 —— 实时跟随 view.scale，点击弹层选择档位 */}
          <div className={styles.zoomWrap} ref={zoomRef}>
            <button
              ref={zoomBtnRef}
              className={`${styles.toolbarSelect} ${styles.zoomBtn}`}
              onClick={() => setZoomOpen((v) => !v)}
              aria-label="缩放比例"
            >
              {zoomPercent}%
              <ChevronDown size={10} />
            </button>
            {zoomOpen && (
              <div className={styles.zoomPopover}>
                {ZOOM_STEPS.map((p) => (
                  <button
                    key={p}
                    className={`${styles.zoomOption} ${p === zoomPercent ? styles.zoomOptionActive : ""}`}
                    onClick={() => {
                      setScale(p);
                      setZoomOpen(false);
                    }}
                  >
                    {p}%{p === 100 && <span className={styles.zoomHint}>重置</span>}
                  </button>
                ))}
                <div className={styles.zoomDivider} />
                <button
                  className={styles.zoomOption}
                  onClick={() => {
                    setView({ scale: 1, x: 0, y: 0 });
                    setZoomOpen(false);
                  }}
                >
                  适应画布
                </button>
              </div>
            )}
          </div>

          {/* 注释 · 优化布局 · 导出为图片 · 缩略图 */}
          <button className={styles.toolbarIconBtn} aria-label="注释">
            <MessageSquareText size={14} />
          </button>
          <button className={styles.toolbarIconBtn} aria-label="优化布局">
            <Wrench size={14} />
          </button>
          <button className={styles.toolbarIconBtn} aria-label="导出为图片">
            <ImageIcon size={14} />
          </button>
          <button className={styles.toolbarIconBtn} aria-label="缩略图">
            <Maximize2 size={14} />
          </button>

          <span className={styles.toolbarDivider} />

          {/* 添加节点（弹出节点库） */}
          <div className={styles.pickerWrap}>
            <button ref={pickerBtnRef} className={styles.addNodeBtn} onClick={() => setPickerOpen((v) => !v)}>
              <Plus size={12} /> 添加节点
            </button>
            {pickerOpen && (
              <div ref={pickerRef} className={styles.pickerPopover}>
                <div className={styles.pickerSearch}>
                  <SearchIcon size={14} className={styles.pickerSearchIcon} />
                  <input
                    className={styles.pickerSearchInput}
                    placeholder="搜索节点、插件、工作流"
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className={styles.pickerScroll}>
                  {filteredBases.length > 0 && (
                    <div className={styles.pickerGroup}>
                      {filteredBases.map((n) => (
                        <PickerItem key={n.id} meta={n} onClick={() => onPickNode(n.id)} />
                      ))}
                    </div>
                  )}

                  {filteredTops.length > 0 && (
                    <div className={styles.pickerTopRow}>
                      {filteredTops.map((g) => {
                        const meta = TOP_GROUP_NODES[g.id as keyof typeof TOP_GROUP_NODES];
                        return <PickerItem key={g.id} meta={meta} onClick={() => onPickNode(g.id)} />;
                      })}
                    </div>
                  )}

                  {filteredGroups.map((g) => (
                    <div key={g.category} className={styles.pickerSection}>
                      <h4 className={styles.pickerSectionTitle}>{g.category}</h4>
                      <div className={styles.pickerGrid}>
                        {g.items.map((n) => (
                          <PickerItem key={n.id} meta={n} onClick={() => onPickNode(n.id)} />
                        ))}
                      </div>
                    </div>
                  ))}

                  {filteredBases.length === 0 && filteredTops.length === 0 && filteredGroups.length === 0 && (
                    <div className={styles.pickerEmpty}>没有匹配的节点</div>
                  )}
                </div>
              </div>
            )}
          </div>
          <button className={styles.debugBtn} aria-label="调试">
            <Wrench size={13} />
          </button>
          <button className={styles.runBtn} onClick={() => { if (workflowId) window.location.assign(`/workflows?workflowId=${workflowId}`); else void publishWorkflow(); }}>
            <Play size={12} /> 试运行
          </button>
        </div>
      </div>

      {/* Portal tooltip —— 渲染到 body 根部，z-index 最高，彻底避免被任何 stacking context 遮住 */}
      {tip &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              left: tip.x,
              top: tip.y,
              transform: tip.place === "top" ? "translate(-50%, -100%)" : "translate(-50%, 0)",
              zIndex: 9999,
              padding: "4px 10px",
              background: "var(--surface)",
              color: "var(--foreground)",
              fontSize: 11.5,
              fontWeight: 500,
              border: "1px solid var(--surface-border)",
              borderRadius: 6,
              whiteSpace: "nowrap",
              pointerEvents: "none",
              boxShadow: "0 4px 14px rgba(0, 0, 0, 0.22)",
            }}
          >
            {tip.text}
          </div>,
          document.body,
        )}
    </div>
  );
}

/* ============================== 子组件 ============================== */

/**
 * 渲染节点库中的图标、名称和描述。
 *
 * @param props - 节点元数据和点击回调。
 * @returns 节点库条目。
 */
function PickerItem({ meta, onClick }: { meta: NodeTypeMeta; onClick: () => void }) {
  const Icon = meta.icon;
  return (
    <button
      className={`${styles.pickerItem} ${!meta.implemented ? styles.pickerItemDisabled : ""}`}
      onClick={onClick}
      title={meta.implemented ? meta.desc : "（仅展示）"}
    >
      <span className={styles.pickerItemIcon} style={{ background: meta.color }}>
        <Icon size={18} strokeWidth={1.8} />
      </span>
      <span className={styles.pickerItemText}>
        <span className={styles.pickerItemName}>{meta.name}</span>
        <span className={styles.pickerItemDesc}>{meta.desc}</span>
      </span>
    </button>
  );
}

/** 开始节点配置面板（基础设置 / 触发器设置） */
interface StartVar {
  name: string;
  type: "int" | "str" | "bool" | "float";
  required: boolean;
  default?: string;
  description?: string;
}

function StartInspector({
  vars,
  onChange,
  jsonOpen,
  setJsonOpen,
  showTip,
  hideTip,
}: {
  vars: StartVar[];
  onChange: (v: StartVar[]) => void;
  jsonOpen: boolean;
  setJsonOpen: (v: boolean) => void;
  showTip: (el: HTMLElement, text: string, place?: "top" | "bottom") => void;
  hideTip: () => void;
}) {
  const [tab, setTab] = useState<"basic" | "trigger">("basic");
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  /** 哪些变量行展开"默认值 + 描述"（按 var.id / index） */
  const [expandedVars, setExpandedVars] = useState<Set<number>>(new Set());
  /** 触发器开关 + details 展开状态：开关关闭 = 整组收起；开启 = 展开 */
  const [triggerEnabled, setTriggerEnabled] = useState(true);
  const [triggerOpen, setTriggerOpen] = useState(true);
  /** 开关切换：关闭则收起，开启则展开 */
  const toggleTrigger = useCallback((next: boolean) => {
    setTriggerEnabled(next);
    setTriggerOpen(next);
  }, []);

  /** 时区选择（Cascader）：hover 偏移行展开对应时区列表 */
  const [tz, setTz] = useState("Asia/Shanghai");
  const [tzOpen, setTzOpen] = useState(false);
  const [tzOffsetHover, setTzOffsetHover] = useState<number | null>(480);
  const tzRef = useRef<HTMLDivElement | null>(null);
  const tzBtnRef = useRef<HTMLButtonElement | null>(null);
  useClickOutside(tzOpen, [tzRef, tzBtnRef], () => setTzOpen(false));
  const toggleExpandVar = (i: number) => {
    setExpandedVars((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  /** 打开时预填当前 vars（作为示例/编辑起点） */
  const openJson = useCallback(() => {
    setJsonText(
      JSON.stringify(
        {
          inputs: vars.map((v) => ({
            name: v.name,
            type: v.type,
            required: v.required,
            ...(v.default ? { default: v.default } : {}),
            ...(v.description ? { description: v.description } : {}),
          })),
        },
        null,
        2,
      ),
    );
    setJsonError(null);
    setJsonOpen(true);
  }, [vars, setJsonOpen]);
  const closeJson = useCallback(() => {
    setJsonOpen(false);
    setJsonError(null);
  }, [setJsonOpen]);
  const importJson = useCallback(() => {
    try {
      const data = JSON.parse(jsonText);
      const list = Array.isArray(data) ? data : Array.isArray(data?.inputs) ? data.inputs : null;
      if (!list) {
        setJsonError("格式应为对象 { inputs: [...] } 或数组");
        return;
      }
      const next = list.map(
        (it: { name?: unknown; type?: unknown; required?: unknown; default?: unknown; description?: unknown }) => {
          const t = String(it.type ?? "str");
          const type: "int" | "str" | "bool" | "float" = t === "int" || t === "bool" || t === "float" ? t : "str";
          return {
            name: typeof it.name === "string" && it.name.trim() ? it.name : "var",
            type,
            required: !!it.required,
            default: it.default != null ? String(it.default) : undefined,
            description: typeof it.description === "string" ? it.description : undefined,
          };
        },
      );
      onChange(next);
      closeJson();
    } catch (e) {
      setJsonError((e as Error).message || "JSON 解析失败");
    }
  }, [jsonText, onChange, closeJson]);
  return (
    <>
      <div className={styles.inspectorTabs}>
        <button
          className={`${styles.inspectorTab} ${tab === "basic" ? styles.inspectorTabActive : ""}`}
          onClick={() => setTab("basic")}
        >
          基础设置
        </button>
        <button
          className={`${styles.inspectorTab} ${tab === "trigger" ? styles.inspectorTabActive : ""}`}
          onClick={() => setTab("trigger")}
        >
          触发器设置
        </button>
      </div>

      <div className={styles.inspectorBody}>
        {tab === "basic" ? (
          <>
            <details open className={styles.inspectorGroup}>
              <summary className={styles.inspectorGroupHead}>
                <span>输入</span>
                <div className={styles.inspectorGroupRight}>
                  <button
                    className={styles.inspectorGroupBtn}
                    aria-label="JSON 导入"
                    onClick={openJson}
                    onMouseEnter={(e) => showTip(e.currentTarget, "JSON 导入", "top")}
                    onMouseLeave={hideTip}
                    onFocus={(e) => showTip(e.currentTarget, "JSON 导入", "top")}
                    onBlur={hideTip}
                  >
                    <LogIn size={12} />
                  </button>
                  <button
                    className={styles.inspectorGroupBtn}
                    aria-label="添加变量"
                    onClick={() => onChange([...vars, { name: `var${vars.length + 1}`, type: "str", required: true }])}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </summary>
              <div className={styles.inspectorVarList}>
                <div className={styles.inspectorVarHead}>
                  <span>变量名</span>
                  <span>变量类型</span>
                  <span>必填</span>
                  <span></span>
                </div>
                {vars.map((v, i) => (
                  <Fragment key={i}>
                    <div className={styles.inspectorVarRow}>
                      <input
                        className={styles.inspectorVarInput}
                        value={v.name}
                        onChange={(e) => {
                          const next = [...vars];
                          next[i] = { ...v, name: e.target.value };
                          onChange(next);
                        }}
                      />
                      <select
                        className={styles.inspectorVarSelect}
                        value={v.type}
                        onChange={(e) => {
                          const next = [...vars];
                          next[i] = { ...v, type: e.target.value as typeof v.type };
                          onChange(next);
                        }}
                      >
                        <option value="int">int. Integer</option>
                        <option value="str">str. String</option>
                        <option value="float">num. Number</option>
                        <option value="bool">bool. Boolean</option>
                      </select>
                      <button
                        className={`${styles.inspectorCheck} ${v.required ? styles.inspectorCheckOn : ""}`}
                        onClick={() => {
                          const next = [...vars];
                          next[i] = { ...v, required: !v.required };
                          onChange(next);
                        }}
                        aria-label="必填"
                      >
                        {v.required ? "✓" : ""}
                      </button>
                      <div className={styles.inspectorVarActions}>
                        <button
                          className={`${styles.inspectorIconBtnSm} ${expandedVars.has(i) ? styles.inspectorIconBtnSmActive : ""}`}
                          aria-label={expandedVars.has(i) ? "收起" : "展开参数"}
                          onClick={() => toggleExpandVar(i)}
                          onMouseEnter={(e) =>
                            showTip(e.currentTarget, expandedVars.has(i) ? "收起" : "展开参数", "top")
                          }
                          onMouseLeave={hideTip}
                        >
                          {expandedVars.has(i) ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
                        </button>
                        <button
                          className={styles.inspectorIconBtnSm}
                          aria-label="删除"
                          onClick={() => onChange(vars.filter((_, k) => k !== i))}
                        >
                          <X size={11} />
                        </button>
                      </div>
                    </div>
                    {/* 展开：默认值 + 描述 */}
                    {expandedVars.has(i) && (
                      <div className={styles.inspectorVarExpand}>
                        <div className={styles.inspectorVarField}>
                          <label className={styles.inspectorVarFieldLabel}>默认值</label>
                          <input
                            className={styles.inspectorVarFieldInput}
                            placeholder="参数默认值，在没有传入该参数时，将使用默认值"
                            value={v.default ?? ""}
                            onChange={(e) => {
                              const next = [...vars];
                              next[i] = { ...v, default: e.target.value };
                              onChange(next);
                            }}
                          />
                        </div>
                        <div className={styles.inspectorVarField}>
                          <label className={styles.inspectorVarFieldLabel}>描述</label>
                          <input
                            className={styles.inspectorVarFieldInput}
                            placeholder="帮助大模型准确了解参数的作用"
                            value={v.description ?? ""}
                            onChange={(e) => {
                              const next = [...vars];
                              next[i] = { ...v, description: e.target.value };
                              onChange(next);
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </Fragment>
                ))}
              </div>
            </details>
          </>
        ) : (
          <>
            <div className={styles.inspectorHint}>完成设置后需进行发布操作，定时任务才能生效。</div>
            <details open={triggerOpen} className={styles.inspectorGroup}>
              <summary
                className={styles.inspectorGroupHead}
                onClick={(e) => {
                  /* 受控 details：已展开时阻止 summary 的默认 toggle（只能通过开关收起） */
                  if (triggerOpen) e.preventDefault();
                }}
              >
                <span>触发器设置</span>
                <div className={styles.inspectorGroupRight}>
                  <button
                    className={styles.inspectorGroupBtn}
                    aria-label="单步试运行"
                    onClick={(e) => {
                      e.stopPropagation();
                      // TODO(workflow-run): 接入当前触发器节点的单步试运行接口。
                    }}
                  >
                    <Play size={11} />
                  </button>
                  <button
                    className={`${styles.inspectorSwitch} ${triggerEnabled ? styles.inspectorSwitchOn : ""}`}
                    aria-label="启用"
                    aria-pressed={triggerEnabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTrigger(!triggerEnabled);
                    }}
                  >
                    <span />
                  </button>
                </div>
              </summary>
              <div className={styles.inspectorField}>
                <label className={styles.inspectorLabel}>
                  时区<span className={styles.inspectorReq}>*</span>
                </label>
                <div className={styles.tzWrap}>
                  <button ref={tzBtnRef} className={styles.tzBtn} onClick={() => setTzOpen((v) => !v)} type="button">
                    <span className={styles.tzBtnText}>{tzLabel(tz)}</span>
                    <ChevronDown size={11} />
                  </button>
                  {tzOpen && (
                    <div ref={tzRef} className={styles.tzPopover}>
                      {/* 第一列：UTC 偏移（hover 切换第二列） */}
                      <div className={styles.tzCol1}>
                        {TIMEZONES.map((g) => {
                          const active = findOffset(tz) === g.offset;
                          const open = tzOffsetHover === g.offset;
                          return (
                            <div
                              key={g.label}
                              className={`${styles.tzItem} ${active ? styles.tzItemActive : ""} ${open ? styles.tzItemOpen : ""}`}
                              onMouseEnter={() => setTzOffsetHover(g.offset)}
                              onClick={() => {
                                /* 点偏移行 = 选该偏移下第一个时区（UX 便利） */
                                const first = g.zones[0];
                                if (first) setTz(first.iana);
                                setTzOpen(false);
                              }}
                            >
                              <span className={styles.tzOffset}>{g.label}</span>
                              <span className={styles.tzChevron}>›</span>
                            </div>
                          );
                        })}
                      </div>
                      {/* 第二列：该偏移下所有时区（浮动在第一列右侧） */}
                      {tzOffsetHover != null && (
                        <div className={styles.tzCol2}>
                          {(TIMEZONES.find((g) => g.offset === tzOffsetHover)?.zones ?? []).map((z) => (
                            <div
                              key={z.iana}
                              className={`${styles.tzZone} ${z.iana === tz ? styles.tzZoneActive : ""}`}
                              onClick={() => {
                                setTz(z.iana);
                                setTzOpen(false);
                              }}
                            >
                              {z.iana === tz && <span className={styles.tzCheck}>✓</span>}
                              <span>
                                {z.cn} - {z.iana}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.inspectorField}>
                <label className={styles.inspectorLabel}>
                  触发时间<span className={styles.inspectorReq}>*</span>
                </label>
                <div className={styles.inspectorTimeRow}>
                  <select className={styles.inspectorFieldSelect} defaultValue="preset">
                    <option value="preset">选择预设时间</option>
                    <option value="cron">自定义 cron</option>
                  </select>
                  <select className={styles.inspectorFieldSelect} defaultValue="18:00">
                    <option>每天 09:00</option>
                    <option>每天 18:00</option>
                    <option>每周一 09:00</option>
                  </select>
                </div>
              </div>
              <details open className={styles.inspectorSubGroup}>
                <summary className={styles.inspectorGroupHead}>
                  <span>参数</span>
                </summary>
                <div className={styles.inspectorParamList}>
                  {vars.map((v) => (
                    <div key={v.name} className={styles.inspectorParamRow}>
                      <div className={styles.inspectorParamKey}>
                        {v.name}
                        <span className={styles.inspectorReq}>*</span>
                        <span className={styles.inspectorParamType}>
                          {v.type === "int"
                            ? "Integer"
                            : v.type === "float"
                              ? "Number"
                              : v.type === "bool"
                                ? "Boolean"
                                : "String"}
                        </span>
                      </div>
                      <input
                        className={styles.inspectorParamInput}
                        placeholder={v.type === "int" ? "int. 请输入参数值" : "str. 请输入参数值"}
                      />
                    </div>
                  ))}
                </div>
              </details>
            </details>
          </>
        )}
      </div>

      {/* JSON 导入弹窗：解析后覆盖当前变量列表（受外层 jsonOpen 控制） */}
      {jsonOpen && (
        <div className={styles.jsonModal} onClick={closeJson}>
          <div className={styles.jsonModalCard} onClick={(e) => e.stopPropagation()}>
            <header className={styles.jsonModalHead}>
              <span className={styles.jsonModalTitle}>JSON 导入参数</span>
              <button className={styles.inspectorIconBtn} aria-label="关闭" onClick={closeJson}>
                <X size={14} />
              </button>
            </header>
            <div className={styles.jsonModalBody}>
              <p className={styles.jsonModalHint}>
                粘贴 JSON 数组或 <code>{`{ inputs: [...] }`}</code>，格式：
                <br />
                <code>{`[{"name":"query","type":"str","required":true}, ...]`}</code>
              </p>
              <textarea
                className={styles.jsonModalTextarea}
                value={jsonText}
                onChange={(e) => {
                  setJsonText(e.target.value);
                  setJsonError(null);
                }}
                spellCheck={false}
                autoFocus
              />
              {jsonError && <p className={styles.jsonModalError}>{jsonError}</p>}
            </div>
            <footer className={styles.jsonModalFoot}>
              <button className={styles.jsonModalBtn} onClick={() => setJsonText("")}>
                清空
              </button>
              <button className={styles.jsonImportBtn} onClick={importJson}>
                导入
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * 渲染普通步骤的只读元数据面板。
 *
 * @param props - 当前工作流节点。
 * @returns 普通步骤检查器。
 * @todo 为普通步骤提供可编辑配置。
 */
function StepInspector({ node }: { node: NodeRow }) {
  return (
    <div className={styles.inspectorBody}>
      <div className={styles.inspectorSection}>
        <h4 className={styles.inspectorSectionTitle}>节点信息</h4>
        <div className={styles.inspectorMeta}>
          {node.rows.map((r, i) => (
            <div key={i} className={styles.inspectorMetaRow}>
              <span className={styles.inspectorMetaKey}>{r.key}</span>
              <span className={styles.inspectorMetaVal}>
                {r.type === "chipAccent" && (
                  <span className={`${styles.nodeChip} ${styles.nodeChipAccent}`}>{r.value}</span>
                )}
                {r.type === "chipMuted" && <span className={styles.nodeChip}>{r.value}</span>}
                {r.type === "plain" && r.value}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.inspectorHint}>{node.kindLabel} 节点的详细配置即将上线。</div>
    </div>
  );
}

/**
 * 将两种 ModelRef 形态转换为展示文本。
 *
 * @param model - 可选模型引用。
 * @returns 模型展示名称。
 */
function modelLabel(model: ModelRef | undefined): string {
  if (!model) return "默认模型";
  if ("provider" in model) return `${model.provider} · ${model.model}`;
  return model.alias;
}

/**
 * cubic Bezier 平滑曲线：从 source 水平出 → 平滑 S 弧 → 水平入 target。
 * 控制点偏移 = max(40, 曼哈顿距离/3)，保证小距离也丝滑、远距离弧度自然。
 *
 * @param x1 - 起点横坐标。
 * @param y1 - 起点纵坐标。
 * @param x2 - 终点横坐标。
 * @param y2 - 终点纵坐标。
 * @returns SVG path 字符串。
 */
function smoothstepPath(x1: number, y1: number, x2: number, y2: number): string {
  if (Math.abs(y2 - y1) < 1) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const dx = Math.max(40, (Math.abs(x2 - x1) + Math.abs(y2 - y1)) / 3);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

/* ============================== 时区数据（完整版） ============================== */
/* 30+ UTC 偏移、80+ IANA 时区，按偏移升序排列（负 → 正） */
interface TzEntry {
  iana: string;
  cn: string;
}
const TIMEZONES: Array<{ offset: number; label: string; zones: TzEntry[] }> = [
  {
    offset: -660,
    label: "UTC-11:00",
    zones: [
      { iana: "Pacific/Niue", cn: "纽埃时间" },
      { iana: "Pacific/Midway", cn: "萨摩亚标准时间" },
      { iana: "Pacific/Pago_Pago", cn: "萨摩亚标准时间" },
    ],
  },
  {
    offset: -600,
    label: "UTC-10:00",
    zones: [
      { iana: "America/Adak", cn: "阿达克时间" },
      { iana: "Pacific/Honolulu", cn: "夏威夷标准时间" },
    ],
  },
  { offset: -570, label: "UTC-09:30", zones: [{ iana: "Pacific/Marquesas", cn: "马克萨斯时间" }] },
  {
    offset: -540,
    label: "UTC-09:00",
    zones: [
      { iana: "America/Anchorage", cn: "阿拉斯加标准时间" },
      { iana: "Pacific/Gambier", cn: "甘比尔时间" },
    ],
  },
  {
    offset: -480,
    label: "UTC-08:00",
    zones: [
      { iana: "America/Los_Angeles", cn: "美国太平洋时间" },
      { iana: "America/Tijuana", cn: "下加利福尼亚时间" },
      { iana: "America/Vancouver", cn: "太平洋时间" },
    ],
  },
  {
    offset: -420,
    label: "UTC-07:00",
    zones: [
      { iana: "America/Denver", cn: "山地标准时间" },
      { iana: "America/Phoenix", cn: "山地标准时间" },
      { iana: "America/Edmonton", cn: "山地时间" },
    ],
  },
  {
    offset: -360,
    label: "UTC-06:00",
    zones: [
      { iana: "America/Chicago", cn: "美国中部时间" },
      { iana: "America/Mexico_City", cn: "墨西哥时间" },
    ],
  },
  {
    offset: -300,
    label: "UTC-05:00",
    zones: [
      { iana: "America/New_York", cn: "美国东部时间" },
      { iana: "America/Toronto", cn: "东部时间" },
    ],
  },
  {
    offset: -240,
    label: "UTC-04:00",
    zones: [
      { iana: "America/Halifax", cn: "大西洋时间" },
      { iana: "America/Santiago", cn: "智利时间" },
    ],
  },
  {
    offset: -180,
    label: "UTC-03:00",
    zones: [
      { iana: "America/Sao_Paulo", cn: "巴西利亚时间" },
      { iana: "America/Argentina/Buenos_Aires", cn: "阿根廷时间" },
    ],
  },
  { offset: -150, label: "UTC-02:30", zones: [{ iana: "America/St_Johns", cn: "纽芬兰时间" }] },
  { offset: -120, label: "UTC-02:00", zones: [{ iana: "Atlantic/South_Georgia", cn: "南乔治亚时间" }] },
  {
    offset: -60,
    label: "UTC-01:00",
    zones: [
      { iana: "Atlantic/Azores", cn: "亚速尔时间" },
      { iana: "Atlantic/Cape_Verde", cn: "佛得角时间" },
    ],
  },
  {
    offset: 0,
    label: "UTC+00:00",
    zones: [
      { iana: "Europe/London", cn: "格林威治标准时间" },
      { iana: "Atlantic/Reykjavik", cn: "冰岛时间" },
      { iana: "Africa/Casablanca", cn: "卡萨布兰卡时间" },
    ],
  },
  {
    offset: 60,
    label: "UTC+01:00",
    zones: [
      { iana: "Europe/Paris", cn: "中欧标准时间" },
      { iana: "Europe/Berlin", cn: "中欧时间" },
      { iana: "Africa/Lagos", cn: "西非时间" },
    ],
  },
  {
    offset: 120,
    label: "UTC+02:00",
    zones: [
      { iana: "Europe/Athens", cn: "东欧时间" },
      { iana: "Africa/Cairo", cn: "东欧时间" },
      { iana: "Europe/Helsinki", cn: "东欧时间" },
      { iana: "Asia/Jerusalem", cn: "以色列标准时间" },
    ],
  },
  {
    offset: 180,
    label: "UTC+03:00",
    zones: [
      { iana: "Europe/Moscow", cn: "莫斯科标准时间" },
      { iana: "Asia/Riyadh", cn: "阿拉伯标准时间" },
      { iana: "Africa/Nairobi", cn: "东非时间" },
      { iana: "Europe/Istanbul", cn: "土耳其时间" },
    ],
  },
  { offset: 210, label: "UTC+03:30", zones: [{ iana: "Asia/Tehran", cn: "伊朗标准时间" }] },
  {
    offset: 240,
    label: "UTC+04:00",
    zones: [
      { iana: "Asia/Dubai", cn: "海湾标准时间" },
      { iana: "Asia/Baku", cn: "阿塞拜疆时间" },
    ],
  },
  { offset: 270, label: "UTC+04:30", zones: [{ iana: "Asia/Kabul", cn: "阿富汗时间" }] },
  {
    offset: 300,
    label: "UTC+05:00",
    zones: [
      { iana: "Asia/Karachi", cn: "巴基斯坦标准时间" },
      { iana: "Asia/Tashkent", cn: "乌兹别克斯坦时间" },
    ],
  },
  {
    offset: 330,
    label: "UTC+05:30",
    zones: [
      { iana: "Asia/Kolkata", cn: "印度标准时间" },
      { iana: "Asia/Colombo", cn: "斯里兰卡时间" },
    ],
  },
  { offset: 345, label: "UTC+05:45", zones: [{ iana: "Asia/Kathmandu", cn: "尼泊尔时间" }] },
  {
    offset: 360,
    label: "UTC+06:00",
    zones: [
      { iana: "Asia/Dhaka", cn: "孟加拉标准时间" },
      { iana: "Asia/Almaty", cn: "哈萨克斯坦时间" },
    ],
  },
  { offset: 390, label: "UTC+06:30", zones: [{ iana: "Asia/Yangon", cn: "缅甸时间" }] },
  {
    offset: 420,
    label: "UTC+07:00",
    zones: [
      { iana: "Asia/Bangkok", cn: "印度支那时间" },
      { iana: "Asia/Jakarta", cn: "西部印尼时间" },
      { iana: "Asia/Ho_Chi_Minh", cn: "印度支那时间" },
    ],
  },
  {
    offset: 480,
    label: "UTC+08:00",
    zones: [
      { iana: "Asia/Shanghai", cn: "中国标准时间" },
      { iana: "Asia/Hong_Kong", cn: "香港标准时间" },
      { iana: "Asia/Taipei", cn: "台北标准时间" },
      { iana: "Asia/Singapore", cn: "新加坡标准时间" },
      { iana: "Australia/Perth", cn: "澳大利亚西部时间" },
    ],
  },
  { offset: 525, label: "UTC+08:45", zones: [{ iana: "Australia/Eucla", cn: "中西部标准时间" }] },
  {
    offset: 540,
    label: "UTC+09:00",
    zones: [
      { iana: "Asia/Tokyo", cn: "日本标准时间" },
      { iana: "Asia/Seoul", cn: "韩国标准时间" },
    ],
  },
  { offset: 570, label: "UTC+09:30", zones: [{ iana: "Australia/Adelaide", cn: "中澳大利亚标准时间" }] },
  {
    offset: 600,
    label: "UTC+10:00",
    zones: [
      { iana: "Australia/Sydney", cn: "澳大利亚东部时间" },
      { iana: "Pacific/Guam", cn: "关岛标准时间" },
    ],
  },
  { offset: 630, label: "UTC+10:30", zones: [{ iana: "Australia/Lord_Howe", cn: "豪勋爵岛标准时间" }] },
  {
    offset: 660,
    label: "UTC+11:00",
    zones: [
      { iana: "Pacific/Port_Moresby", cn: "巴布亚新几内亚时间" },
      { iana: "Pacific/Noumea", cn: "新喀里多尼亚时间" },
    ],
  },
  {
    offset: 720,
    label: "UTC+12:00",
    zones: [
      { iana: "Pacific/Auckland", cn: "新西兰标准时间" },
      { iana: "Pacific/Fiji", cn: "斐济时间" },
    ],
  },
  { offset: 765, label: "UTC+12:45", zones: [{ iana: "Pacific/Chatham", cn: "查塔姆标准时间" }] },
  { offset: 780, label: "UTC+13:00", zones: [{ iana: "Pacific/Tongatapu", cn: "汤加时间" }] },
  { offset: 840, label: "UTC+14:00", zones: [{ iana: "Pacific/Kiritimati", cn: "莱恩群岛时间" }] },
];

/**
 * 查询 IANA 时区所在的 UTC 偏移。
 *
 * @param iana - IANA 时区标识。
 * @returns 分钟单位的 UTC 偏移，未知时区回退为 480。
 */
function findOffset(iana: string): number {
  for (const g of TIMEZONES) {
    if (g.zones.some((z) => z.iana === iana)) return g.offset;
  }
  return 480;
}

/**
 * 获取当前时区的按钮展示名称。
 *
 * @param iana - IANA 时区标识。
 * @returns 中文名称和 IANA 标识，未知时区返回原值。
 */
function tzLabel(iana: string): string {
  for (const g of TIMEZONES) {
    for (const z of g.zones) {
      if (z.iana === iana) return `${z.cn} - ${z.iana}`;
    }
  }
  return iana;
}

/**
 * 按步骤类型构造节点卡片的元数据行。
 *
 * @param s - 工作流步骤定义。
 * @param index - 步骤在工作流中的位置。
 * @returns 节点卡片展示行。
 */
function buildNodeRows(s: TemplateDetail["steps"][number], index: number): NodeRow["rows"] {
  const isFirst = index === 0;
  const inputName = isFirst ? "sys.query" : `step${index - 1}.output`;
  const outputName = `${s.id}.output`;

  switch (s.type) {
    case "llm": {
      return [
        { key: "输入", value: inputName, type: "chipAccent" },
        { key: "输出", value: `str. ${outputName}`, type: "plain" },
        { key: "模型", value: modelLabel(s.model), type: "chipMuted" },
        { key: "技能", value: "未配置技能", type: "plain" },
      ];
    }

    case "image-gen":
      return [
        { key: "输入", value: inputName, type: "chipAccent" },
        { key: "输出", value: `image. ${outputName}`, type: "plain" },
        { key: "模型", value: modelLabel(s.model), type: "chipMuted" },
        { key: "参数", value: "ratio 1:1 · n=1", type: "plain" },
      ];
    case "video-gen":
      return [
        { key: "输入", value: inputName, type: "chipAccent" },
        { key: "输出", value: `video. ${outputName}`, type: "plain" },
        { key: "模型", value: modelLabel(s.model), type: "chipMuted" },
        { key: "参数", value: "ratio 16:9 · n=1", type: "plain" },
      ];
    case "tts":
      return [
        { key: "输入", value: inputName, type: "chipAccent" },
        { key: "输出", value: `audio. ${outputName}`, type: "plain" },
        { key: "voice", value: s.voice ?? "默认", type: "chipMuted" },
      ];
    case "ffmpeg":
      return [
        { key: "输入", value: inputName, type: "chipAccent" },
        { key: "输出", value: `media. ${outputName}`, type: "plain" },
        { key: "op", value: s.op, type: "chipMuted" },
      ];
    case "http":
      return [
        { key: "输入", value: inputName, type: "chipAccent" },
        { key: "输出", value: `resp. ${outputName}`, type: "plain" },
        { key: "method", value: `${s.method ?? "GET"} ${truncate(s.url, 14)}`, type: "chipMuted" },
      ];
    case "mcp":
      return [
        { key: "输入", value: inputName, type: "chipAccent" },
        { key: "输出", value: `tool. ${outputName}`, type: "plain" },
        { key: "工具", value: `${s.server} · ${s.tool}`, type: "chipMuted" },
      ];
  }
}

/**
 * LLM 节点 → 节点卡片分组 chips（参考扣子节点卡）：
 *   输入：变量 chip 列表（带类型前缀 str/int/float/bool）
 *   输出：单一变量 chip
 *   模型：单行 chip（avatar + 完整名称）
 *   技能：单行 chip（icon + 名称）
 *
 * TODO(workflow-llm): Template Step 补齐 LLMConfig 后，从 config.skills 和
 * config.systemPrompt 生成分组，移除当前演示输入。
 *
 * @param s - 大模型步骤定义。
 * @returns 大模型节点卡片的分组数据。
 * @todo 从 LLMConfig 读取真实输入、技能和系统提示词。
 */
function buildLLMGroups(s: TemplateDetail["steps"][number]): NodeGroup[] {
  const outputName = `${s.id}.output`;
  /* Step 是 union，窄化到 llm 变体才能访问 model 字段 */
  const modelName = s.type === "llm" ? modelLabel(s.model) : "默认模型";

  return [
    {
      label: "输入",
      chips: [
        { label: "client_id", type: "str", variant: "default" },
        { label: "age", type: "int", variant: "default" },
        { label: "exp_level", type: "int", variant: "default" },
        { label: "risk_tolerance", type: "str", variant: "default" },
      ],
      trailing: "more",
    },
    {
      label: "输出",
      chips: [{ label: outputName, type: "str", variant: "default" }],
    },
    {
      label: "模型",
      chips: [{ label: modelName, variant: "model", icon: "豆", warning: true }],
    },
    {
      label: "技能",
      chips: [{ label: "未配置技能", variant: "skill", icon: "⚡" }],
      trailing: "add",
    },
  ];
}

function truncate(text: string, n: number): string {
  return text.length > n ? `${text.slice(0, n)}…` : text;
}
