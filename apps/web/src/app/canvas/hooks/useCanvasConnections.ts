import { useCallback, useEffect, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useReactFlow, type Connection, type Edge, type Node } from "@xyflow/react";
import type { BasicNodeKind } from "../types/nodes";
import { createBasicNode } from "../utils/nodeFactory";
import styles from "../page.module.scss";
import nodeStyles from "../components/CanvasNode/index.module.scss";

const HANDLE_VISUAL_OFFSET = 15;
const HANDLE_MAGNET_RADIUS = 40;

function getHandleDistance(handle: HTMLElement, pointerX: number, pointerY: number) {
  const rect = handle.getBoundingClientRect();
  const scale = handle.offsetWidth > 0 ? rect.width / handle.offsetWidth : 1;
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const isLeft = handle.classList.contains("react-flow__handle-left");
  const surface = handle.closest(".react-flow__node")?.querySelector<HTMLElement>("[data-canvas-node-surface]");
  const surfaceRect = surface?.getBoundingClientRect();

  /* 吸附区只存在于卡片左右外侧；指针进入卡片内部后立即失效。 */
  if (surfaceRect && (isLeft ? pointerX >= surfaceRect.left : pointerX <= surfaceRect.right)) return null;

  const visualOffsetX = (isLeft ? -HANDLE_VISUAL_OFFSET : HANDLE_VISUAL_OFFSET) * safeScale;
  const screenDx = pointerX - (rect.left + rect.width / 2 + visualOffsetX);
  const screenDy = pointerY - (rect.top + rect.height / 2);
  return { safeScale, screenDx, screenDy, distanceSq: screenDx * screenDx + screenDy * screenDy };
}

