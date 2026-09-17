import type { ReactNode } from "react";
import styles from "./index.module.scss";

export interface CanvasToolbarAction {
  key: string;
  icon: ReactNode;
  title: string;
  label?: string;
  onClick: () => void;
}

interface CanvasActionToolbarProps {
  actions: CanvasToolbarAction[];
  className?: string;
  ariaLabel?: string;
  variant?: "default" | "icons";
}

/**
 * 渲染画布内统一的横向浮动操作栏。
 *
 * 节点、选区和分组只提供动作定义，按钮结构、提示文案、事件隔离与视觉样式由该组件统一维护。
 *
 * @param props - 图标、标题、事件组成的动作列表及横栏展示参数。
 * @returns 不会触发节点拖拽或画布平移的操作横栏。
 */
export function CanvasActionToolbar({
  actions,
  className,
  ariaLabel = "画布操作",
  variant = "default",
}: CanvasActionToolbarProps) {
  return (
    <div
      className={`${styles.toolbar} ${variant === "icons" ? styles.iconToolbar : ""} ${className ?? ""} nodrag nopan`}
      role="toolbar"
      aria-label={ariaLabel}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {actions.map((action) => (
        <button
          key={action.key}
          type="button"
          title={action.title}
          aria-label={action.title}
          onClick={(event) => {
            event.stopPropagation();
            action.onClick();
          }}
        >
          <span className={styles.icon} aria-hidden="true">
            {action.icon}
          </span>
          {action.label && <span>{action.label}</span>}
        </button>
      ))}
    </div>
  );
}
