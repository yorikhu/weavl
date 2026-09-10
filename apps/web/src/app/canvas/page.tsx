"use client";

import React from "react";

import { useCallback, useEffect, useRef, useState } from "react";
import { useClickOutside } from "@/hooks/useClickOutside";
import { toast } from "@/hooks/useToast";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  ReactFlowProvider,
  useReactFlow,
  ConnectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { RunView } from "@weavl/shared";
import {
  RefreshCw,
  X,
  ChevronRight,
  Coins,
  Plus,
  Send,
  Link2,
  Layers,
  Bot,
  Image as ImageIcon,
  Video as VideoIcon,
  Music,
  Sparkles,
  Type as TypeIcon,
  Film,
  FileText,
} from "lucide-react";
import styles from "./page.module.scss";
import { API } from "@/lib/env";
import { EnterEditContext } from "@/features/canvas/editContext";
import type { EditCtx } from "@/features/canvas/editContext";
import {
  ImageEditPanel,
  VideoEditPanel,
  nodeTypes,
} from "@/features/canvas/components/CanvasNodes";
import { FloatingToolbar } from "@/features/canvas/components/FloatingToolbar";
import { KIND_META } from "@/features/canvas/types/kindMeta";
import type {
  AnyNodeData,
  CardField,
  ImageNodeData,
  NodeKind,
  TextNodeData,
  VideoNodeData,
} from "@/features/canvas/types/nodes";
import { NODE_LIBRARY, NODE_TOOLBAR, STAGE_TITLES, nextNodeId } from "@/features/canvas/constants";

/**
 * 协调 React Flow 状态、节点编辑、连线以及页面级浮层。
 *
 * @returns 完整的画布工作区。
 */
