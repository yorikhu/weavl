import { useCallback, useEffect, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useReactFlow, type Connection, type Edge, type Node } from "@xyflow/react";
import type { BasicNodeKind } from "../types/nodes";
import { CANVAS_HANDLE_MAGNET_RADIUS } from "../constants/viewport";
import { createBasicNode } from "../utils/nodeFactory";
import { inheritSharedSourceGroup } from "../utils/canvasGroups";
import {
  getCardHandleDistance,
  getCenteredHandleDistance,
  isCanvasMovePointerTarget,
  isCardHandleExposed,
  isCardHandleInteractive,
} from "../utils/handleMagnet";
import styles from "../page.module.scss";
import nodeStyles from "../components/CanvasNode/index.module.scss";

/**
 * 管理连线、连接点磁吸、目标预览与拖线到空白处新建节点的交互。
 * 所有磁吸距离均在屏幕坐标中计算，避免画布缩放改变实际操作热区。
 *
 * @param nodes - 当前画布节点。
 * @param edges - 当前画布连线。
 * @param setNodes - React Flow 节点状态更新器。
 * @param setEdges - React Flow 连线状态更新器。
 * @returns React Flow 事件处理器、连线菜单状态和批量连线方法。
 */
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
      const distance = getCardHandleDistance(targetHandle, pointerRef.current.x, pointerRef.current.y);
      const duplicate = edges.some(
        (edge) =>
          (edge.source === connection.source && edge.target === connection.target) ||
          (edge.source === connection.target && edge.target === connection.source),
      );
      return Boolean(
        distance &&
        distance.distanceSq <= CANVAS_HANDLE_MAGNET_RADIUS ** 2 &&
        isCardHandleExposed(targetHandle) &&
        !duplicate,
      );
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

  /** 将多个源节点一次连接到同一目标；已有连接和目标自身会被跳过。 */
  const addEdgesDedup = useCallback(
    (sourceIds: string[], target: string) => {
      const additions = [...new Set(sourceIds)]
        .filter(
          (source) =>
            source !== target &&
            !edges.some(
              (edge) =>
                (edge.source === source && edge.target === target) ||
                (edge.source === target && edge.target === source),
            ),
        )
        .map(
          (source) =>
            ({
              id: `e_${crypto.randomUUID()}`,
              source,
              target,
              type: "default",
              className: "success-draw",
              style: { stroke: "#b5d4f4", strokeWidth: 1.8 },
            }) as Edge,
        );
      if (!additions.length) return;
      setEdges((current) => [
        ...current,
        ...additions.filter(
          (addition) =>
            !current.some(
              (edge) =>
                (edge.source === addition.source && edge.target === addition.target) ||
                (edge.source === addition.target && edge.target === addition.source),
            ),
        ),
      ]);
      const additionIds = new Set(additions.map((edge) => edge.id));
      window.setTimeout(() => {
        setEdges((current) =>
          current.map((edge) =>
            additionIds.has(edge.id)
              ? { ...edge, className: "", style: { stroke: "#9a9aa3", strokeWidth: 1.8 } }
              : edge,
          ),
        );
      }, 360);
    },
    [edges, setEdges],
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
    sourceNodeIds?: string[];
    flowPos: { x: number; y: number };
    dropPos: { x: number; y: number };
    clientPos: { x: number; y: number };
  } | null>(null);

  /** 批量连接拖到空白处时，复用普通连线的节点创建菜单。 */
  const openBatchConnectMenu = useCallback(
    (sourceNodeIds: string[], flowPos: { x: number; y: number }, clientPos: { x: number; y: number }) => {
      const sourceNodeId = sourceNodeIds[0];
      if (!sourceNodeId) return;
      const board = document.querySelector(`.${styles.board}`) as HTMLElement | null;
      const boardRect = board?.getBoundingClientRect();
      const localX = clientPos.x - (boardRect?.left ?? 0);
      const localY = clientPos.y - (boardRect?.top ?? 0);
      setConnectMenu({
        sourceNodeId,
        sourceNodeIds,
        flowPos,
        dropPos: { x: localX, y: localY },
        clientPos: {
          x: Math.max(8, Math.min(localX + 14, (boardRect?.width ?? localX + 242) - 228)),
          y: Math.max(8, Math.min(localY - 20, (boardRect?.height ?? localY + 360) - 352)),
        },
      });
    },
    [],
  );
  const [pendingLineStarts, setPendingLineStarts] = useState<Array<{ id: string; x: number; y: number }>>([]);
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
    let movePointerId: number | null = null;

    const resetHandle = (handle: HTMLElement) => {
      handle.classList.remove(handleMagnetClass);
      handle.removeAttribute("data-card-handle-magnet-active");
      handle.style.removeProperty("--handle-pull-x");
      handle.style.removeProperty("--handle-pull-y");
      handle.style.removeProperty("--handle-hit-size");
    };

    const updateNearestHandle = () => {
      animationFrameId = null;
      /* 拖动节点时连接点不会被操作，跳过全量 DOM 测量，避免与 React Flow 拖动争抢主线程。 */
      if (board.querySelector(".react-flow__node.dragging")) {
        if (activeHandle) resetHandle(activeHandle);
        activeHandle = null;
        return;
      }
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
        if (!isCardHandleInteractive(handle)) continue;
        if (multiSelectionActive && handle.closest(".react-flow__node.selected")) continue;
        /* 拖线开始后源节点不再参与磁吸，避免位移复位时圆球短暂闪回锚点。 */
        if (handle.classList.contains("connectingfrom") || handle.closest(`.${connectionSourceActiveClass}`)) {
          continue;
        }
        /* 拖线期间只允许左侧 target 圆球参与吸附。 */
        if (connectStartRef.current.nodeId && !handle.classList.contains("react-flow__handle-left")) continue;
        const distance = getCardHandleDistance(handle, pointerX, pointerY);
        if (
          distance &&
          distance.distanceSq <= CANVAS_HANDLE_MAGNET_RADIUS ** 2 &&
          isCardHandleExposed(handle) &&
          (!nearest || distance.distanceSq < nearest.distanceSq)
        ) {
          nearest = {
            handle,
            pullX: distance.screenDx / distance.safeScale,
            pullY: distance.screenDy / distance.safeScale,
            /* 反算画布缩放，使外侧命中区始终保持 80px 直径。 */
            hitSize: (CANVAS_HANDLE_MAGNET_RADIUS * 2) / distance.safeScale,
            distanceSq: distance.distanceSq,
          };
        }
      }

      /* 组批量连接点与卡片连接点靠近时只激活距离更近者，距离相同优先组。 */
      if (nearest) {
        const groupHandles = board.querySelectorAll<HTMLElement>("[data-batch-connect-handle]");
        for (const groupHandle of groupHandles) {
          const boundary = groupHandle.closest<HTMLElement>("[data-batch-connect-boundary]");
          if (!boundary || pointerX <= boundary.getBoundingClientRect().right) continue;
          const distance = getCenteredHandleDistance(groupHandle, pointerX, pointerY);
          if (distance.distanceSq <= CANVAS_HANDLE_MAGNET_RADIUS ** 2 && distance.distanceSq <= nearest.distanceSq) {
            nearest = null;
            break;
          }
        }
      }

      if (activeHandle !== nearest?.handle) {
        if (activeHandle) resetHandle(activeHandle);
        activeHandle = nearest?.handle ?? null;
        if (activeHandle) {
          activeHandle.classList.add(handleMagnetClass);
          activeHandle.setAttribute("data-card-handle-magnet-active", "true");
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
      pointerRef.current = { x: pointer.clientX, y: pointer.clientY };
      if (movePointerId === pointer.pointerId) {
        onPointerLeave();
        return;
      }
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
    const onPointerDown = (event: PointerEvent) => {
      if (!isCanvasMovePointerTarget(event.target)) return;
      movePointerId = event.pointerId;
      onPointerLeave();
    };
    const onPointerEnd = (event: PointerEvent) => {
      if (movePointerId === event.pointerId) movePointerId = null;
    };
    const onWindowBlur = () => {
      movePointerId = null;
      onPointerLeave();
    };
    /* 捕获阶段监听，保证指针位于 React Flow 连接线之上时仍能更新圆球吸附。 */
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", onPointerEnd, true);
    window.addEventListener("pointercancel", onPointerEnd, true);
    window.addEventListener("blur", onWindowBlur);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerEnd, true);
      window.removeEventListener("pointercancel", onPointerEnd, true);
      window.removeEventListener("blur", onWindowBlur);
      onPointerLeave();
    };
  }, [connectionSourceActiveClass]);

  /** 菜单出现后计算全部源节点的右侧 handle，临时连线共同接到菜单左边缘。 */
  useLayoutEffect(() => {
    if (!connectMenu) {
      setPendingLineStarts([]);
      return;
    }
    const board = document.querySelector(`.${styles.board}`) as HTMLElement | null;
    if (!board) return;
    const boardRect = board.getBoundingClientRect();
    const sourceIds = connectMenu.sourceNodeIds?.length ? connectMenu.sourceNodeIds : [connectMenu.sourceNodeId];
    const starts = sourceIds.flatMap((id) => {
      const sourceNode = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
      const sourceHandle = sourceNode?.querySelector<HTMLElement>(".react-flow__handle-right");
      if (!sourceNode || !sourceHandle) return [];
      const nodeRect = sourceNode.getBoundingClientRect();
      const handleRect = sourceHandle.getBoundingClientRect();
      return [
        {
          id,
          /* 临时虚线从卡片外轮廓起笔，不复用压进卡片内部的正式边锚点。 */
          x: nodeRect.right - boardRect.left,
          y: handleRect.top + handleRect.height / 2 - boardRect.top,
        },
      ];
    });
    setPendingLineStarts(starts);
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
      const multiSelectionActive = board.querySelectorAll(".react-flow__node.selected").length > 1;
      const handles = board.querySelectorAll<HTMLElement>(`.${nodeStyles.cardHandle}.react-flow__handle-left`);
      for (const handle of handles) {
        if (!isCardHandleInteractive(handle)) continue;
        if (multiSelectionActive && handle.closest(".react-flow__node.selected")) continue;
        const nodeId = handle.closest<HTMLElement>(".react-flow__node")?.dataset.id;
        if (!nodeId || nodeId === connectStartRef.current.nodeId) continue;
        const distance = getCardHandleDistance(handle, pointer.clientX, pointer.clientY);
        if (
          distance &&
          distance.distanceSq <= CANVAS_HANDLE_MAGNET_RADIUS ** 2 &&
          isCardHandleExposed(handle) &&
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
      const droppedNode = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>(".react-flow__node");
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
        dropPos: { x: localX, y: localY },
        clientPos: {
          x: Math.max(8, Math.min(localX + 14, (boardRect?.width ?? localX + 242) - 228)),
          y: Math.max(8, Math.min(localY - 20, (boardRect?.height ?? localY + 360) - 352)),
        },
      });
    },
    [screenToFlowPosition, hoverTargetId, previewState, addEdgeDedup, isValidTarget, connectionSourceActiveClass],
  );

  /** 从「引用该节点生成」菜单中挑一个类型创建节点并连线 */
  const addNodeFromConnect = useCallback(
    (kind: BasicNodeKind) => {
      if (!connectMenu) return;
      const { flowPos, sourceNodeId, sourceNodeIds } = connectMenu;
      const sources = sourceNodeIds?.length ? sourceNodeIds : [sourceNodeId];
      const newNode = inheritSharedSourceGroup(
        createBasicNode(kind, { x: flowPos.x, y: flowPos.y - 60 }, true, nodes),
        sources,
        nodes,
      );
      setNodes((ns) => [...ns, newNode]);
      setEdges((es) => [
        ...es,
        ...sources.map(
          (source) =>
            ({
              id: `e_${crypto.randomUUID()}`,
              source,
              target: newNode.id,
              type: "default",
              style: { stroke: "#7f7f86", strokeWidth: 1.6 },
            }) as Edge,
        ),
      ]);
      setConnectMenu(null);
    },
    [connectMenu, nodes, setNodes, setEdges],
  );
  return {
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
  };
}
