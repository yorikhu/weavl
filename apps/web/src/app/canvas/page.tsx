"use client";

import React from "react";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useClickOutside } from "@/hooks/useClickOutside";
import { toast } from "@/hooks/useToast";
import { useTheme } from "@/provider/ThemeProvider";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Edge,
  type Node,
  ReactFlowProvider,
  useReactFlow,
  useUpdateNodeInternals,
  ConnectionMode,
  SelectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { RunView } from "@weavl/shared";
import { X } from "lucide-react";
import styles from "./page.module.scss";
import { API } from "@/lib/env";
import { EnterEditContext } from "./editContext";
import { ImageEditPanel, VideoEditPanel, nodeTypes } from "./components/CanvasNodes";
import { FloatingToolbar } from "./components/FloatingToolbar";
import { CanvasViewportControls } from "./components/CanvasViewportControls";
import { CanvasProjectHeader } from "./components/CanvasProjectHeader";
import { CanvasAgentDrawer } from "./components/CanvasAgentDrawer";
import { CanvasAddMenus } from "./components/CanvasAddMenus";
import addMenuStyles from "./components/CanvasAddMenus/index.module.scss";
import { CanvasNodeLibrary } from "./components/CanvasNodeLibrary";
import { CanvasEmptyState } from "./components/CanvasEmptyState";
import { CanvasNodeToolbar } from "./components/CanvasNodeToolbar";
import { useCanvasEditing } from "./hooks/useCanvasEditing";
import { useCanvasConnections } from "./hooks/useCanvasConnections";
import type { BasicNodeKind } from "./types/nodes";
import { NODE_LIBRARY } from "./constants";
import {
  CANVAS_CONNECTION_RADIUS,
  CANVAS_MAX_ZOOM,
  CANVAS_MIN_ZOOM,
  INITIAL_CANVAS_VIEWPORT,
} from "./constants/viewport";
import { createBasicNode, createLibraryNode } from "./utils/nodeFactory";
import { buildLatestRunGraph } from "./utils/latestRunGraph";
import { getNodeToolbarKind, selectionIncludesRaisedTitle } from "./utils/nodeSelectors";

/**
 * 协调 React Flow 状态、节点编辑、连线以及页面级浮层。
 *
 * @returns 完整的画布工作区。
 */