/** 连线、磁吸、目标预览与拖线到空白处新建节点的交互。 */
export function useCanvasConnections(
  nodes: Node[],
  edges: Edge[],
  setNodes: Dispatch<SetStateAction<Node[]>>,
  setEdges: Dispatch<SetStateAction<Edge[]>>,
) {
  const { screenToFlowPosition } = useReactFlow();
  const connectionSourceActiveClass = nodeStyles.connectionSourceActive ?? "connection-source-active";
  /** 从 source handle 拖出连线时记录起始节点，松手时若在空白处 → 创建新节点 + 连线 */
  const connectStartRef = useRef<{ nodeId: string | null; clientX: number; clientY: number }>({
    nodeId: null,
    clientX: 0,
    clientY: 0,
  });
  /** 标记当前这次拖线是否已由 React Flow 成功连接，防止 onConnectEnd 再按画布空白处理。 */
  const connectSucceededRef = useRef(false);
  const pointerRef = useRef({ x: 0, y: 0 });
  /** 连接已存在节点 —— source handle 拖到 target handle 直接建边
     校验必须落在 target handle 上才建边（避免松手在任意节点上误连） */
  const isValidConnection = useCallback(
    (connection: {
      source?: string | null;
      target?: string | null;
      sourceHandle?: string | null;
      targetHandle?: string | null;
    }) => {
      if (!connection.target || !connection.source || connection.target === connection.source) return false;
      const targetHandle = document.querySelector<HTMLElement>(
        `.react-flow__node[data-id="${connection.target}"] .${nodeStyles.cardHandle}.react-flow__handle-left`,
      );
      if (!targetHandle) return false;
      const distance = getHandleDistance(targetHandle, pointerRef.current.x, pointerRef.current.y);
      const duplicate = edges.some(
        (edge) =>
          (edge.source === connection.source && edge.target === connection.target) ||
          (edge.source === connection.target && edge.target === connection.source),
      );
      return Boolean(distance && distance.distanceSq <= HANDLE_MAGNET_RADIUS ** 2 && !duplicate);
    },
    [edges],
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
      return newEdgeId;
    },
    [setEdges],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target) return;
      connectSucceededRef.current = true;
      setConnectMenu(null);
      addEdgeDedup(connection.source, connection.target);
    },
    [addEdgeDedup],
  );

  /** 从 source handle 开始拖线 —— 记录起始节点 + 起始坐标 */
  const onConnectStart = useCallback(
    (_: unknown, params: { nodeId: string | null; handleId: string | null; handleType: string | null }) => {
      if (params.handleType !== "source") return;
      connectStartRef.current = { nodeId: params.nodeId, clientX: 0, clientY: 0 };
      connectSucceededRef.current = false;
      if (params.nodeId) {
        document
          .querySelector<HTMLElement>(`.react-flow__node[data-id="${params.nodeId}"]`)
          ?.classList.add(connectionSourceActiveClass);
      }
      /** 开始拖线，重置 hover/preview/error 状态 */
      setHoverTargetId(null);
      setPreviewState(null);
    },
    [connectionSourceActiveClass],
  );

  /** 拖线连接状态：可连接时强调边框，重复连接时覆盖蒙层。 */
  const [connectMenu, setConnectMenu] = useState<{
    sourceNodeId: string;
    flowPos: { x: number; y: number };
    clientPos: { x: number; y: number };
  } | null>(null);
  const [pendingLineStart, setPendingLineStart] = useState<{ x: number; y: number } | null>(null);
  /** 拖线中悬停的目标节点（用来高亮） */
  const [hoverTargetId, setHoverTargetId] = useState<string | null>(null);
  /** 拖线中是否在合法位置上 —— true: 可连 / false: 不可连 / null: 拖到 pane */
  const [previewState, setPreviewState] = useState<"connectable" | "blocked" | null>(null);

  /** 鼠标靠近 handle 时，让最近的圆点显现并跟随指针。 */
  useEffect(() => {
    const board = document.querySelector(`.${styles.board}`);
    const handleMagnetClass = nodeStyles.handleMagnetActive;
    if (!board || !handleMagnetClass) return;
    let activeHandle: HTMLElement | null = null;
    let animationFrameId: number | null = null;
    let pointerX = 0;
    let pointerY = 0;

    const resetHandle = (handle: HTMLElement) => {
      handle.classList.remove(handleMagnetClass);
      handle.style.removeProperty("--handle-pull-x");
      handle.style.removeProperty("--handle-pull-y");
      handle.style.removeProperty("--handle-hit-size");
    };

    const updateNearestHandle = () => {
      animationFrameId = null;
      const handles = board.querySelectorAll<HTMLElement>(`.${nodeStyles.cardHandle}`);
      const selectedNodes = board.querySelectorAll(".react-flow__node.selected");
      const multiSelectionActive = selectedNodes.length > 1;
      let nearest: {
        handle: HTMLElement;
        pullX: number;
        pullY: number;
        hitSize: number;
        distanceSq: number;
      } | null = null;

      /* 先集中读取布局，避免在循环里交替读写样式导致强制同步布局。 */
      for (const handle of handles) {
        if (multiSelectionActive && handle.closest(".react-flow__node.selected")) continue;
        /* 拖线开始后源节点不再参与磁吸，避免位移复位时圆球短暂闪回锚点。 */
        if (handle.classList.contains("connectingfrom") || handle.closest(`.${connectionSourceActiveClass}`)) {
          continue;
        }
        /* 拖线期间只允许左侧 target 圆球参与吸附。 */
        if (connectStartRef.current.nodeId && !handle.classList.contains("react-flow__handle-left")) continue;
        const distance = getHandleDistance(handle, pointerX, pointerY);
        if (
          distance &&
          distance.distanceSq <= HANDLE_MAGNET_RADIUS ** 2 &&
          (!nearest || distance.distanceSq < nearest.distanceSq)
        ) {
          nearest = {
            handle,
            pullX: distance.screenDx / distance.safeScale,
            pullY: distance.screenDy / distance.safeScale,
            /* 反算画布缩放，使外侧命中区始终保持 80px 直径。 */
            hitSize: (HANDLE_MAGNET_RADIUS * 2) / distance.safeScale,
            distanceSq: distance.distanceSq,
          };
        }
      }

      if (activeHandle !== nearest?.handle) {
        if (activeHandle) resetHandle(activeHandle);
        activeHandle = nearest?.handle ?? null;
        if (activeHandle) {
          activeHandle.classList.add(handleMagnetClass);
          /* 先提交圆球原位样式，再写入位移，让吸附呈现一次极短滑动。 */
          void activeHandle.offsetWidth;
        }
      }
      if (!nearest) return;
      /* 换算回画布坐标，保证任意缩放比例下圆心都落在鼠标正下方。 */
      nearest.handle.style.setProperty("--handle-pull-x", `${nearest.pullX}px`);
      nearest.handle.style.setProperty("--handle-pull-y", `${nearest.pullY}px`);
      nearest.handle.style.setProperty("--handle-hit-size", `${nearest.hitSize}px`);
    };

    const onPointerMove = (event: Event) => {
      const pointer = event as PointerEvent;
      const boardRect = board.getBoundingClientRect();
      if (
        pointer.clientX < boardRect.left ||
        pointer.clientX > boardRect.right ||
        pointer.clientY < boardRect.top ||
        pointer.clientY > boardRect.bottom
      ) {
        onPointerLeave();
        return;
      }
      pointerX = pointer.clientX;
      pointerY = pointer.clientY;
      pointerRef.current = { x: pointerX, y: pointerY };
      if (animationFrameId === null) {
        animationFrameId = window.requestAnimationFrame(updateNearestHandle);
      }
    };
    const onPointerLeave = () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      if (activeHandle) {
        resetHandle(activeHandle);
        activeHandle = null;
      }
    };
    /* 捕获阶段监听，保证指针位于 React Flow 连接线之上时仍能更新圆球吸附。 */
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("blur", onPointerLeave);
    return () => {
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("blur", onPointerLeave);
      onPointerLeave();
    };
  }, [connectionSourceActiveClass]);

  /** 菜单出现后计算源节点右侧 handle，临时连线从这里接到菜单左边缘。 */
  useLayoutEffect(() => {
    if (!connectMenu) {
      setPendingLineStart(null);
      return;
    }
    const board = document.querySelector(`.${styles.board}`) as HTMLElement | null;
    const sourceNode = document.querySelector(
      `.react-flow__node[data-id="${connectMenu.sourceNodeId}"]`,
    ) as HTMLElement | null;
    const sourceHandle = sourceNode?.querySelector(".react-flow__handle-right") as HTMLElement | null;
    if (!board || !sourceNode || !sourceHandle) return;
    const boardRect = board.getBoundingClientRect();
    const nodeRect = sourceNode.getBoundingClientRect();
    const handleRect = sourceHandle.getBoundingClientRect();
    setPendingLineStart({
      /* 临时虚线从卡片外轮廓起笔，不复用压进卡片内部的正式边锚点。 */
      x: nodeRect.right - boardRect.left,
      y: handleRect.top + handleRect.height / 2 - boardRect.top,
    });
  }, [connectMenu, nodes]);

  /** 判断某节点是否可作为连线目标（用于 hover 状态判定） */
  const isValidTarget = useCallback(
    (targetId: string, sourceId = connectStartRef.current.nodeId): boolean => {
      if (!sourceId || targetId === sourceId) return false;
      /** 重复边校验 */
      const dup = edges.some(
        (e) => (e.source === sourceId && e.target === targetId) || (e.source === targetId && e.target === sourceId),
      );
      return !dup;
    },
    [edges],
  );

  /** 外侧连接点负责磁吸，卡片本体只负责目标视觉反馈。 */
  useEffect(() => {
    const board = document.querySelector(`.${styles.board}`);
    if (!board) return;
    const onPointerMove = (event: Event) => {
      if (!connectStartRef.current.nodeId) return;
      const pointer = event as PointerEvent;
      const boardRect = board.getBoundingClientRect();
      if (
        pointer.clientX < boardRect.left ||
        pointer.clientX > boardRect.right ||
        pointer.clientY < boardRect.top ||
        pointer.clientY > boardRect.bottom
      ) {
        clearTarget();
        return;
      }
      let nearest: { id: string; distanceSq: number } | null = null;
      const handles = board.querySelectorAll<HTMLElement>(`.${nodeStyles.cardHandle}.react-flow__handle-left`);
      for (const handle of handles) {
        const nodeId = handle.closest<HTMLElement>(".react-flow__node")?.dataset.id;
        if (!nodeId || nodeId === connectStartRef.current.nodeId) continue;
        const distance = getHandleDistance(handle, pointer.clientX, pointer.clientY);
        if (
          distance &&
          distance.distanceSq <= HANDLE_MAGNET_RADIUS ** 2 &&
          (!nearest || distance.distanceSq < nearest.distanceSq)
        ) {
          nearest = { id: nodeId, distanceSq: distance.distanceSq };
        }
      }

      const nodeUnderPointer = document
        .elementsFromPoint(pointer.clientX, pointer.clientY)
        .map((element) => element.closest<HTMLElement>(".react-flow__node"))
        .find((element) => Boolean(element?.dataset.id && element.dataset.id !== connectStartRef.current.nodeId));
      const targetId = nearest?.id ?? nodeUnderPointer?.dataset.id;

      if (targetId) {
        setHoverTargetId(targetId);
        setPreviewState(isValidTarget(targetId) ? "connectable" : "blocked");
      } else {
        setHoverTargetId(null);
        setPreviewState(null);
      }
    };
    const clearTarget = () => {
      setHoverTargetId(null);
      setPreviewState(null);
    };
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("blur", clearTarget);
    return () => {
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("blur", clearTarget);
    };
  }, [isValidTarget]);

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
      const didConnect = connectSucceededRef.current;
      if (start.nodeId) {
        document
          .querySelector<HTMLElement>(`.react-flow__node[data-id="${start.nodeId}"]`)
          ?.classList.remove(connectionSourceActiveClass);
      }
      connectStartRef.current = { nodeId: null, clientX: 0, clientY: 0 };
      connectSucceededRef.current = false;
      const wasHoverId = hoverTargetId;
      const wasPreview = previewState;
      /** 拖线结束，重置目标预览状态。 */
      setHoverTargetId(null);
      setPreviewState(null);
      /* onConnect 已经完成本次连接时，不能再根据松手 DOM 位置弹出创建菜单。 */
      if (!start.nodeId || didConnect) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const isTouch = "touches" in event;
      const clientX = isTouch ? (event.changedTouches?.[0]?.clientX ?? 0) : (event as MouseEvent).clientX;
      const clientY = isTouch ? (event.changedTouches?.[0]?.clientY ?? 0) : (event as MouseEvent).clientY;

      /** 根据 previewState 决定行为 */
      if (wasPreview === "blocked" && wasHoverId) {
        return;
      }
      if (wasPreview === "connectable" && wasHoverId) {
        /** 可连：直接连接并保留线条绘制动画。 */
        addEdgeDedup(start.nodeId!, wasHoverId);
        return;
      }

      /* 卡片内部不参与磁吸动画，但松手落在卡片上仍可直接连接。 */
      const droppedNode = document
        .elementFromPoint(clientX, clientY)
        ?.closest<HTMLElement>(".react-flow__node");
      const droppedNodeId = droppedNode?.dataset.id;
      if (droppedNodeId && droppedNodeId !== start.nodeId) {
        /* connectStartRef 已清理，使用本次结束事件保存下来的源节点校验。 */
        const validity = isValidTarget(droppedNodeId, start.nodeId);
        if (validity) {
          addEdgeDedup(start.nodeId, droppedNodeId);
        }
        return;
      }
      if (droppedNodeId === start.nodeId) return;

      /** 落在 pane 上 → 弹菜单让用户挑新建节点类型 */
      const flowPos = screenToFlowPosition({ x: clientX, y: clientY });
      const boardRect = (
        target.closest(`.${styles.board}`) ?? document.querySelector(`.${styles.board}`)
      )?.getBoundingClientRect();
      const localX = clientX - (boardRect?.left ?? 0);
      const localY = clientY - (boardRect?.top ?? 0);
      setConnectMenu({
        sourceNodeId: start.nodeId,
        flowPos,
        clientPos: {
          x: Math.max(8, Math.min(localX + 14, (boardRect?.width ?? localX + 242) - 228)),
          y: Math.max(8, Math.min(localY - 20, (boardRect?.height ?? localY + 360) - 352)),
        },
      });
    },
    [
      screenToFlowPosition,
      hoverTargetId,
      previewState,
      addEdgeDedup,
      isValidTarget,
      connectionSourceActiveClass,
    ],
  );

  /** 从「引用该节点生成」菜单中挑一个类型创建节点并连线 */
  const addNodeFromConnect = useCallback(
    (kind: BasicNodeKind) => {
      if (!connectMenu) return;
      const { flowPos, sourceNodeId } = connectMenu;
      const newNode = createBasicNode(kind, { x: flowPos.x, y: flowPos.y - 60 }, true);
      setNodes((ns) => [...ns, newNode]);
      setEdges((es) => [
        ...es,
        {
          id: `e_${Date.now()}`,
          source: sourceNodeId,
          target: newNode.id,
          type: "default",
          style: { stroke: "#7f7f86", strokeWidth: 1.6 },
        },
      ]);
      setConnectMenu(null);
    },
    [connectMenu, setNodes, setEdges],
  );
  return {
    connectMenu,
    setConnectMenu,
    pendingLineStart,
    isValidConnection,
    onConnect,
    onConnectStart,
    onConnectEnd,
    addNodeFromConnect,
  };
}
