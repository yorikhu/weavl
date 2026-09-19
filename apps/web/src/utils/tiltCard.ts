import type { PointerEventHandler } from "react";

/** 将倾斜卡片恢复到静止角度。 */
export function resetTiltCard(element: HTMLElement | null) {
  element?.style.setProperty("--tilt-x", "0deg");
  element?.style.setProperty("--tilt-y", "0deg");
}

/**
 * 创建卡片倾斜交互所需的指针事件处理器。
 *
 * @param range - 组件属性。
 * @returns 可直接绑定到卡片的事件处理器。
 */
export function createTiltCardHandlers<T extends HTMLElement>(
  range = 9,
): {
  onPointerMove: PointerEventHandler<T>;
  onPointerLeave: PointerEventHandler<T>;
} {
  return {
    onPointerMove(event) {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;

      const card = event.currentTarget;
      const rect = card.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));

      card.style.setProperty("--tilt-x", `${((0.5 - y) * range).toFixed(2)}deg`);
      card.style.setProperty("--tilt-y", `${((x - 0.5) * range).toFixed(2)}deg`);
    },
    onPointerLeave(event) {
      resetTiltCard(event.currentTarget);
    },
  };
}