function CanvasInner() {
  const router = useRouter();
  const { theme } = useTheme();
  const { screenToFlowPosition } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [projectName, setProjectName] = useState("未命名项目");
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const nodeIdsKey = nodes.map((node) => node.id).join("|");

  /** handle 位置由 CSS 调整后，刷新 React Flow 缓存的正式边锚点。 */
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      updateNodeInternals(nodes.map((node) => node.id));
    });
    return () => window.cancelAnimationFrame(frame);
    // 节点集合不变时无需因拖动位置反复测量 handle。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeIdsKey, updateNodeInternals]);
  /** 挂载时清洗 时代 type:"bezier" 隐形边 → "default"（React Flow 无此内置类型不渲染） */
  useEffect(() => {
    setEdges((es) =>
      es.some((e) => e.type === "bezier")
        ? es.map((e) => (e.type === "bezier" ? ({ ...e, type: "default" } as Edge) : e))
        : es,
    );
  }, [setEdges]);

  const [showLibrary, setShowLibrary] = useState(false);
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
  const {
    editingId,
    setEditingId,
    editBuffer,
    setEditBuffer,
    editorElRef,
    composingRef,
    enterEdit,
    exitEdit,
    saveEdit,
    commitEdit,
    commitImageEdit,
    commitVideoEdit,
    onApplyFormat,
    imageEditStateRef,
    videoEditStateRef,
  } = useCanvasEditing(nodes, setNodes);
  const {
    connectMenu,
    setConnectMenu,
    pendingLineStart,
    connectError,
    isValidConnection,
    onConnect,
    onConnectStart,
    onConnectEnd,
    addNodeFromConnect,
  } = useCanvasConnections(nodes, edges, setNodes, setEdges);

  const createProject = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setProjectName("未命名项目");
    setSelectedNode(null);
    setEditingId(null);
    setProjectMenuOpen(false);
    toast("已创建空白项目", "success");
  }, [setEdges, setNodes, setEditingId]);

  const deleteProject = useCallback(() => {
    if (!window.confirm(`确定删除项目“${projectName}”吗？此操作无法撤销。`)) return;
    setProjectMenuOpen(false);
    setNodes([]);
    setEdges([]);
    toast("项目已删除", "success");
    router.push("/projects");
  }, [projectName, router, setEdges, setNodes]);

  /** click-outside-to-close —— 给 Agent 抽屉 / 节点库提供 ref，
     在 useClickOutside 里统一判断「pointerdown 在白名单外则关闭」。 */
  const agentDrawerRef = useRef<HTMLDivElement | null>(null);
  const agentBtnRef = useRef<HTMLButtonElement | null>(null);
  const libraryRef = useRef<HTMLDivElement | null>(null);

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
      const graph = buildLatestRunGraph(data);
      setNodes(graph.nodes);
      setEdges(graph.edges);
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

  /** click-outside-to-close — 抽到 useClickOutside，三个弹窗独立监听 */
  useClickOutside(agentOpen, [agentDrawerRef, agentBtnRef], () => setAgentOpen(false));
  useClickOutside(showLibrary, [libraryRef], () => setShowLibrary(false));

  /** 添加基础节点（文本/图片/视频）—— 右键菜单 & 工具栏 & 节点库基础区共用 */
  const addBasicNode = useCallback(
    (kind: BasicNodeKind, position?: { x: number; y: number }) => {
      const pos = position ?? { x: 400 + Math.random() * 80, y: 320 + Math.random() * 80 };
      setNodes((ns) => [...ns, createBasicNode(kind, pos)]);
      setContextMenu(null);
    },
    [setNodes],
  );

  /** 画布添加菜单状态（右键或双击空白处触发）。 */
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; flowPos: { x: number; y: number } } | null>(
    null,
  );
  const openCanvasAddMenu = useCallback(
    (clientX: number, clientY: number) => {
      const rect = document.querySelector(`.${styles.board}`)?.getBoundingClientRect();
      if (!rect) return;
      setContextMenu({
        x: clientX - rect.left,
        y: clientY - rect.top,
        flowPos: screenToFlowPosition({ x: clientX, y: clientY }),
      });
      setConnectMenu(null);
    },
    [screenToFlowPosition, setConnectMenu],
  );
  const onPaneContextMenu = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      e.preventDefault();
      openCanvasAddMenu(e.clientX, e.clientY);
    },
    [openCanvasAddMenu],
  );
  const onBoardDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (
        target.closest(
          ".react-flow__node, .react-flow__edge, .react-flow__controls, .react-flow__minimap, button, input, textarea, [contenteditable='true']",
        ) ||
        target.closest(`.${addMenuStyles.contextMenu}`)
      ) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      openCanvasAddMenu(e.clientX, e.clientY);
    },
    [openCanvasAddMenu],
  );

  /** 节点库添加（业务能力） */
  const addFromLibrary = useCallback(
    (idx: number) => {
      const lib = NODE_LIBRARY[idx];
      if (!lib) return;
      const baseX = 400 + Math.random() * 80;
      const baseY = 320 + Math.random() * 80;
      setNodes((ns) => [...ns, createLibraryNode(lib, { x: baseX, y: baseY })]);
      setShowLibrary(false);
    },
    [setNodes],
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
  const selectedKind = getNodeToolbarKind(selectedNode);
  const selectedNodeCount = nodes.reduce((count, node) => count + (node.selected ? 1 : 0), 0);
  const selectionHasRaisedTitle = selectionIncludesRaisedTitle(nodes);

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
      <div className={`${styles.shell} ${theme === "light" ? styles.shellLight : ""}`}>
        <CanvasProjectHeader
          projectName={projectName}
          onProjectNameChange={setProjectName}
          projectMenuOpen={projectMenuOpen}
          onProjectMenuOpenChange={setProjectMenuOpen}
          onHome={() => router.push("/home")}
          onProjects={() => router.push("/projects")}
          onCreateProject={createProject}
          onDeleteProject={deleteProject}
          agentOpen={agentOpen}
          onToggleAgent={() => setAgentOpen((open) => !open)}
          agentButtonRef={agentBtnRef}
        />
        {agentOpen && (
          <CanvasAgentDrawer
            drawerRef={agentDrawerRef}
            messages={agentMessages}
            model={chatModel}
            input={chatInput}
            thumb={chatThumb}
            onInputChange={setChatInput}
            onThumbChange={handleThumb}
            onRemoveThumb={() => setChatThumb(null)}
            onSubmit={submitChat}
            onClose={() => setAgentOpen(false)}
          />
        )}
        {selectedNode && !editingId && <CanvasNodeToolbar kind={selectedKind} />}

        {/* 聚焦编辑浮层（顶部格式化工具栏；移除左侧完成/取消面板 —— 点击外部自动保存） */}
        <FloatingToolbar />

        {/* 图片节点编辑栏 — 由 Portal 挂到 body，屏宽 40%，距屏底 16px，水平居中对齐当前编辑节点 */}
        <ImageEditPanel />
        {/* 视频节点编辑栏 — 同款外置方案 + 5 chip + 视频字段 */}
        <VideoEditPanel />

        {/* 画布主区 */}
        <div className={styles.board} onDoubleClick={onBoardDoubleClick}>
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
            connectionRadius={CANVAS_CONNECTION_RADIUS}
            nodeTypes={nodeTypes}
            /** 默认箭头框选；按住空格才允许鼠标拖动画布。 */
            panOnDrag={false}
            panActivationKeyCode="Space"
            selectionOnDrag
            selectionKeyCode={null}
            selectionMode={SelectionMode.Partial}
            multiSelectionKeyCode="Shift"
            defaultViewport={INITIAL_CANVAS_VIEWPORT}
            minZoom={CANVAS_MIN_ZOOM}
            maxZoom={CANVAS_MAX_ZOOM}
            /** Mac 触控板原生手势 —— 双指滚动=平移画布，捏合(ctrl+wheel)=缩放；
             编辑器容器加 nowheel 后，在节点内滚动不再带动画布 */
            panOnScroll
            zoomOnScroll={false}
            zoomOnPinch
            zoomOnDoubleClick={false}
            /** 连接线样式由全局 :global(.react-flow__connection-path) 控制（默认 connectable 态） */
            proOptions={{ hideAttribution: true }}
            className={`${styles.flowRoot} ${selectionHasRaisedTitle ? (styles.selectionIncludesTitle ?? "") : ""} ${selectedNodeCount > 1 ? (styles.hasMultiSelection ?? "") : ""}`}
          >
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} className={styles.bg} />
            <MiniMap pannable zoomable className={styles.minimap} maskColor="rgba(13, 13, 15, 0.7)" />
          </ReactFlow>

          <CanvasViewportControls />

          {/* 连线失败 toast */}
          {connectError && (
            <div className={styles.connectError} role="alert">
              <X size={12} />
              <span>无法连接：{connectError}</span>
            </div>
          )}

          <CanvasAddMenus
            addMenu={contextMenu}
            connectMenu={connectMenu}
            pendingLineStart={pendingLineStart}
            onAddBasic={addBasicNode}
            onAddConnected={addNodeFromConnect}
            onOpenLibrary={() => {
              setContextMenu(null);
              setShowLibrary(true);
            }}
          />
          {nodes.length === 0 && (
            <CanvasEmptyState
              hasRecentRun={hasRun}
              onAdd={openCanvasAddMenu}
              onLoadRecent={() => void loadFromLatest()}
            />
          )}
        </div>

        {showLibrary && (
          <CanvasNodeLibrary
            libraryRef={libraryRef}
            onClose={() => setShowLibrary(false)}
            onAddBasic={(kind) => {
              addBasicNode(kind);
              setShowLibrary(false);
            }}
            onAddFromLibrary={addFromLibrary}
          />
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