function CanvasInner() {
  const { screenToFlowPosition, setCenter } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  /** 挂载时清洗 时代 type:"bezier" 隐形边 → "default"（React Flow 无此内置类型不渲染） */
  useEffect(() => {
    setEdges((es) =>
      es.some((e) => e.type === "bezier")
        ? es.map((e) => (e.type === "bezier" ? ({ ...e, type: "default" } as Edge) : e))
        : es,
    );
  }, [setEdges]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  /** 积分悬停弹窗（hover 200ms 开、离开 150ms 缓冲关） */
  const [creditHover, setCreditHover] = useState(false);
  const creditOpenTimer = useRef<number | null>(null);
  const creditCloseTimer = useRef<number | null>(null);
  const openCredit = useCallback(() => {
    if (creditCloseTimer.current) {
      window.clearTimeout(creditCloseTimer.current);
      creditCloseTimer.current = null;
    }
    if (creditHover) return;
    creditOpenTimer.current = window.setTimeout(() => setCreditHover(true), 200);
  }, [creditHover]);
  const closeCredit = useCallback(() => {
    if (creditOpenTimer.current) {
      window.clearTimeout(creditOpenTimer.current);
      creditOpenTimer.current = null;
    }
    if (!creditHover) return;
    creditCloseTimer.current = window.setTimeout(() => setCreditHover(false), 150);
  }, [creditHover]);
  useEffect(
    () => () => {
      if (creditOpenTimer.current) window.clearTimeout(creditOpenTimer.current);
      if (creditCloseTimer.current) window.clearTimeout(creditCloseTimer.current);
    },
    [],
  );
  /** Agent 抽屉（右上角头像展开）+ 气泡消息流 */
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentMessages, setAgentMessages] = useState<{ role: "user" | "agent"; text: string; thumb?: string | null }[]>(
    [{ role: "agent", text: "你好，我是织光 Agent。告诉我想要的内容，我来帮你编排画布。" }],
  );
  /** 首页「开始创作」带参进入 —— ?agent=1 自动唤起抽屉，sessionStorage 取 prompt 预填 */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("agent") !== "1") return;
    const saved = sessionStorage.getItem("weavl:agent-prompt");
    if (saved) {
      sessionStorage.removeItem("weavl:agent-prompt");
      setAgentMessages((ms) => [
        ...ms,
        { role: "user", text: saved },
        { role: "agent", text: "已收到你的想法。编排能力即将上线，我会先在画布上为你规划节点。" },
      ]);
    }
    setAgentOpen(true);
  }, []);
  const [chatInput, setChatInput] = useState("");
  const [chatThumb, setChatThumb] = useState<string | null>(null);
  const [chatModel] = useState("Weavl LLM");
  const [hasRun, setHasRun] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState<{ title: string; text: string }>({ title: "", text: "" });
  /** contentEditable DOM 引用（让 commitEdit 能读到最新 innerText）+ IME composition 标志 */
  const editorElRef = useRef<HTMLDivElement | null>(null);
  const composingRef = useRef(false);
  /** 从 source handle 拖出连线时记录起始节点，松手时若在空白处 → 创建新节点 + 连线 */
  const connectStartRef = useRef<{ nodeId: string | null; clientX: number; clientY: number }>({
    nodeId: null,
    clientX: 0,
    clientY: 0,
  });
  /** click-outside-to-close —— 给 + 添加菜单 / Agent 抽屉 / 节点库提供 ref，
     在 useClickOutside 里统一判断「pointerdown 在白名单外则关闭」。 */
  const addMenuRef = useRef<HTMLDivElement | null>(null);
  const addFabBtnRef = useRef<HTMLButtonElement | null>(null);
  const agentDrawerRef = useRef<HTMLDivElement | null>(null);
  const agentBtnRef = useRef<HTMLButtonElement | null>(null);
  const libraryRef = useRef<HTMLDivElement | null>(null);

  /** 进入编辑：初始化 buffer + 平移居中 + 稍微放大（退出时不再复位视口，所以无需保存） */
  const enterEdit = useCallback(
    (id: string) => {
      const n = nodes.find((x) => x.id === id);
      if (!n) return;
      const d = n.data as Record<string, unknown>;
      const title = typeof d.title === "string" ? d.title : d.kind === "card" ? "" : "文本";
      const text =
        typeof d.text === "string"
          ? d.text
          : typeof d.url === "string"
            ? d.url
            : d.kind === "card" && Array.isArray(d.fields)
              ? (d.fields as Array<{ label: string; value: string }>).map((f) => `${f.label}：${f.value}`).join("\n")
              : "";
      setEditBuffer({ title, text });
      // 节点居中 + 放大到 2.0（进入编辑时，参考 LibTV 200%）
      // 用节点实际渲染尺寸计算中心，避免视觉偏移
      const w = n.measured?.width ?? (typeof d.width === "number" ? d.width : 440);
      const h = n.measured?.height ?? (typeof d.height === "number" ? d.height : 120);
      void setCenter(n.position.x + w / 2, n.position.y + h / 2, { zoom: 2, duration: 320 });
      setEditingId(id);
    },
    [nodes, setCenter],
  );

  /** 退出编辑：视口保持不动（位置和缩放都不变），只关编辑态 */
  const exitEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  /** 写回节点 data（节点内编辑器走这条） */
  const writeNodeData = useCallback(
    (id: string, title: string, text: string, size?: { w: number; h: number }) => {
      setNodes((ns) =>
        ns.map((n) => {
          if (n.id !== id) return n;
          const d = { ...(n.data as Record<string, unknown>) };
          if (title.trim()) d.title = title.trim();
          const kind = d.nodeKind;
          if (kind === "text") {
            d.text = text;
            if (size && size.w > 0) d.width = Math.round(size.w);
            if (size && size.h > 0) d.height = Math.round(size.h);
          } else if (kind === "card") {
            const fields: CardField[] = [];
            for (const line of text.split("\n")) {
              const m = line.match(/^(.*?)[:：]\s*(.*)$/);
              if (m && m[1]) fields.push({ label: m[1], value: m[2] ?? "" });
              else if (line.trim()) fields.push({ label: "·", value: line });
            }
            d.fields = fields;
          } else {
            const urlMatch = text.match(/https?:\/\/\S+/);
            if (urlMatch) d.url = urlMatch[0];
          }
          return { ...n, data: d as unknown as AnyNodeData } as unknown as Node;
        }),
      );
    },
    [setNodes],
  );

  /** 入口：传入 id/title/text 直接写回 */
  const saveEdit = useCallback(
    (id: string, title: string, text: string) => {
      writeNodeData(id, title, text);
      exitEdit();
    },
    [writeNodeData, exitEdit],
  );

  /** 图片编辑器实时状态 ref（编辑器组件每次状态变化时写入） */
  const imageEditStateRef = useRef<EditCtx["imageEditStateRef"]["current"]>(null);

  /** 图片节点编辑提交 —— prompt/参数/模型/图片写回节点 data */
  const commitImageEdit = useCallback(
    (
      id: string,
      payload: {
        prompt?: string;
        ratio?: string;
        quality?: string;
        count?: number;
        model?: string;
        url?: string;
        title?: string;
      },
    ) => {
      setNodes((ns) =>
        ns.map((n) => {
          if (n.id !== id) return n;
          const d = { ...(n.data as Record<string, unknown>) };
          if (payload.title !== undefined && payload.title.trim()) d.title = payload.title.trim();
          if (payload.prompt !== undefined) d.prompt = payload.prompt;
          if (payload.ratio) d.ratio = payload.ratio;
          if (payload.quality) d.quality = payload.quality;
          if (typeof payload.count === "number") d.count = payload.count;
          if (payload.model) d.model = payload.model;
          if (payload.url !== undefined) d.url = payload.url;
          /** 有 prompt 没有图 → 占位色改成生成中样式（后续接真生图 API 时替换） */
          return { ...n, data: d as unknown as AnyNodeData } as unknown as Node;
        }),
      );
      exitEdit();
    },
    [setNodes, exitEdit],
  );

  /** 视频编辑器实时状态 ref（编辑器组件每次状态变化时写入） */
  const videoEditStateRef = useRef<EditCtx["videoEditStateRef"]["current"]>(null);

  /** 视频节点编辑提交 —— prompt/参数/视频写回节点 data */
  const commitVideoEdit = useCallback(
    (
      id: string,
      payload: {
        prompt?: string;
        ratio?: string;
        quality?: string;
        duration?: number;
        count?: number;
        model?: string;
        url?: string;
        title?: string;
      },
    ) => {
      setNodes((ns) =>
        ns.map((n) => {
          if (n.id !== id) return n;
          const d = { ...(n.data as Record<string, unknown>) };
          if (payload.title !== undefined && payload.title.trim()) d.title = payload.title.trim();
          if (payload.prompt !== undefined) d.prompt = payload.prompt;
          if (payload.ratio) d.ratio = payload.ratio;
          if (payload.quality) d.quality = payload.quality;
          if (typeof payload.duration === "number") d.duration = payload.duration;
          if (typeof payload.count === "number") d.count = payload.count;
          if (payload.model) d.model = payload.model;
          if (payload.url !== undefined) d.url = payload.url;
          return { ...n, data: d as unknown as AnyNodeData } as unknown as Node;
        }),
      );
      exitEdit();
    },
    [setNodes, exitEdit],
  );

  /** 入口：commitEdit 直接从 contentEditable DOM 读最新 innerText（避免 React state 异步导致保存过时）
     图片节点编辑态时改走 commitImageEdit（用 imageEditStateRef 里的实时状态）
     视频节点编辑态时改走 commitVideoEdit */
  const commitEdit = useCallback(() => {
    if (!editingId) return;
    const editingNode = nodes.find((n) => n.id === editingId);
    const editingKind = (editingNode?.data as Record<string, unknown> | undefined)?.nodeKind;
    if (editingKind === "image") {
      const payload = imageEditStateRef.current;
      commitImageEdit(editingId, payload ?? {});
      return;
    }
    if (editingKind === "video") {
      const payload = videoEditStateRef.current;
      commitVideoEdit(editingId, payload ?? {});
      return;
    }
    const editor = editorElRef.current;
    const liveText = editor?.innerText ?? "";
    const finalText = composingRef.current ? editBuffer.text : liveText;
    /** 节点容器尺寸（用户在编辑态拖出来的宽/高）一并保存 */
    const container = editor?.parentElement;
    const size =
      container && container.offsetWidth > 0 && container.offsetHeight > 0
        ? { w: container.offsetWidth, h: container.offsetHeight }
        : undefined;
    writeNodeData(editingId, editBuffer.title, finalText, size);
    exitEdit();
  }, [editingId, editBuffer, writeNodeData, exitEdit, nodes, commitImageEdit, commitVideoEdit]);

  /** 工具栏格式化命令：作用于当前 contentEditable 焦点 */
  const onApplyFormat = useCallback((cmd: string, value?: string) => {
    try {
      document.execCommand(cmd, false, value);
    } catch {
      /** 浏览器不支持时静默失败 */
    }
  }, []);

  /** 选中节点时同步 selectedNode（用于顶部 NodeToolbar 浮出） */
  const onSelectionChange = useCallback(({ nodes: sel }: { nodes: Node[] }) => {
    setSelectedNode(sel[0] ?? null);
  }, []);

  /** 从最近任务自动铺：图像步骤用 image 节点，文字步骤用 card 节点 */
  const loadFromLatest = useCallback(async () => {
    try {
      const res = await fetch(`${API}/runs/latest/_pick`);
      if (!res.ok) return;
      const data: RunView = await res.json();
      const gateSteps = new Set((data.decisions ?? []).map((d) => d.gate));
      const stepIds = ["topics", "copywriting", "cover-concept", "cover", "check", "package"];
      const layout: Node[] = stepIds.map((sid, i) => {
        const isGate = gateSteps.has(sid);
        const isCover = sid === "cover" || sid === "cover-concept";
        const isPackage = sid === "package";
        if (isCover) {
          return {
            id: `s_${sid}`,
            type: "image",
            position: { x: 80, y: 80 + i * 200 },
            data: {
              nodeKind: "image",
              kind: "image",
              title: STAGE_TITLES[sid],
              category: isGate ? "确认门 · 封面" : "封面",
              tint: "rgba(212, 83, 126, 0.18)",
              size: { w: 200, h: 260 },
            },
          };
        }
        if (isPackage && data.contentPackage) {
          return {
            id: `s_${sid}`,
            type: "card",
            position: { x: 80, y: 80 + i * 200 },
            data: {
              nodeKind: "card",
              kind: "output",
              title: "内容包",
              category: "产物",
              fields: [
                { label: "标题", value: data.contentPackage.fields[0]?.value?.slice(0, 28) ?? "—" },
                { label: "正文", value: data.contentPackage.fields[1]?.value?.slice(0, 28) ?? "—" },
                { label: "封面", value: data.contentPackage.fields[2]?.value?.slice(0, 28) ?? "—" },
                { label: "话题", value: data.contentPackage.fields[3]?.value?.slice(0, 28) ?? "—" },
              ],
            },
          };
        }
        // 文字节点
        return {
          id: `s_${sid}`,
          type: "card",
          position: { x: 80, y: 80 + i * 200 },
          data: {
            nodeKind: "card",
            kind: "llm",
            title: STAGE_TITLES[sid],
            category: isGate ? `确认门 · ${STAGE_TITLES[sid]}` : STAGE_TITLES[sid],
            isGate,
            fields: [
              { label: "类型", value: "测评/故事/清单" },
              { label: "候选", value: "3 个" },
              ...(isGate ? [{ label: "状态", value: "等待确认" }] : [{ label: "状态", value: "已确认" }]),
            ],
          },
        };
      });
      const layoutEdges: Edge[] = stepIds.slice(0, -1).map((sid, i) => ({
        id: `e_${sid}`,
        source: `s_${sid}`,
        target: `s_${stepIds[i + 1]}`,
        type: "smoothstep",
        style: { stroke: "#5e5e66", strokeWidth: 1.2 },
        label: i % 2 === 0 ? "点击按钮，可替换上传" : undefined,
        labelStyle: { fill: "#a8a8b2", fontSize: 10 },
        labelBgStyle: { fill: "rgba(20, 20, 22, 0.92)", stroke: "#232326" },
        labelBgPadding: [6, 4] as [number, number],
        labelBgBorderRadius: 8,
      }));
      setNodes(layout);
      setEdges(layoutEdges);
      setHasRun(true);
    } catch {
      /** API 未启时保持空态 */
    }
  }, [setNodes, setEdges]);

  useEffect(() => {
    fetch(`${API}/runs/latest/_pick`)
      .then((r) => setHasRun(r.ok))
      .catch(() => {});
  }, []);

  /** 编辑模式下，全局 ESC 退出（即使焦点不在节点内） */
  useEffect(() => {
    if (!editingId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        exitEdit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingId, exitEdit]);

  /** 编辑模式下，点击编辑节点外部（画布空白处 / 页面其它区域）自动保存退出 */
  useEffect(() => {
    if (!editingId) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      /** 点在文本编辑节点内部（含标题输入框、正文、resize 句柄）→ 不处理 */
      if (target.closest(`.${styles.textNodeEditing}`)) return;
      /** 点在图片编辑节点内部（卡片 + 底部编辑栏）→ 不处理 */
      if (target.closest(`.${styles.imageNodeEditWrap}`)) return;
      /** 图片/视频编辑栏（Portal 到 body 的 panel）→ 不处理 —— 这里有 prompt 输入框 */
      if (target.closest(`.${styles.imageEditPanel}`)) return;
      /** 点在顶部格式化工具栏上 → 不处理（工具栏按钮要保持焦点操作正文） */
      if (target.closest(`.${styles.floatingToolbar}`)) return;
      e.preventDefault();
      e.stopPropagation();
      commitEdit();
    };
    /** 用 pointerdown 捕获阶段，抢在画布平移/节点选择之前 */
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [editingId, commitEdit]);

  /** click-outside-to-close — 抽到 useClickOutside，三个弹窗独立监听 */
  useClickOutside(showAddMenu, [addMenuRef, addFabBtnRef], () => setShowAddMenu(false));
  useClickOutside(agentOpen, [agentDrawerRef, agentBtnRef], () => setAgentOpen(false));
  useClickOutside(showLibrary, [libraryRef], () => setShowLibrary(false));

  /** 添加基础节点（文本/图片/视频）—— 右键菜单 & 工具栏 & 节点库基础区共用 */
  const addBasicNode = useCallback(
    (kind: "text" | "image" | "video", position?: { x: number; y: number }) => {
      const pos = position ?? { x: 400 + Math.random() * 80, y: 320 + Math.random() * 80 };
      setNodes((ns) => {
        if (kind === "text") {
          return [
            ...ns,
            {
              id: nextNodeId(),
              type: "text",
              position: pos,
              data: { nodeKind: "text", title: "文本", text: "" } satisfies TextNodeData,
            },
          ];
        }
        if (kind === "image") {
          return [
            ...ns,
            {
              id: nextNodeId(),
              type: "image",
              position: pos,
              data: {
                nodeKind: "image",
                kind: "image",
                title: "图片",
                category: "图片",
                tint: "rgba(212, 83, 126, 0.18)",
                size: { w: 300, h: 200 },
              } satisfies ImageNodeData,
            },
          ];
        }
        return [
          ...ns,
          {
            id: nextNodeId(),
            type: "video",
            position: pos,
            data: {
              nodeKind: "video",
              title: "视频",
              category: "视频",
              tint: "rgba(55, 138, 221, 0.20)",
              size: { w: 300, h: 200 },
            } satisfies VideoNodeData,
          },
        ];
      });
      setContextMenu(null);
    },
    [setNodes],
  );

  /** 右键菜单状态 */
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; flowPos: { x: number; y: number } } | null>(
    null,
  );
  const onPaneContextMenu = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      e.preventDefault();
      const rect = (e.target as HTMLElement).closest(`.${styles.board}`)?.getBoundingClientRect();
      if (!rect) return;
      setContextMenu({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        flowPos: screenToFlowPosition({ x: e.clientX, y: e.clientY }),
      });
    },
    [screenToFlowPosition],
  );

  /** 节点库添加（业务能力） */
  const addFromLibrary = useCallback(
    (idx: number) => {
      const lib = NODE_LIBRARY[idx];
      if (!lib) return;
      const baseX = 400 + Math.random() * 80;
      const baseY = 320 + Math.random() * 80;
      if (lib.nodeKind === "image") {
        setNodes((ns) => [
          ...ns,
          {
            id: nextNodeId(),
            type: "image",
            position: { x: baseX, y: baseY },
            data: {
              nodeKind: "image",
              kind: lib.kind,
              title: lib.title,
              category: lib.category,
              tint: lib.tint,
              size: lib.size ?? { w: 240, h: 180 },
            },
          },
        ]);
      } else {
        setNodes((ns) => [
          ...ns,
          {
            id: nextNodeId(),
            type: "card",
            position: { x: baseX, y: baseY },
            data: {
              nodeKind: "card",
              kind: lib.kind,
              title: lib.title,
              category: lib.category,
              fields: lib.fields,
            },
          },
        ]);
      }
      setShowLibrary(false);
    },
    [setNodes],
  );

  /** 连接已存在节点 —— source handle 拖到 target handle 直接建边
     校验必须落在 target handle 上才建边（避免松手在任意节点上误连） */
  const isValidConnection = useCallback(
    (connection: {
      source?: string | null;
      target?: string | null;
      sourceHandle?: string | null;
      targetHandle?: string | null;
    }) => Boolean(connection.target && connection.source && connection.target !== connection.source),
    [],
  );
  /** 连接 helper —— 先移除同节点对的旧边（含隐形残留），再添加带 success 动画的新边 */
  const addEdgeDedup = useCallback(
    (source: string, target: string) => {
      const newEdgeId = `e_${Date.now()}`;
      setEdges((es) => [
        /** 去掉同节点对（含反向）旧边 —— 修复 时代 type:"bezier" 隐形边残留 */
        ...es.filter(
          (e) => !((e.source === source && e.target === target) || (e.source === target && e.target === source)),
        ),
        {
          id: newEdgeId,
          source,
          target,
          type: "default",
          className: "success-draw",
          style: { stroke: "#b5d4f4", strokeWidth: 1.8 },
        } as Edge,
      ]);
      /** 动画 320ms 结束后移除 success-draw className，避免 dasharray 残留 */
      window.setTimeout(() => {
        setEdges((es) =>
          es.map((e) =>
            e.id === newEdgeId ? { ...e, className: "", style: { stroke: "#9a9aa3", strokeWidth: 1.8 } } : e,
          ),
        );
      }, 360);
      /** 目标节点闪光 400ms */
      const targetEl = document.querySelector(`.react-flow__node[data-id="${target}"]`) as HTMLElement | null;
      if (targetEl) {
        targetEl.classList.add("node-flash");
        window.setTimeout(() => targetEl.classList.remove("node-flash"), 420);
      }
      return newEdgeId;
    },
    [setEdges],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target) return;
      addEdgeDedup(connection.source, connection.target);
    },
    [addEdgeDedup],
  );

  /** 从 source handle 开始拖线 —— 记录起始节点 + 起始坐标 */
  const onConnectStart = useCallback(
    (_: unknown, params: { nodeId: string | null; handleId: string | null; handleType: string | null }) => {
      if (params.handleType !== "source") return;
      connectStartRef.current = { nodeId: params.nodeId, clientX: 0, clientY: 0 };
      /** 开始拖线，重置 hover/preview/error 状态 */
      setHoverTargetId(null);
      setPreviewState(null);
      setConnectError(null);
    },
    [],
  );

  /** 拖线连接状态 —— 三态预览 + 成功动效 + 失败 toast */
  const [connectMenu, setConnectMenu] = useState<{
    sourceNodeId: string;
    flowPos: { x: number; y: number };
    clientPos: { x: number; y: number };
  } | null>(null);
  /** 拖线中悬停的目标节点（用来高亮） */
  const [hoverTargetId, setHoverTargetId] = useState<string | null>(null);
  /** 拖线中是否在合法位置上 —— true: 可连 / false: 不可连 / null: 拖到 pane */
  const [previewState, setPreviewState] = useState<"connectable" | "blocked" | null>(null);
  /** 连接失败 toast */
  const [connectError, setConnectError] = useState<string | null>(null);
  const connectErrorTimerRef = useRef<number | null>(null);

  /** 判断某节点是否可作为连线目标（用于 hover 状态判定） */
  const isValidTarget = useCallback(
    (targetId: string): { ok: boolean; reason?: string } => {
      const sourceId = connectStartRef.current.nodeId;
      if (!sourceId) return { ok: false, reason: "未在拖线状态" };
      if (targetId === sourceId) return { ok: false, reason: "不能连到自身" };
      /** 重复边校验 */
      const dup = edges.some(
        (e) => (e.source === sourceId && e.target === targetId) || (e.source === targetId && e.target === sourceId),
      );
      if (dup) return { ok: false, reason: "已存在连线" };
      return { ok: true };
    },
    [edges],
  );

  /** 节点 hover 同步 + pane 兜底：通过 mouseover/mouseout 监听 board */
  useEffect(() => {
    const board = document.querySelector(`.${styles.board}`);
    if (!board) return;
    const onMouseOver: EventListener = (e) => {
      if (!connectStartRef.current.nodeId) return;
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const nodeEl = t.closest(".react-flow__node") as HTMLElement | null;
      if (nodeEl?.dataset?.id) {
        const targetId = nodeEl.dataset.id;
        setHoverTargetId(targetId);
        const v = isValidTarget(targetId);
        setPreviewState(v.ok ? "connectable" : "blocked");
        if (!v.ok) {
          setConnectError(v.reason ?? null);
        } else {
          setConnectError(null);
        }
      } else {
        setHoverTargetId(null);
        setPreviewState(null);
        setConnectError(null);
      }
    };
    const onMouseOut: EventListener = (e) => {
      if (!connectStartRef.current.nodeId) return;
      const me = e as MouseEvent;
      const related = me.relatedTarget as HTMLElement | null;
      const stillInNode = related?.closest(".react-flow__node");
      if (!stillInNode) {
        setHoverTargetId(null);
        setPreviewState(null);
        setConnectError(null);
      }
    };
    board.addEventListener("mouseover", onMouseOver);
    board.addEventListener("mouseout", onMouseOut);
    return () => {
      board.removeEventListener("mouseover", onMouseOver);
      board.removeEventListener("mouseout", onMouseOut);
    };
  }, [isValidTarget]);

  /** 连接失败时短暂显示 toast */
  const showConnectError = useCallback((msg: string) => {
    setConnectError(msg);
    if (connectErrorTimerRef.current) window.clearTimeout(connectErrorTimerRef.current);
    connectErrorTimerRef.current = window.setTimeout(() => setConnectError(null), 1800);
  }, []);

  /** 根据 previewState 给目标节点加 .connectable-target / .blocked-target class */
  useEffect(() => {
    if (hoverTargetId) {
      const el = document.querySelector(`.react-flow__node[data-id="${hoverTargetId}"]`) as HTMLElement | null;
      if (!el) return;
      const cls = previewState === "blocked" ? "blocked-target" : "connectable-target";
      el.classList.add(cls);
      return () => el.classList.remove(cls);
    }
  }, [hoverTargetId, previewState]);

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      const start = connectStartRef.current;
      connectStartRef.current = { nodeId: null, clientX: 0, clientY: 0 };
      const wasHoverId = hoverTargetId;
      const wasPreview = previewState;
      const wasError = connectError;
      /** 拖线结束，重置 hover/preview/error 状态 */
      setHoverTargetId(null);
      setPreviewState(null);
      setConnectError(null);
      if (!start.nodeId) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const isTouch = "touches" in event;
      const clientX = isTouch ? (event.changedTouches?.[0]?.clientX ?? 0) : (event as MouseEvent).clientX;
      const clientY = isTouch ? (event.changedTouches?.[0]?.clientY ?? 0) : (event as MouseEvent).clientY;

      /** 根据 previewState 决定行为 */
      if (wasPreview === "blocked" && wasHoverId) {
        /** 不可连：— 若只是"已存在连线"（多半是隐形旧边），直接替换修复；其他原因弹 toast */
        if (wasHoverId && wasError === "已存在连线") {
          addEdgeDedup(start.nodeId!, wasHoverId);
          return;
        }
        showConnectError(wasError ?? "无法连接到该节点");
        return;
      }
      if (wasPreview === "connectable" && wasHoverId) {
        /** 可连：直接连 + success 动画 + 目标节点闪光 */
        addEdgeDedup(start.nodeId!, wasHoverId);
        return;
      }

      /** 检测松手点是否压到任意节点 —— 通过 :hover 取得 React Flow 已缓存的命中节点 */
      const hovered = document.querySelectorAll(".react-flow__node:hover");
      let targetNodeId: string | null = null;
      hovered.forEach((el) => {
        const nodeEl = el as HTMLElement;
        /** 排除源节点本身 */
        if (!nodeEl.dataset?.id) return;
        if (nodeEl.dataset.id === start.nodeId) return;
        targetNodeId = nodeEl.dataset.id;
      });
      /** 兜底：如果 :hover 没拿到，用 document.elementFromPoint 找 */
      if (!targetNodeId) {
        const underEl = document.elementFromPoint(clientX, clientY);
        if (underEl) {
          const nodeEl = underEl.closest(".react-flow__node") as HTMLElement | null;
          if (nodeEl?.dataset?.id && nodeEl.dataset.id !== start.nodeId) {
            targetNodeId = nodeEl.dataset.id;
          }
        }
      }

      if (targetNodeId) {
        /** 落在已有节点上 → 直接连（绕开 strict + connectionRadius 的 18px 限制；dedup 修复隐形旧边） */
        addEdgeDedup(start.nodeId!, targetNodeId);
        return;
      }

      /** 落在 pane 上 → 弹菜单让用户挑新建节点类型 */
      const flowPos = screenToFlowPosition({ x: clientX, y: clientY });
      setConnectMenu({
        sourceNodeId: start.nodeId,
        flowPos,
        clientPos: { x: clientX, y: clientY },
      });
    },
    [screenToFlowPosition, hoverTargetId, previewState, connectError, showConnectError, addEdgeDedup],
  );

  /** 从「引用该节点生成」菜单中挑一个类型创建节点并连线 */
  const addNodeFromConnect = useCallback(
    (kind: "text" | "image" | "video") => {
      if (!connectMenu) return;
      const newId = nextNodeId();
      const { flowPos, sourceNodeId } = connectMenu;
      const meta = (() => {
        if (kind === "text")
          return {
            type: "text",
            data: { nodeKind: "text", title: "新文本节点", text: "双击编辑内容…" } satisfies TextNodeData,
          };
        if (kind === "image")
          return {
            type: "image",
            data: {
              nodeKind: "image",
              kind: "image",
              title: "图片节点",
              category: "图片",
              tint: "rgba(212, 83, 126, 0.18)",
              size: { w: 300, h: 200 },
            } satisfies ImageNodeData,
          };
        return {
          type: "video",
          data: {
            nodeKind: "video",
            title: "视频节点",
            category: "视频",
            tint: "rgba(55, 138, 221, 0.20)",
            size: { w: 300, h: 200 },
          } satisfies VideoNodeData,
        };
      })();
      setNodes((ns) => [
        ...ns,
        {
          id: newId,
          type: meta.type,
          /** 新节点左边缘对齐线尾（松手点），节点出现在连线末端右侧 */
          position: { x: flowPos.x, y: flowPos.y - 60 },
          data: meta.data,
        },
      ]);
      setEdges((es) => [
        ...es,
        {
          id: `e_${Date.now()}`,
          source: sourceNodeId,
          target: newId,
          type: "default",
          style: { stroke: "#7f7f86", strokeWidth: 1.6 },
        },
      ]);
      setConnectMenu(null);
    },
    [connectMenu, setNodes, setEdges],
  );

  /** Agent 抽屉提交 —— 追加用户气泡 + Agent 占位回复（后续接真 API） */
  const submitChat = useCallback(() => {
    if (!chatInput.trim() && !chatThumb) return;
    const userText = chatInput.trim();
    setAgentMessages((ms) => [
      ...ms,
      { role: "user", text: userText || "（图片）", thumb: chatThumb },
      { role: "agent", text: "已收到你的指令。编排能力即将上线，我会根据画布内容生成对应节点。" },
    ]);
    setChatInput("");
    setChatThumb(null);
  }, [chatInput, chatThumb]);

  /** chat 缩略上传（占位：DataURL） */
  const handleThumb = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setChatThumb(String(reader.result));
  }, []);

  /** 顶部 NodeToolbar：根据选中节点的 kind 决定工具胶囊列表（text 基础节点给编辑类工具） */
  const selData = selectedNode?.data as AnyNodeData | undefined;
  const selectedKind: NodeKind = selData && "kind" in selData && selData.kind ? selData.kind : "llm";
  const toolbarItems: { label: string; icon: React.ReactNode }[] = NODE_TOOLBAR[selectedKind] ?? NODE_TOOLBAR.llm ?? [];

  return (
    <EnterEditContext.Provider
      value={{
        editingId,
        editingKind: editingId
          ? (((nodes.find((n) => n.id === editingId)?.data as Record<string, unknown> | undefined)?.nodeKind as
              string | undefined) ?? null)
          : null,
        buffer: editBuffer,
        setBuffer: setEditBuffer,
        enterEdit,
        saveEdit,
        commitEdit,
        commitImageEdit,
        commitVideoEdit,
        exitEdit,
        focusMode: { nodeId: editingId },
        onApplyFormat,
        editorElRef,
        composingRef,
        imageEditStateRef,
        videoEditStateRef,
      }}
    >
      <div className={styles.shell}>
        {/* 顶部栏：积分（悬停弹窗）+ Agent 圆头像并列右上角 */}
        <div className={styles.topbar}>
          <div className={styles.topbarLeft} />
          <div className={styles.topbarRight}>
            <div className={styles.creditWrap} onMouseEnter={openCredit} onMouseLeave={closeCredit}>
              <button className={styles.creditPill} title="积分">
                <Coins size={12} />
                100
              </button>
              {creditHover && (
                <div className={styles.creditPopover} onMouseEnter={openCredit} onMouseLeave={closeCredit}>
                  <div className={styles.creditMemberCard}>
                    <Coins size={14} className={styles.creditMemberIcon} />
                    <span className={styles.creditMemberLabel}>个人非会员</span>
                    <button className={styles.creditMemberBtn}>开通会员</button>
                  </div>
                  <div className={styles.creditBalanceRow}>
                    <span className={styles.creditBalanceLabel}>
                      积分余额：<b>100点</b>
                    </span>
                    <button className={styles.creditRecharge}>充值</button>
                  </div>
                  <div className={styles.creditDetailList}>
                    <div className={styles.creditDetailRow}>
                      <span>会员订阅积分</span>
                      <span>0点</span>
                    </div>
                    <div className={styles.creditDetailRow}>
                      <span>通用充值积分</span>
                      <span>0点</span>
                    </div>
                    <div className={styles.creditDetailRow}>
                      <span>模型卡积分</span>
                      <span>0点</span>
                    </div>
                    <div className={styles.creditDetailRow}>
                      <span>免费积分</span>
                      <span>100点</span>
                    </div>
                  </div>
                  <div className={styles.creditMenuSep} />
                  <div className={styles.creditMenuList}>
                    <button className={styles.creditMenuItem} onClick={() => toast("订阅管理：即将上线", "info")}>
                      <span>订阅管理</span>
                      <ChevronRight size={13} />
                    </button>
                    <button className={styles.creditMenuItem} onClick={() => toast("积分管理：即将上线", "info")}>
                      <span>积分管理</span>
                      <ChevronRight size={13} />
                    </button>
                    <button
                      className={styles.creditMenuItem}
                      onClick={() => toast("积分消耗顺序设置：即将上线", "info")}
                    >
                      <span>积分消耗顺序设置</span>
                      <ChevronRight size={13} />
                    </button>
                    <button className={styles.creditMenuItem} onClick={() => toast("联系客服：即将上线", "info")}>
                      <span>联系客服</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              ref={agentBtnRef}
              className={`${styles.agentAvatarBtn} ${agentOpen ? styles.agentAvatarBtnActive : ""}`}
              title="织光 Agent"
              aria-label="织光 Agent"
              onClick={() => setAgentOpen((v) => !v)}
            >
              <Bot size={15} />
            </button>
          </div>
        </div>

        {/* Agent 右侧抽屉 —— 气泡式对话 */}
        {agentOpen && (
          <div ref={agentDrawerRef} className={styles.agentDrawer}>
            <div className={styles.agentDrawerHead}>
              <div className={styles.agentDrawerHeadLeft}>
                <div className={styles.agentDrawerAvatar}>
                  <Bot size={13} />
                </div>
                <div className={styles.agentDrawerTitle}>
                  <span className={styles.agentDrawerName}>织光 Agent</span>
                  <span className={styles.agentDrawerModel}>✦ {chatModel}</span>
                </div>
              </div>
              <button className={styles.agentDrawerClose} onClick={() => setAgentOpen(false)} aria-label="收起">
                <X size={13} />
              </button>
            </div>
            <div className={styles.agentDrawerMessages}>
              {agentMessages.map((m, i) => (
                <div
                  key={i}
                  className={`${styles.agentBubbleRow} ${m.role === "user" ? styles.agentBubbleRowUser : ""}`}
                >
                  {m.thumb && <img src={m.thumb} alt="参考图" className={styles.agentBubbleThumb} />}
                  <div className={`${styles.agentBubble} ${m.role === "user" ? styles.agentBubbleUser : ""}`}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.agentDrawerInputRow}>
              <label className={styles.chatPlus} title="添加参考图">
                <Plus size={14} />
                <input type="file" accept="image/*" hidden onChange={handleThumb} />
              </label>
              {chatThumb && (
                <div className={styles.chatThumb}>
                  <img src={chatThumb} alt="参考图" />
                  <button className={styles.chatThumbClose} onClick={() => setChatThumb(null)} aria-label="移除">
                    <X size={10} />
                  </button>
                </div>
              )}
              <input
                className={styles.agentDrawerInput}
                placeholder="告诉 Agent 想做什么…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitChat();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setAgentOpen(false);
                  }
                }}
              />
              <button
                className={`${styles.chatSend} ${chatInput.trim() || chatThumb ? styles.chatSendActive : ""}`}
                onClick={submitChat}
                disabled={!chatInput.trim() && !chatThumb}
                title="发送"
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        )}

        {/* 选中节点的浮出工具胶囊（按 LibTV 模式） */}
        {selectedNode && !editingId && (
          <div className={styles.nodeToolbar}>
            {toolbarItems.map((t) => (
              <button key={t.label} className={styles.nodeToolbarItem}>
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* 聚焦编辑浮层（顶部格式化工具栏；移除左侧完成/取消面板 —— 点击外部自动保存） */}
        <FloatingToolbar />

        {/* 图片节点编辑栏 — 由 Portal 挂到 body，屏宽 40%，距屏底 16px，水平居中对齐当前编辑节点 */}
        <ImageEditPanel />
        {/* 视频节点编辑栏 — 同款外置方案 + 5 chip + 视频字段 */}
        <VideoEditPanel />

        {/* 画布主区 */}
        <div className={styles.board}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onSelectionChange={onSelectionChange}
            onPaneContextMenu={onPaneContextMenu}
            onPaneClick={() => {
              setContextMenu(null);
              setConnectMenu(null);
            }}
            onMoveStart={() => {
              setContextMenu(null);
              setConnectMenu(null);
            }}
            /** 节点之间连线 / 从 source 拖到空白处创建新节点 */
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            isValidConnection={isValidConnection}
            /** strict 模式 —— 只在松手落在明确的 handle 上才算连接（否则默认按就近 handle 误连） */
            connectionMode={ConnectionMode.Strict}
            connectionRadius={18}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.3}
            maxZoom={2.5}
            /** Mac 触控板原生手势 —— 双指滚动=平移画布，捏合(ctrl+wheel)=缩放；
             编辑器容器加 nowheel 后，在节点内滚动不再带动画布 */
            panOnScroll
            zoomOnScroll={false}
            zoomOnPinch
            /** 连接线样式由全局 :global(.react-flow__connection-path) 控制（默认 connectable 态） */
            proOptions={{ hideAttribution: true }}
            className={styles.flowRoot}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} className={styles.bg} />
            <Controls showInteractive={false} className={styles.controls} />
            <MiniMap pannable zoomable className={styles.minimap} maskColor="rgba(13, 13, 15, 0.7)" />
          </ReactFlow>

          {/* 连线失败 toast */}
          {connectError && (
            <div className={styles.connectError} role="alert">
              <X size={12} />
              <span>无法连接：{connectError}</span>
            </div>
          )}

          {/* 右键菜单：3 类基础节点 */}
          {contextMenu && (
            <div className={styles.contextMenu} style={{ left: contextMenu.x, top: contextMenu.y }}>
              <div className={styles.contextMenuHead}>添加节点</div>
              <button className={styles.contextMenuItem} onClick={() => addBasicNode("text", contextMenu.flowPos)}>
                <TypeIcon size={13} />
                文本
              </button>
              <button className={styles.contextMenuItem} onClick={() => addBasicNode("image", contextMenu.flowPos)}>
                <ImageIcon size={13} />
                图片
              </button>
              <button className={styles.contextMenuItem} onClick={() => addBasicNode("video", contextMenu.flowPos)}>
                <VideoIcon size={13} />
                视频
              </button>
            </div>
          )}

          {/* 从节点拖线到空白处 → 弹「引用该节点生成」菜单 */}
          {connectMenu && (
            <div
              className={styles.contextMenu}
              style={{ left: connectMenu.clientPos.x, top: connectMenu.clientPos.y, minWidth: 220 }}
            >
              <div className={styles.contextMenuHead}>引用该节点生成</div>
              <button className={styles.contextMenuItem} onClick={() => addNodeFromConnect("text")}>
                <TypeIcon size={13} />
                文本
              </button>
              <button className={styles.contextMenuItem} onClick={() => addNodeFromConnect("image")}>
                <ImageIcon size={13} />
                图片
              </button>
              <button className={styles.contextMenuItem} onClick={() => addNodeFromConnect("video")}>
                <VideoIcon size={13} />
                视频
              </button>
              <div className={styles.contextMenuSep} />
              <button className={styles.contextMenuItem} disabled title="即将上线">
                <Sparkles size={13} />
                智能剪辑
                <span className={styles.contextMenuBadge}>Beta</span>
              </button>
              <button className={styles.contextMenuItem} disabled title="即将上线">
                <Film size={13} />
                导演台
                <span className={`${styles.contextMenuBadge} ${styles.contextMenuBadgeNew}`}>NEW</span>
              </button>
              <button className={styles.contextMenuItem} disabled title="即将上线">
                <Layers size={13} />
                逐帧拉片
                <span className={styles.contextMenuBadge}>SD 2.5</span>
              </button>
              <div className={styles.contextMenuSep} />
              <button className={styles.contextMenuItem} disabled title="即将上线">
                <Music size={13} />
                音频
              </button>
              <button className={styles.contextMenuItem} disabled title="即将上线">
                <FileText size={13} />
                脚本
              </button>
              <button className={styles.contextMenuItem} disabled title="即将上线">
                <Link2 size={13} />
                参考节点
              </button>
            </div>
          )}

          {nodes.length === 0 && (
            <div className={styles.guide}>
              <div className={styles.guideBubble}>
                <div className={styles.guideTitle}>右键画布 · 添加节点</div>
                <div className={styles.guideSub}>文本 / 图片 / 视频，也可从节点 handle 拖出连线</div>
              </div>
              <button className={styles.guideLoad} onClick={() => void loadFromLatest()} disabled={!hasRun}>
                <RefreshCw size={14} />
                {hasRun ? "从最近任务加载" : "暂无已完成任务"}
              </button>
            </div>
          )}
        </div>

        {/* 底部：5 个工具图标（简化版） + 中央 chat-bar */}
        {/* 底部：仅左下角 + 圆角块（点击弹节点菜单），其余工具与聊天栏全部移除 */}
        <div className={styles.bottomLeftDock}>
          <div className={styles.addWrap}>
            <button
              ref={addFabBtnRef}
              className={`${styles.addFab} ${showAddMenu ? styles.addFabActive : ""}`}
              title="添加节点"
              onClick={() => {
                setShowAddMenu((v) => !v);
                setShowLibrary(false);
              }}
            >
              <Plus size={16} />
            </button>
            {showAddMenu && (
              <div ref={addMenuRef} className={styles.addMenu}>
                <div className={styles.contextMenuHead}>基础节点</div>
                <button
                  className={styles.contextMenuItem}
                  onClick={() => {
                    addBasicNode("text");
                    setShowAddMenu(false);
                  }}
                >
                  <TypeIcon size={13} />
                  文本
                </button>
                <button
                  className={styles.contextMenuItem}
                  onClick={() => {
                    addBasicNode("image");
                    setShowAddMenu(false);
                  }}
                >
                  <ImageIcon size={13} />
                  图片
                </button>
                <button
                  className={styles.contextMenuItem}
                  onClick={() => {
                    addBasicNode("video");
                    setShowAddMenu(false);
                  }}
                >
                  <VideoIcon size={13} />
                  视频
                </button>
                <div className={styles.addMenuSep} />
                <button
                  className={styles.contextMenuItem}
                  onClick={() => {
                    setShowLibrary(true);
                    setShowAddMenu(false);
                  }}
                >
                  <Sparkles size={13} />
                  业务能力…
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 节点库弹层（基础节点 + 业务能力双区） */}
        {showLibrary && (
          <div className={styles.libraryBackdrop} onClick={() => setShowLibrary(false)}>
            <div ref={libraryRef} className={styles.library} onClick={(e) => e.stopPropagation()}>
              <div className={styles.libraryHead}>
                <span>节点库</span>
                <button onClick={() => setShowLibrary(false)} aria-label="关闭">
                  <X size={14} />
                </button>
              </div>

              {/* 基础节点区 */}
              <div className={styles.librarySectionLabel}>基础节点</div>
              <div className={styles.basicGrid}>
                <button
                  className={styles.basicItem}
                  onClick={() => {
                    addBasicNode("text");
                    setShowLibrary(false);
                  }}
                >
                  <div className={styles.basicIcon}>
                    <TypeIcon size={16} />
                  </div>
                  <span>文本</span>
                  <span className={styles.basicHint}>记录想法 / 说明</span>
                </button>
                <button
                  className={styles.basicItem}
                  onClick={() => {
                    addBasicNode("image");
                    setShowLibrary(false);
                  }}
                >
                  <div className={`${styles.basicIcon} ${styles.basicImage}`}>
                    <ImageIcon size={16} />
                  </div>
                  <span>图片</span>
                  <span className={styles.basicHint}>上传或生成</span>
                </button>
                <button
                  className={styles.basicItem}
                  onClick={() => {
                    addBasicNode("video");
                    setShowLibrary(false);
                  }}
                >
                  <div className={`${styles.basicIcon} ${styles.basicVideo}`}>
                    <VideoIcon size={16} />
                  </div>
                  <span>视频</span>
                  <span className={styles.basicHint}>上传或生成</span>
                </button>
              </div>

              <div className={styles.librarySectionLabel} style={{ marginTop: 14 }}>
                业务能力
              </div>
              <div className={styles.libraryGrid}>
                {NODE_LIBRARY.map((lib, i) => {
                  const meta = KIND_META[lib.kind];
                  return (
                    <button
                      key={i}
                      className={styles.libraryItem}
                      onClick={() => addFromLibrary(i)}
                      style={{ borderColor: meta.color.stroke, background: meta.color.bg }}
                    >
                      <div className={styles.libraryTop}>
                        <span
                          className={styles.libraryCategory}
                          style={{ color: meta.color.text, background: meta.color.stroke + "33" }}
                        >
                          {lib.category}
                        </span>
                        <span className={styles.libraryType} style={{ color: meta.color.text }}>
                          {lib.title}
                        </span>
                      </div>
                      <span className={styles.libraryMeta} style={{ color: meta.color.soft }}>
                        {lib.meta}
                      </span>
                      {lib.nodeKind === "card" && (
                        <div className={styles.libraryFields}>
                          {lib.fields.slice(0, 3).map((f, j) => (
                            <div key={j} className={styles.libraryField}>
                              <span className={styles.libraryFieldLabel}>{f.label}</span>
                              <span className={styles.libraryFieldValue}>{f.value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
      );
    </EnterEditContext.Provider>
  );
}

/**
 * 为画布工作区挂载 React Flow 上下文。
 *
 * @returns Canvas 路由页面。
 */
export default function CanvasPage() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
