import { useCallback, useEffect, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useReactFlow, type Connection, type Edge, type Node } from "@xyflow/react";
import type { BasicNodeKind } from "../types/nodes";
import { createBasicNode } from "../utils/nodeFactory";
import styles from "../page.module.scss";
import nodeStyles from "../components/CanvasNode/index.module.scss";

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
      setConnectError(null);
    },
    [connectionSourceActiveClass],
  );

  /** 拖线连接状态 —— 三态预览 + 成功动效 + 失败 toast */
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
  /** 连接失败 toast */
  const [connectError, setConnectError] = useState<string | null>(null);
  const connectErrorTimerRef = useRef<number | null>(null);

  /** 鼠标靠近 handle 时，让最近的圆点显现并跟随指针。 */
  useEffect(() => {
    const board = document.querySelector(`.${styles.board}`);
    const handleMagnetClass = nodeStyles.handleMagnetActive;
    const handleProximityClass = nodeStyles.handleProximityActive;
    if (!board || !handleMagnetClass || !handleProximityClass) return;
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
        const rect = handle.getBoundingClientRect();
        /* rect 是屏幕坐标，而伪元素位移处于会被 React Flow 缩放的画布坐标系。 */
        const scale = handle.offsetWidth > 0 ? rect.width / handle.offsetWidth : 1;
        const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
        const visualOffsetX = (handle.classList.contains("react-flow__handle-left") ? -15 : 15) * safeScale;
        const screenDx = pointerX - (rect.left + rect.width / 2 + visualOffsetX);
        const screenDy = pointerY - (rect.top + rect.height / 2);
        const distanceSq = screenDx * screenDx + screenDy * screenDy;
        if (distanceSq <= 40 * 40 && (!nearest || distanceSq < nearest.distanceSq)) {
          nearest = {
            handle,
            pullX: screenDx / safeScale,
            pullY: screenDy / safeScale,
            /* 反算画布缩放，使 80px 热区和屏幕坐标下 40px 的吸附半径严格一致。 */
            hitSize: 80 / safeScale,
            distanceSq,
          };
        }
      }

      if (activeHandle !== nearest?.handle) {
        if (activeHandle) resetHandle(activeHandle);
        activeHandle = nearest?.handle ?? null;
        activeHandle?.classList.add(handleMagnetClass);
      }
      if (!nearest) {
        board.classList.remove(handleProximityClass);
        return;
      }
      board.classList.add(handleProximityClass);
      /* 换算回画布坐标，保证任意缩放比例下圆心都落在鼠标正下方。 */
      nearest.handle.style.setProperty("--handle-pull-x", `${nearest.pullX}px`);
      nearest.handle.style.setProperty("--handle-pull-y", `${nearest.pullY}px`);
      nearest.handle.style.setProperty("--handle-hit-size", `${nearest.hitSize}px`);
    };

    const onPointerMove = (event: Event) => {
      const pointer = event as PointerEvent;
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
      board.classList.remove(handleProximityClass);
    };
    board.addEventListener("pointermove", onPointerMove);
    board.addEventListener("pointerleave", onPointerLeave);
    return () => {
      board.removeEventListener("pointermove", onPointerMove);
      board.removeEventListener("pointerleave", onPointerLeave);
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
      const wasError = connectError;
      /** 拖线结束，重置 hover/preview/error 状态 */
      setHoverTargetId(null);
      setPreviewState(null);
      setConnectError(null);
      /* onConnect 已经完成本次连接时，不能再根据松手 DOM 位置弹出创建菜单。 */
      if (!start.nodeId || didConnect) return;
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
        /** 可连：直接连接并保留线条绘制动画。 */
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
      connectError,
      showConnectError,
      addEdgeDedup,
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
    connectError,
    isValidConnection,
    onConnect,
    onConnectStart,
    onConnectEnd,
    addNodeFromConnect,
  };
}
