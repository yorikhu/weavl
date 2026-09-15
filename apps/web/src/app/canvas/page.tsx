"use client";

import React from "react";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useClickOutside } from "@/hooks/useClickOutside";
import { toast } from "@/hooks/useToast";
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
import type { AgentConversation, Asset, AssetKind, CanvasProject, RunView } from "@weavl/shared";
import { FolderOpen, X } from "lucide-react";
import styles from "./page.module.scss";
import { API } from "@/lib/env";
import { jsonBody, studioApi } from "@/lib/studioApi";
import { EnterEditContext } from "./editContext";
import { ImageEditPanel, TextEditPanel, VideoEditPanel, nodeTypes } from "./components/CanvasNode";
import { CanvasViewportControls } from "./components/CanvasViewportControls";
import { CanvasProjectHeader } from "./components/CanvasProjectHeader";
import { CanvasAgentDrawer } from "./components/CanvasAgentDrawer";
import { CanvasAddMenus, type CanvasAddMenuPosition } from "./components/CanvasAddMenus";
import addMenuStyles from "./components/CanvasAddMenus/index.module.scss";
import { CanvasEmptyState } from "./components/CanvasEmptyState";
import { useCanvasEditing } from "./hooks/useCanvasEditing";
import { useCanvasConnections } from "./hooks/useCanvasConnections";
import { useCanvasHistory } from "./hooks/useCanvasHistory";
import type { BasicNodeKind } from "./types/nodes";
import {
  CANVAS_CONNECTION_RADIUS,
  CANVAS_MAX_ZOOM,
  CANVAS_MIN_ZOOM,
  INITIAL_CANVAS_VIEWPORT,
} from "./constants/viewport";
import { createBasicNode } from "./utils/nodeFactory";
import { buildLatestRunGraph } from "./utils/latestRunGraph";
import { selectionIncludesRaisedTitle } from "./utils/nodeSelectors";
import { assetToCanvasNode } from "@/utils/assetNode";
import { openCanvasAfter } from "@/utils/openCanvas";
import { uploadAsset } from "@/utils/uploadAsset";

function nodeAssetPayload(node: Node): { name: string; kind: AssetKind; content: string; mimeType: string } {
  const data = node.data as Record<string, unknown>;
  const name = typeof data.title === "string" && data.title.trim() ? data.title.trim() : "画布节点";
  if (data.nodeKind === "image") {
    return {
      name,
      kind: "image",
      content: typeof data.url === "string" && data.url ? data.url : JSON.stringify(data),
      mimeType: typeof data.url === "string" && data.url.startsWith("data:image/") ? "image/*" : "application/json",
    };
  }
  if (data.nodeKind === "video") {
    return {
      name,
      kind: "video",
      content: typeof data.url === "string" && data.url ? data.url : JSON.stringify(data),
      mimeType: typeof data.url === "string" && data.url.startsWith("data:video/") ? "video/*" : "application/json",
    };
  }
  const content =
    typeof data.text === "string"
      ? data.text
      : Array.isArray(data.fields)
        ? data.fields
            .map((field) => {
              const item = field as { label?: string; value?: string };
              return `${item.label ?? ""}：${item.value ?? ""}`;
            })
            .join("\n")
        : JSON.stringify(data, null, 2);
  return { name, kind: "text", content, mimeType: "text/plain" };
}

/**
 * 协调 React Flow 状态、节点编辑、连线以及页面级浮层。
 *
 * @returns 完整的画布工作区。
 */
