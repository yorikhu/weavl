"use client";

import React from "react";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { AgentConversation, Asset, CanvasDocument, CanvasProject, RunView } from "@weavl/shared";
import styles from "./page.module.scss";
import { API } from "@/lib/env";
import { jsonBody, studioApi } from "@/lib/studioApi";
import { EnterEditContext, type EditCtx } from "./editContext";
import { ImageEditPanel, TextEditPanel, VideoEditPanel, nodeTypes } from "./components/CanvasNode";
import { CanvasViewportControls } from "./components/CanvasViewportControls";
import { CanvasSelectionToolbar } from "./components/CanvasSelectionToolbar";
import { CanvasGroupLayer } from "./components/CanvasGroupLayer";
import { edgeTypes } from "./components/CanvasEdge";
import { CanvasProjectHeader } from "./components/CanvasProjectHeader";
import { CanvasProjectToolbar } from "./components/CanvasProjectToolbar";
import { CanvasAssetDrawer } from "./components/CanvasAssetDrawer";
import { CanvasAgentDrawer } from "./components/CanvasAgentDrawer";
import { CanvasAddMenus, type CanvasAddMenuPosition } from "./components/CanvasAddMenus";
import addMenuStyles from "./components/CanvasAddMenus/index.module.scss";
import { CanvasEmptyState } from "./components/CanvasEmptyState";
import { useCanvasEditing } from "./hooks/useCanvasEditing";
import { useCanvasConnections } from "./hooks/useCanvasConnections";
import { useCanvasHistory } from "./hooks/useCanvasHistory";
import { useCanvasGroups } from "./hooks/useCanvasGroups";
import { useCanvasAssets } from "./hooks/useCanvasAssets";
import type { BasicNodeKind } from "./types/nodes";
import {
  CANVAS_CONNECTION_RADIUS,
  CANVAS_MAX_ZOOM,
  CANVAS_MIN_ZOOM,
  INITIAL_CANVAS_VIEWPORT,
} from "./constants/viewport";
import { createBasicNode } from "./utils/nodeFactory";
import { buildLatestRunGraph } from "./utils/latestRunGraph";
import {
  isPointInsideCanvasGroup,
  getNextCanvasLayer,
  markFocusedGroupMember,
  normalizeGroupedNodeSelection,
  type CanvasGroupBounds,
} from "./utils/canvasGroups";
import { getCanvasNodePointerTarget, isCanvasBackgroundTarget } from "./utils/canvasEvents";
import { getEditingNodeKind, normalizeLegacyEdges } from "./utils/nodeSelectors";
import { assetToCanvasNode } from "@/utils/assetNode";
import { openCanvasAfter } from "@/utils/openCanvas";

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
  const [canvases, setCanvases] = useState<CanvasDocument[]>([]);
  const [canvasReady, setCanvasReady] = useState(false);
  const [viewportState, setViewportState] = useState(INITIAL_CANVAS_VIEWPORT);
  const initializingRef = useRef(false);
  const savedNameRef = useRef("未命名项目");
  const [assetPanelOpen, setAssetPanelOpen] = useState(false);
  const [canvasConversationId, setCanvasConversationId] = useState<string | null>(null);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<CanvasAddMenuPosition | null>(null);
  const nodePointerGestureRef = useRef<{
    pointerId: number;
    nodeId: string;
    clientX: number;
    clientY: number;
  } | null>(null);
  const promptFallbackFrameRef = useRef<number | null>(null);
  const nodeIdsKey = nodes.map((node) => node.id).join("|");
  const { canUndo, canRedo, undo, redo } = useCanvasHistory(nodes, edges, setNodes, setEdges, canvasReady, canvasId);

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
        setNodes(normalizeGroupedNodeSelection(canvas.nodes as Node[]));
        setEdges(canvas.edges as Edge[]);
        setProjectName(project.name);
        savedNameRef.current = project.name;
        setProjectId(project.id);
        setCanvasId(canvas.id);
        setCanvases(project.canvases);
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
        if (requestedProject !== project.id || requestedCanvas !== canvas.id) {
          router.replace(`/canvas?projectId=${project.id}&canvasId=${canvas.id}`);
        }
        setCanvasReady(true);
      } catch (cause) {
        toast((cause as Error).message || "画布加载失败");
        router.replace("/projects");
      }
    })();
  }, [router, setEdges, setNodes, setViewport]);

  useEffect(() => {
    if (!canvasReady || !projectId || !canvasId) return;
    /* 节点拖动期间不启动持久化计时，松手后的稳定状态再统一保存。 */
    if (nodes.some((node) => node.dragging)) return;
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
      updateNodeInternals(nodeIdsKey ? nodeIdsKey.split("|") : []);
    });
    return () => window.cancelAnimationFrame(frame);
    // 节点集合不变时无需因拖动位置反复测量 handle。
  }, [nodeIdsKey, updateNodeInternals]);
  /** 挂载时清洗 时代 type:"bezier" 隐形边 → "default"（React Flow 无此内置类型不渲染） */
  useEffect(() => {
    setEdges(normalizeLegacyEdges);
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
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
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
  const clearCanvasSelection = useCallback(() => setSelectedNodeId(null), []);
  const {
    selection,
    focusedGroupId,
    focusedGroupMemberId,
    focusedGroupNodeIds,
    focusedGroupActionTopInset,
    clearFocusedGroup,
    clearFocusedGroupMember,
    focusGroup,
    focusGroupedNode,
    groupNodes,
    renameGroup,
    ungroupNodes,
    startMarqueeSelection,
    completeMarqueeSelection,
    startNodeDrag,
    dragNodeGroup,
    stopNodeGroupDrag,
    startBackgroundDrag,
    moveBackgroundDrag,
    stopBackgroundDrag,
    isBackgroundDragging,
  } = useCanvasGroups({ nodes, setNodes, screenToFlowPosition, onClearSelection: clearCanvasSelection });
  const {
    availableAssets,
    setAvailableAssets,
    canvasUploadRef,
    startCanvasUpload,
    handleCanvasUpload,
    saveNodesToAssets,
    selectNodeFromAssets,
    duplicateNode,
    copyNodes,
    duplicateNodesWithUpstream,
    renameNode,
    deleteNode,
    deleteNodes,
    moveNodeToCanvas,
    pasteToCanvas,
  } = useCanvasAssets({
    nodes,
    edges,
    viewport: viewportState,
    projectName,
    projectId,
    canvasId,
    canvases,
    contextMenu,
    setContextMenu,
    setNodes,
    setEdges,
    setCanvases,
  });

  const persistCurrentCanvas = useCallback(async () => {
    if (!projectId || !canvasId) return;
    const updatedAt = new Date().toISOString();
    await studioApi(`/studio/projects/${projectId}/canvases/${canvasId}`, {
      method: "PATCH",
      body: jsonBody({ nodes, edges, viewport: viewportState }),
    });
    setCanvases((current) =>
      current.map((canvas) =>
        canvas.id === canvasId ? { ...canvas, nodes, edges, viewport: viewportState, updatedAt } : canvas,
      ),
    );
    if (projectName !== savedNameRef.current) {
      await studioApi(`/studio/projects/${projectId}`, {
        method: "PATCH",
        body: jsonBody({ name: projectName.trim() || "未命名项目" }),
      });
      savedNameRef.current = projectName.trim() || "未命名项目";
    }
  }, [canvasId, edges, nodes, projectId, projectName, viewportState]);

  const activateCanvas = useCallback(
    (canvas: CanvasDocument) => {
      exitEdit();
      setSelectedNodeId(null);
      setContextMenu(null);
      setNodes(normalizeGroupedNodeSelection(canvas.nodes as Node[]));
      setEdges(canvas.edges as Edge[]);
      setViewportState(canvas.viewport);
      void setViewport(canvas.viewport);
      setCanvasId(canvas.id);
      if (projectId) router.replace(`/canvas?projectId=${projectId}&canvasId=${canvas.id}`);
      window.requestAnimationFrame(() => setCanvasReady(true));
    },
    [exitEdit, projectId, router, setEdges, setNodes, setViewport],
  );

  const switchCanvas = useCallback(
    async (canvas: CanvasDocument) => {
      if (canvas.id === canvasId || !canvasReady) return;
      setCanvasReady(false);
      try {
        await persistCurrentCanvas();
        activateCanvas(canvas);
      } catch (cause) {
        setCanvasReady(true);
        toast((cause as Error).message || "画布切换失败");
      }
    },
    [activateCanvas, canvasId, canvasReady, persistCurrentCanvas],
  );

  const createCanvas = useCallback(
    async (requestedName?: string) => {
      if (!projectId || !canvasReady) return;
      const name = requestedName?.trim() || `画布 ${canvases.length + 1}`;
      setCanvasReady(false);
      try {
        await persistCurrentCanvas();
        const canvas = await studioApi<CanvasDocument>(`/studio/projects/${projectId}/canvases`, {
          method: "POST",
          body: jsonBody({ name }),
        });
        setCanvases((current) => [...current, canvas]);
        activateCanvas(canvas);
        toast(`已新建“${canvas.name}”`, "success");
      } catch (cause) {
        setCanvasReady(true);
        toast((cause as Error).message || "新建画布失败");
      }
    },
    [activateCanvas, canvasReady, canvases.length, persistCurrentCanvas, projectId],
  );

  const renameCanvas = useCallback(
    async (canvas: CanvasDocument, name: string) => {
      if (!projectId) throw new Error("项目尚未加载");
      try {
        const updated = await studioApi<CanvasDocument>(`/studio/projects/${projectId}/canvases/${canvas.id}`, {
          method: "PATCH",
          body: jsonBody({ name }),
        });
        setCanvases((current) => current.map((item) => (item.id === canvas.id ? updated : item)));
        toast(`已重命名为“${updated.name}”`, "success");
      } catch (cause) {
        toast((cause as Error).message || "画布重命名失败");
        throw cause;
      }
    },
    [projectId],
  );

  const deleteCanvas = useCallback(
    async (canvas: CanvasDocument) => {
      if (!projectId) throw new Error("项目尚未加载");
      const remainingCanvases = canvases.filter((item) => item.id !== canvas.id);
      if (!remainingCanvases.length) throw new Error("项目至少需要保留一张画布");
      const deletingCurrentCanvas = canvas.id === canvasId;
      if (deletingCurrentCanvas) setCanvasReady(false);
      try {
        await studioApi(`/studio/projects/${projectId}/canvases/${canvas.id}`, { method: "DELETE" });
        setCanvases(remainingCanvases);
        if (deletingCurrentCanvas) activateCanvas(remainingCanvases[0]!);
        toast(`已删除“${canvas.name}”`, "success");
      } catch (cause) {
        if (deletingCurrentCanvas) setCanvasReady(true);
        toast((cause as Error).message || "画布删除失败");
        throw cause;
      }
    },
    [activateCanvas, canvasId, canvases, projectId],
  );
  const {
    connectMenu,
    setConnectMenu,
    pendingLineStarts,
    isValidConnection,
    onConnect,
    onConnectStart,
    onConnectEnd,
    addNodeFromConnect,
    addEdgesDedup,
    openBatchConnectMenu,
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

  /** 只保存稳定 ID，避免拖动时因节点对象每帧变化而产生第二次页面更新。 */
  const onSelectionChange = useCallback(
    ({ nodes: sel }: { nodes: Node[] }) => {
      setSelectedNodeId(sel[0]?.id ?? null);
      if (sel.length) clearFocusedGroup();
    },
    [clearFocusedGroup],
  );

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
  /* 仅关闭 Portal 中的右键菜单；监听器不拦截事件，左键 Popover 仍会正常收到同一次点击。 */
  useClickOutside(Boolean(contextMenu), [`.${addMenuStyles.portalMenu}`], () => setContextMenu(null));

  /** 添加基础节点（文本/图片/视频）—— 右键菜单 & 工具栏 & 节点库基础区共用 */
  const addBasicNode = useCallback(
    (kind: BasicNodeKind, position?: { x: number; y: number }) => {
      const pos = position ?? { x: 400 + Math.random() * 80, y: 320 + Math.random() * 80 };
      setNodes((ns) => [...ns, createBasicNode(kind, pos, false, ns)]);
      setContextMenu(null);
    },
    [setNodes],
  );

  /** 右键显示画布操作，双击空白处直接显示添加节点列表。 */
  const openCanvasAddMenu = useCallback(
    (clientX: number, clientY: number, mode: CanvasAddMenuPosition["mode"] = "add", nodeIds?: string[]) => {
      const rect = document.querySelector(`.${styles.board}`)?.getBoundingClientRect();
      if (!rect) return;
      setContextMenu({
        x: clientX - rect.left,
        y: clientY - rect.top,
        flowPos: screenToFlowPosition({ x: clientX, y: clientY }),
        clientPos: { x: clientX, y: clientY },
        mode,
        nodeIds,
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
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      event.stopPropagation();
      exitEdit();
      focusGroupedNode(node.id);
      openCanvasAddMenu(event.clientX, event.clientY, "node", [node.id]);
    },
    [exitEdit, focusGroupedNode, openCanvasAddMenu],
  );
  const onGroupContextMenu = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, group: CanvasGroupBounds) => {
      event.preventDefault();
      event.stopPropagation();
      focusGroup(group.id);
      openCanvasAddMenu(
        event.clientX,
        event.clientY,
        "node",
        group.members.map((member) => member.id),
      );
    },
    [focusGroup, openCanvasAddMenu],
  );
  const onBoardDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isCanvasBackgroundTarget(e.target, addMenuStyles.contextMenu)) return;
      const flowPoint = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      if (isPointInsideCanvasGroup(nodes, flowPoint)) return;
      e.preventDefault();
      e.stopPropagation();
      openCanvasAddMenu(e.clientX, e.clientY);
    },
    [nodes, openCanvasAddMenu, screenToFlowPosition],
  );

  /** 画布 Agent 与独立会话共用 API；新产物只加入当前画布，用户可再手动保存到全局资产。 */
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
        const selectedRef = nodes.find((node) => node.id === selectedNodeId)?.data.assetRef as
          { assetId?: string } | undefined;
        if (selectedRef?.assetId) assetIds.push(selectedRef.assetId);
        if (chatThumb) {
          const uploaded = await studioApi<Asset>("/studio/assets", {
            method: "POST",
            body: jsonBody({
              name: `画布附件 ${new Date().toLocaleDateString("zh-CN")}.png`,
              kind: "image",
              content: chatThumb,
              mimeType: "image/png",
              inLibrary: false,
            }),
          });
          assetIds.push(uploaded.id);
        }
        const result = await studioApi<{ reply: { content: string }; asset: Asset }>(
          `/studio/conversations/${conversationId}/messages`,
          { method: "POST", body: jsonBody({ content: userText || "请参考附件生成内容", assetIds }) },
        );
        setAgentMessages((messages) => [...messages, { role: "agent", text: result.reply.content }]);
        setNodes((current) => [
          ...current,
          { ...assetToCanvasNode(result.asset, current.length), zIndex: getNextCanvasLayer(current) },
        ]);
      } catch (cause) {
        toast((cause as Error).message || "Agent 生成失败");
      }
    })();
  }, [chatInput, chatThumb, canvasConversationId, projectName, projectId, selectedNodeId, nodes, setNodes]);

  /** chat 缩略上传（占位：DataURL） */
  const handleThumb = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setChatThumb(String(reader.result));
  }, []);

  const { selectedNodeCount, selectedNodeIds, selectedGroupId, insets: selectionInsets, actionTopInset } = selection;
  const editingKind = getEditingNodeKind(nodes, editingId);
  /** 组成员聚焦是独立交互状态，不能依赖 React Flow 对不可选节点的 selected 清理逻辑。 */
  const renderedNodes = useMemo(
    () => markFocusedGroupMember(nodes, focusedGroupMemberId),
    [focusedGroupMemberId, nodes],
  );
  const editContextValue: EditCtx = {
    editingId,
    editingMode,
    editingKind,
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
  };
  const editingIdRef = useRef(editingId);
  editingIdRef.current = editingId;
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const openNodePrompt = useCallback(
    (nodeId: string) => {
      const node = nodesRef.current.find((item) => item.id === nodeId);
      const data = node?.data as Record<string, unknown> | undefined;
      if (!data) return;
      if (data.nodeKind === "image" || data.nodeKind === "video") {
        enterEdit(nodeId);
        return;
      }
      const hasText = typeof data.text === "string" && Boolean(data.text.trim());
      if (data.nodeKind === "text" && !hasText && data.creationMode !== "manual") enterEdit(nodeId, "generate");
    },
    [enterEdit],
  );
  const handleBoardPointerDownCapture = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button === 0) {
        const nodeId = getCanvasNodePointerTarget(event.target);
        if (nodeId) {
          if (promptFallbackFrameRef.current !== null) cancelAnimationFrame(promptFallbackFrameRef.current);
          promptFallbackFrameRef.current = null;
          nodePointerGestureRef.current = {
            pointerId: event.pointerId,
            nodeId,
            clientX: event.clientX,
            clientY: event.clientY,
          };
          focusGroupedNode(nodeId);
        } else {
          nodePointerGestureRef.current = null;
        }
      }
      startBackgroundDrag(event);
    },
    [focusGroupedNode, startBackgroundDrag],
  );
  const handleBoardPointerUpCapture = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const gesture = nodePointerGestureRef.current;
      nodePointerGestureRef.current = null;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      if (Math.hypot(event.clientX - gesture.clientX, event.clientY - gesture.clientY) > 4) return;
      const nodeId = gesture.nodeId;
      promptFallbackFrameRef.current = requestAnimationFrame(() => {
        promptFallbackFrameRef.current = null;
        if (editingIdRef.current !== nodeId) openNodePrompt(nodeId);
      });
    },
    [openNodePrompt],
  );
  const clearNodePointerGesture = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (nodePointerGestureRef.current?.pointerId === event.pointerId) nodePointerGestureRef.current = null;
  }, []);

  useEffect(
    () => () => {
      if (promptFallbackFrameRef.current !== null) cancelAnimationFrame(promptFallbackFrameRef.current);
    },
    [],
  );

  return (
    <EnterEditContext.Provider value={editContextValue}>
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
          toolbar={
            !assetPanelOpen ? (
              <CanvasProjectToolbar
                projectName={projectName}
                onProjectNameChange={setProjectName}
                projectMenuOpen={projectMenuOpen}
                onProjectMenuOpenChange={setProjectMenuOpen}
                onHome={() => router.push("/home")}
                onProjects={() => router.push("/projects")}
                onCreateProject={createProject}
                onDeleteProject={deleteProject}
                canvases={canvases}
                currentCanvasId={canvasId}
                onSelectCanvas={(canvas) => void switchCanvas(canvas)}
                onCreateCanvas={(name) => void createCanvas(name)}
                onRenameCanvas={renameCanvas}
                onDeleteCanvas={deleteCanvas}
              />
            ) : undefined
          }
          agentOpen={agentOpen}
          onToggleAgent={() => setAgentOpen((open) => !open)}
          agentButtonRef={agentBtnRef}
        />
        <CanvasAssetDrawer
          open={assetPanelOpen}
          header={
            <CanvasProjectToolbar
              variant="drawer"
              projectName={projectName}
              onProjectNameChange={setProjectName}
              projectMenuOpen={projectMenuOpen}
              onProjectMenuOpenChange={setProjectMenuOpen}
              onHome={() => router.push("/home")}
              onProjects={() => router.push("/projects")}
              onCreateProject={createProject}
              onDeleteProject={deleteProject}
              canvases={canvases}
              currentCanvasId={canvasId}
              onSelectCanvas={(canvas) => void switchCanvas(canvas)}
              onCreateCanvas={(name) => void createCanvas(name)}
              onRenameCanvas={renameCanvas}
              onDeleteCanvas={deleteCanvas}
            />
          }
          nodes={nodes}
          assets={availableAssets}
          canvases={canvases}
          currentCanvasId={canvasId}
          onClose={() => setAssetPanelOpen(false)}
          onSelectNode={selectNodeFromAssets}
          onLocateNode={(nodeId) =>
            focusNode(nodeId, { leftInset: Math.max(0, Math.min(360, window.innerWidth - 220)) })
          }
          onAddAsset={(asset) =>
            setNodes((current) => [
              ...current,
              { ...assetToCanvasNode(asset, current.length), zIndex: getNextCanvasLayer(current) },
            ])
          }
          onAssetAdded={(asset) =>
            setAvailableAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)])
          }
          onAssetUpdated={(asset) =>
            setAvailableAssets((current) => current.map((item) => (item.id === asset.id ? asset : item)))
          }
          onAssetRemoved={(assetId) => setAvailableAssets((current) => current.filter((asset) => asset.id !== assetId))}
          onDuplicateNode={duplicateNode}
          onMoveNode={moveNodeToCanvas}
          onRenameNode={renameNode}
          onDeleteNode={deleteNode}
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
        {/* 图片节点编辑栏 — 由 Portal 挂到 body，屏宽 40%，距屏底 16px，水平居中对齐当前编辑节点 */}
        <ImageEditPanel />
        <TextEditPanel />
        {/* 视频节点编辑栏 — 同款外置方案 + 5 chip + 视频字段 */}
        <VideoEditPanel />

        {/* 画布主区 */}
        <div
          className={styles.board}
          onDoubleClick={onBoardDoubleClick}
          onPointerDownCapture={handleBoardPointerDownCapture}
          onPointerMoveCapture={(event) => {
            if (!isBackgroundDragging()) return;
            event.preventDefault();
            event.stopPropagation();
            moveBackgroundDrag(event);
          }}
          onPointerUpCapture={(event) => {
            handleBoardPointerUpCapture(event);
            stopBackgroundDrag(event);
          }}
          onPointerCancelCapture={(event) => {
            clearNodePointerGesture(event);
            stopBackgroundDrag(event);
          }}
        >
          <ReactFlow
            nodes={renderedNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onSelectionChange={onSelectionChange}
            onSelectionStart={startMarqueeSelection}
            onSelectionEnd={completeMarqueeSelection}
            onNodeDragStart={(_, node) => startNodeDrag(node)}
            onNodeDrag={(_, node) => dragNodeGroup(node)}
            onNodeDragStop={stopNodeGroupDrag}
            onNodeClick={(_, node) => focusGroupedNode(node.id)}
            onNodeDoubleClick={(event, node) => {
              event.stopPropagation();
              focusNode(node.id);
            }}
            onNodeContextMenu={onNodeContextMenu}
            onPaneContextMenu={onPaneContextMenu}
            onPaneClick={() => {
              setContextMenu(null);
              setConnectMenu(null);
              clearFocusedGroup();
              clearFocusedGroupMember();
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
            edgeTypes={edgeTypes}
            /** 默认箭头框选；按住空格才允许鼠标拖动画布。 */
            panOnDrag={false}
            panActivationKeyCode="Space"
            selectionOnDrag
            selectionKeyCode={null}
            selectionMode={SelectionMode.Partial}
            multiSelectionKeyCode={null}
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
            className={`${styles.flowRoot} ${selectedNodeCount > 1 ? (styles.hasMultiSelection ?? "") : ""} ${selectedGroupId ? (styles.groupSelected ?? "") : ""} ${focusedGroupMemberId ? (styles.groupMemberFocused ?? "") : ""}`}
            style={
              {
                "--canvas-selection-top-inset": `${selectionInsets.top}px`,
                "--canvas-selection-right-inset": `${selectionInsets.right}px`,
                "--canvas-selection-bottom-inset": `${selectionInsets.bottom}px`,
                "--canvas-selection-left-inset": `${selectionInsets.left}px`,
              } as React.CSSProperties
            }
          >
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} className={styles.bg} />
            <CanvasGroupLayer
              focusedGroupId={focusedGroupId}
              selectedNodeIds={selectedNodeIds}
              selectedGroupId={selectedGroupId}
              selectionInsets={selectionInsets}
              pendingBatchSourceIds={connectMenu?.sourceNodeIds}
              onRenameGroup={renameGroup}
              onGroupContextMenu={onGroupContextMenu}
              onBatchConnect={addEdgesDedup}
              onBatchCreate={openBatchConnectMenu}
            />
            <CanvasSelectionToolbar
              nodeIds={selectedNodeIds}
              topInset={actionTopInset}
              groupId={selectedGroupId}
              onGroup={groupNodes}
              onUngroup={ungroupNodes}
            />
            {focusedGroupId && (
              <CanvasSelectionToolbar
                nodeIds={focusedGroupNodeIds}
                topInset={focusedGroupActionTopInset}
                groupId={focusedGroupId}
                onGroup={groupNodes}
                onUngroup={ungroupNodes}
              />
            )}
            <MiniMap pannable zoomable className={styles.minimap} maskColor="rgba(13, 13, 15, 0.7)" />
          </ReactFlow>

          <CanvasViewportControls
            assetOpen={assetPanelOpen}
            onToggleAssets={() => {
              setProjectMenuOpen(false);
              setAssetPanelOpen((open) => !open);
              void studioApi<Asset[]>("/studio/assets")
                .then(setAvailableAssets)
                .catch(() => toast("资产加载失败"));
            }}
          />

          <CanvasAddMenus
            addMenu={contextMenu}
            connectMenu={connectMenu}
            pendingLineStarts={pendingLineStarts}
            onAddBasic={addBasicNode}
            onAddConnected={addNodeFromConnect}
            onShowAddMenu={() => setContextMenu((menu) => (menu ? { ...menu, mode: "add" } : null))}
            onUpload={startCanvasUpload}
            onSaveToAssets={() => void saveNodesToAssets()}
            onSaveNodeToAssets={(nodeIds) => void saveNodesToAssets(nodeIds)}
            onCopyNode={copyNodes}
            onDuplicateNode={duplicateNodesWithUpstream}
            onDeleteNode={deleteNodes}
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
