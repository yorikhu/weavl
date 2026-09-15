import { useEffect, type RefObject } from "react";
import { CANVAS_HANDLE_MAGNET_RADIUS } from "../../constants/viewport";
import {
  getCardHandleDistance,
  getCenteredHandleDistance,
  isCanvasMovePointerTarget,
  isCardHandleExposed,
  isCardHandleInteractive,
} from "../../utils/handleMagnet";
import styles from "./index.module.scss";

interface UseBatchHandleMagnetOptions {
  draggingRef: RefObject<unknown>;
}

function resetHandle(handle: HTMLElement) {
  handle.classList.remove(styles.batchHandleMagnetActive ?? "");
  handle.style.removeProperty("--handle-pull-x");
  handle.style.removeProperty("--handle-pull-y");
  handle.style.removeProperty("--handle-hit-size");
}

/**
 * 让组和临时多选区的批量连接球共享屏幕等距磁吸与候选仲裁。
 *
 * @param options - 保存当前批量拖线状态的可变引用。
 */
export function useBatchHandleMagnet({ draggingRef }: UseBatchHandleMagnetOptions) {
  useEffect(() => {
    const magnetClass = styles.batchHandleMagnetActive;
    if (!magnetClass) return;
    let activeHandle: HTMLElement | null = null;
    let frame: number | null = null;
    let pointer = { x: 0, y: 0 };
    let movePointerId: number | null = null;

    const update = () => {
      frame = null;
      /* 卡片或批量连接正在拖动时无需寻找磁吸点，避免逐帧读取所有节点布局。 */
      if (draggingRef.current || document.querySelector(".react-flow__node.dragging")) {
        if (activeHandle) resetHandle(activeHandle);
        activeHandle = null;
        return;
      }
      let nearest: { handle: HTMLElement; dx: number; dy: number; hitSize: number; distanceSq: number } | null = null;
      const handles = document.querySelectorAll<HTMLElement>("[data-batch-connect-handle]");
      for (const handle of handles) {
        const boundary = handle.closest<HTMLElement>("[data-batch-connect-boundary]");
        if (!boundary) continue;
        /* 只允许在组或临时选区的右侧吸附，避免内部卡片操作被抢占。 */
        if (pointer.x <= boundary.getBoundingClientRect().right) continue;
        const distance = getCenteredHandleDistance(handle, pointer.x, pointer.y);
        const { safeScale, screenDx: dx, screenDy: dy, distanceSq } = distance;
        if (distanceSq > CANVAS_HANDLE_MAGNET_RADIUS ** 2 || (nearest && distanceSq >= nearest.distanceSq)) continue;
        nearest = {
          handle,
          dx: dx / safeScale,
          dy: dy / safeScale,
          hitSize: (CANVAS_HANDLE_MAGNET_RADIUS * 2) / safeScale,
          distanceSq,
        };
      }

      /* 与外部卡片的圆点靠近时统一比较距离，避免两个连接点同时吸附和重叠。 */
      if (nearest) {
        const cardHandles = document.querySelectorAll<HTMLElement>(".react-flow__node .react-flow__handle");
        const multiSelectionActive = document.querySelectorAll(".react-flow__node.selected").length > 1;
        for (const cardHandle of cardHandles) {
          if (!isCardHandleInteractive(cardHandle)) continue;
          if (multiSelectionActive && cardHandle.closest(".react-flow__node.selected")) continue;
          const distance = getCardHandleDistance(cardHandle, pointer.x, pointer.y);
          if (distance && isCardHandleExposed(cardHandle) && distance.distanceSq < nearest.distanceSq) {
            nearest = null;
            break;
          }
        }
      }

      if (activeHandle !== nearest?.handle) {
        if (activeHandle) resetHandle(activeHandle);
        activeHandle = nearest?.handle ?? null;
        if (activeHandle) {
          activeHandle.classList.add(magnetClass);
          void activeHandle.offsetWidth;
        }
      }
      if (!nearest) return;
      nearest.handle.style.setProperty("--handle-pull-x", `${nearest.dx}px`);
      nearest.handle.style.setProperty("--handle-pull-y", `${nearest.dy}px`);
      nearest.handle.style.setProperty("--handle-hit-size", `${nearest.hitSize}px`);
    };

    const onPointerMove = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
      if (movePointerId === event.pointerId) {
        clear();
        return;
      }
      if (frame === null) frame = window.requestAnimationFrame(update);
    };
    const clear = () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
      if (activeHandle) resetHandle(activeHandle);
      activeHandle = null;
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!isCanvasMovePointerTarget(event.target)) return;
      movePointerId = event.pointerId;
      clear();
    };
    const onPointerEnd = (event: PointerEvent) => {
      if (movePointerId === event.pointerId) movePointerId = null;
    };
    const onWindowBlur = () => {
      movePointerId = null;
      clear();
    };

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
      clear();
    };
  }, [draggingRef]);
}