function CanvasInner() {
  const router = useRouter();
  const { screenToFlowPosition, setViewport } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [projectName, setProjectName] = useState("未命名项目");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [canvasId, setCanvasId] = useState<string | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [viewportState, setViewportState] = useState(INITIAL_CANVAS_VIEWPORT);
  const initializingRef = useRef(false);
  const savedNameRef = useRef("未命名项目");
  const [assetPanelOpen, setAssetPanelOpen] = useState(false);
  const [availableAssets, setAvailableAssets] = useState<Asset[]>([]);
  const [canvasConversationId, setCanvasConversationId] = useState<string | null>(null);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const canvasUploadRef = useRef<HTMLInputElement | null>(null);
  const uploadPositionRef = useRef({ x: 400, y: 320 });
  const nodeIdsKey = nodes.map((node) => node.id).join("|");
  const { canUndo, canRedo, undo, redo } = useCanvasHistory(nodes, edges, setNodes, setEdges, canvasReady);

  useEffect(() => {
    if (initializingRef.current) return;
    initializingRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const requestedProject = params.get("projectId");
    const requestedCanvas = params.get("canvasId");
    void (async () => {
      try {
        const project = requestedProject
          ? await studioApi<CanvasProject>(`/studio/projects/${requestedProject}`)
          : await studioApi<CanvasProject>("/studio/projects", {
              method: "POST",
              body: jsonBody({ name: "未命名项目" }),
            });
        const canvas = project.canvases.find((item) => item.id === requestedCanvas) || project.canvases[0];
        if (!canvas) throw new Error("画布不存在");
        setNodes(canvas.nodes as Node[]);
        setEdges(canvas.edges as Edge[]);
        setProjectName(project.name);
        savedNameRef.current = project.name;
        setProjectId(project.id);
        setCanvasId(canvas.id);
        void studioApi<AgentConversation[]>("/studio/conversations")
          .then((conversations) => {
            const previous = conversations.find((item) => item.projectId === project.id && !item.archived);
            if (previous) {
              setCanvasConversationId(previous.id);
              setAgentMessages(
                previous.messages.map((message) => ({
                  role: message.role === "assistant" ? "agent" : "user",
                  text: message.content,
                })),
              );
            }
          })
          .catch(() => {});
        setViewportState(canvas.viewport);
        void setViewport(canvas.viewport);
        if (!requestedProject) router.replace(`/canvas?projectId=${project.id}&canvasId=${canvas.id}`);
        setCanvasReady(true);
      } catch (cause) {
        toast((cause as Error).message || "画布加载失败");
        router.replace("/projects");
      }
    })();
  }, [router, setEdges, setNodes, setViewport]);

  useEffect(() => {
    if (!canvasReady || !projectId || !canvasId) return;
    const timer = window.setTimeout(() => {
      void studioApi(`/studio/projects/${projectId}/canvases/${canvasId}`, {
        method: "PATCH",
        body: jsonBody({ nodes, edges, viewport: viewportState }),
      }).catch(() => toast("画布自动保存失败"));
      if (projectName !== savedNameRef.current) {
        savedNameRef.current = projectName;
        void studioApi(`/studio/projects/${projectId}`, {
          method: "PATCH",
          body: jsonBody({ name: projectName }),
        }).catch(() => toast("项目名称保存失败"));
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [nodes, edges, viewportState, projectName, projectId, canvasId, canvasReady]);

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
    editingMode,
    editBuffer,
    setEditBuffer,
    editorElRef,
    composingRef,
    enterEdit,
    focusNode,
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
    isValidConnection,
    onConnect,
    onConnectStart,
    onConnectEnd,
    addNodeFromConnect,
  } = useCanvasConnections(nodes, edges, setNodes, setEdges);

  const createProject = useCallback(() => {
    void openCanvasAfter(async () => {
      const project = await studioApi<CanvasProject>("/studio/projects", {
        method: "POST",
        body: jsonBody({ name: "未命名项目" }),
      });
      return { projectId: project.id, canvasId: project.canvases[0]!.id };
    }).catch((cause) => toast((cause as Error).message));
  }, []);

  const deleteProject = useCallback(() => {
    if (!window.confirm(`确定删除项目“${projectName}”吗？此操作无法撤销。`)) return;
    setProjectMenuOpen(false);
    if (!projectId) return;
    void studioApi(`/studio/projects/${projectId}`, { method: "DELETE" })
      .then(() => {
        toast("项目已删除", "success");
        router.push("/projects");
      })
      .catch((cause) => toast((cause as Error).message));
  }, [projectName, projectId, router]);

  /** click-outside-to-close —— 给 Agent 抽屉 / 节点库提供 ref，
     在 useClickOutside 里统一判断「pointerdown 在白名单外则关闭」。 */
  const agentDrawerRef = useRef<HTMLDivElement | null>(null);
  const agentBtnRef = useRef<HTMLButtonElement | null>(null);

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

  /** 添加基础节点（文本/图片/视频）—— 右键菜单 & 工具栏 & 节点库基础区共用 */
  const addBasicNode = useCallback(
    (kind: BasicNodeKind, position?: { x: number; y: number }) => {
      const pos = position ?? { x: 400 + Math.random() * 80, y: 320 + Math.random() * 80 };
      setNodes((ns) => [...ns, createBasicNode(kind, pos)]);
      setContextMenu(null);
    },
    [setNodes],
  );

  /** 右键显示画布操作，双击空白处直接显示添加节点列表。 */
  const [contextMenu, setContextMenu] = useState<CanvasAddMenuPosition | null>(null);
  const openCanvasAddMenu = useCallback(
    (clientX: number, clientY: number, mode: CanvasAddMenuPosition["mode"] = "add") => {
      const rect = document.querySelector(`.${styles.board}`)?.getBoundingClientRect();
      if (!rect) return;
      setContextMenu({
        x: clientX - rect.left,
        y: clientY - rect.top,
        flowPos: screenToFlowPosition({ x: clientX, y: clientY }),
        mode,
      });
      setConnectMenu(null);
    },
    [screenToFlowPosition, setConnectMenu],
  );
  const onPaneContextMenu = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      e.preventDefault();
      openCanvasAddMenu(e.clientX, e.clientY, "context");
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

  const startCanvasUpload = useCallback(() => {
    if (contextMenu) uploadPositionRef.current = contextMenu.flowPos;
    setContextMenu(null);
    canvasUploadRef.current?.click();
  }, [contextMenu]);

  const handleCanvasUpload = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      try {
        const assets = await Promise.all(Array.from(files, (file) => uploadAsset(file)));
        const base = uploadPositionRef.current;
        setNodes((current) => [
          ...current,
          ...assets.map((asset, index) => ({
            ...assetToCanvasNode(asset, current.length + index),
            position: { x: base.x + index * 24, y: base.y + index * 24 },
          })),
        ]);
        toast(`${assets.length} 个文件已上传并添加到画布`, "success");
      } catch (cause) {
        toast((cause as Error).message || "文件上传失败");
      }
    },
    [setNodes],
  );

  const saveCanvasSelectionToAssets = useCallback(async () => {
    const selected = nodes.filter((node) => node.selected);
    const payloads = selected.length
      ? selected.map(nodeAssetPayload)
      : [
          {
            name: `${projectName} · 画布`,
            kind: "file" as const,
            content: JSON.stringify({ nodes, edges, viewport: viewportState }, null, 2),
            mimeType: "application/json",
          },
        ];
    setContextMenu(null);
    try {
      await Promise.all(
        payloads.map((payload) => studioApi<Asset>("/studio/assets", { method: "POST", body: jsonBody(payload) })),
      );
      toast(selected.length ? `${payloads.length} 个节点已保存到我的资产` : "画布已保存到我的资产", "success");
    } catch (cause) {
      toast((cause as Error).message || "保存到资产失败");
    }
  }, [edges, nodes, projectName, viewportState]);

  const pasteToCanvas = useCallback(async () => {
    const position = contextMenu?.flowPos ?? { x: 400, y: 320 };
    setContextMenu(null);
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        toast("剪贴板中没有可粘贴的文字");
        return;
      }
      const node = createBasicNode("text", position);
      setNodes((current) => [...current, { ...node, data: { ...node.data, title: "粘贴文本", text } }]);
    } catch {
      toast("无法读取剪贴板，请允许浏览器访问剪贴板");
    }
  }, [contextMenu, setNodes]);

  /** 画布 Agent 与独立会话共用 API；新产物保存到资产库并作为引用加入当前画布。 */
  const submitChat = useCallback(() => {
    if (!chatInput.trim() && !chatThumb) return;
    const userText = chatInput.trim();
    setAgentMessages((ms) => [...ms, { role: "user", text: userText || "请参考附件生成内容", thumb: chatThumb }]);
    setChatInput("");
    setChatThumb(null);
    void (async () => {
      try {
        let conversationId = canvasConversationId;
        if (!conversationId) {
          const created = await studioApi<AgentConversation>("/studio/conversations", {
            method: "POST",
            body: jsonBody({ title: `${projectName} · 画布助手` }),
          });
          conversationId = created.id;
          setCanvasConversationId(created.id);
          if (projectId)
            await studioApi(`/studio/conversations/${created.id}`, { method: "PATCH", body: jsonBody({ projectId }) });
        }
        const assetIds: string[] = [];
        const selectedRef = selectedNode?.data.assetRef as { assetId?: string } | undefined;
        if (selectedRef?.assetId) assetIds.push(selectedRef.assetId);
        if (chatThumb) {
          const uploaded = await studioApi<Asset>("/studio/assets", {
            method: "POST",
            body: jsonBody({
              name: `画布附件 ${new Date().toLocaleDateString("zh-CN")}.png`,
              kind: "image",
              content: chatThumb,
              mimeType: "image/png",
            }),
          });
          assetIds.push(uploaded.id);
        }
        const result = await studioApi<{ reply: { content: string }; asset: Asset }>(
          `/studio/conversations/${conversationId}/messages`,
          { method: "POST", body: jsonBody({ content: userText || "请参考附件生成内容", assetIds }) },
        );
        setAgentMessages((messages) => [...messages, { role: "agent", text: result.reply.content }]);
        setNodes((current) => [...current, assetToCanvasNode(result.asset, current.length)]);
      } catch (cause) {
        toast((cause as Error).message || "Agent 生成失败");
      }
    })();
  }, [chatInput, chatThumb, canvasConversationId, projectName, projectId, selectedNode, setNodes]);

  /** chat 缩略上传（占位：DataURL） */
  const handleThumb = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setChatThumb(String(reader.result));
  }, []);

  const selectedNodeCount = nodes.reduce((count, node) => count + (node.selected ? 1 : 0), 0);
  const selectionHasRaisedTitle = selectionIncludesRaisedTitle(nodes);

  return (
    <EnterEditContext.Provider
      value={{
        editingId,
        editingMode,
        editingKind: editingId
          ? (((nodes.find((n) => n.id === editingId)?.data as Record<string, unknown> | undefined)?.nodeKind as
              string | undefined) ?? null)
          : null,
        buffer: editBuffer,
        setBuffer: setEditBuffer,
        enterEdit,
        focusNode,
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
        <input
          ref={canvasUploadRef}
          type="file"
          multiple
          hidden
          onChange={(event) => {
            void handleCanvasUpload(event.target.files);
            event.target.value = "";
          }}
        />
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
        <button
          className={styles.assetPanelTrigger}
          onClick={() => {
            setAssetPanelOpen((open) => !open);
            void studioApi<Asset[]>("/studio/assets")
              .then(setAvailableAssets)
              .catch(() => toast("资产加载失败"));
          }}
        >
          <FolderOpen size={14} />
          资产
        </button>
        {assetPanelOpen && (
          <aside className={styles.assetPanel}>
            <div className={styles.assetPanelHead}>
              <strong>从资产库添加</strong>
              <button onClick={() => setAssetPanelOpen(false)}>
                <X size={15} />
              </button>
            </div>
            {availableAssets.length === 0 ? (
              <p>资产库为空。可先在资产页上传文件。</p>
            ) : (
              availableAssets.map((asset) => (
                <button
                  key={asset.id}
                  className={styles.assetPanelItem}
                  onClick={() => {
                    setNodes((current) => [...current, assetToCanvasNode(asset, current.length)]);
                    setAssetPanelOpen(false);
                  }}
                >
                  <span>{asset.name}</span>
                  <small>
                    {asset.source} · {asset.kind}
                  </small>
                </button>
              ))
            )}
          </aside>
        )}
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
        {/* 图片节点编辑栏 — 由 Portal 挂到 body，屏宽 40%，距屏底 16px，水平居中对齐当前编辑节点 */}
        <ImageEditPanel />
        <TextEditPanel />
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
            onNodeDoubleClick={(event, node) => {
              event.stopPropagation();
              focusNode(node.id);
            }}
            onPaneContextMenu={onPaneContextMenu}
            onPaneClick={() => {
              setContextMenu(null);
              setConnectMenu(null);
            }}
            onMoveStart={() => {
              setContextMenu(null);
              setConnectMenu(null);
            }}
            onMoveEnd={(_, viewport) => setViewportState(viewport)}
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

          <CanvasAddMenus
            addMenu={contextMenu}
            connectMenu={connectMenu}
            pendingLineStart={pendingLineStart}
            onAddBasic={addBasicNode}
            onAddConnected={addNodeFromConnect}
            onShowAddMenu={() => setContextMenu((menu) => (menu ? { ...menu, mode: "add" } : null))}
            onUpload={startCanvasUpload}
            onSaveToAssets={() => void saveCanvasSelectionToAssets()}
            onUndo={() => {
              setContextMenu(null);
              undo();
            }}
            onRedo={() => {
              setContextMenu(null);
              redo();
            }}
            onPaste={() => void pasteToCanvas()}
            canUndo={canUndo}
            canRedo={canRedo}
          />
          {nodes.length === 0 && (
            <CanvasEmptyState
              hasRecentRun={hasRun}
              onAdd={openCanvasAddMenu}
              onLoadRecent={() => void loadFromLatest()}
            />
          )}
        </div>
      </div>
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
