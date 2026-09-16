"use client";

import type { ReactNode, RefObject } from "react";
import { Bot } from "lucide-react";
import { UserMenu } from "@/components/UserMenu";
import { HeaderCapsule } from "@/components/HeaderCapsule";
import styles from "./index.module.scss";

interface CanvasProjectHeaderProps {
  toolbar?: ReactNode;
  agentOpen: boolean;
  onToggleAgent: () => void;
  agentButtonRef: RefObject<HTMLButtonElement | null>;
}

/**
 * 渲染画布顶部页面层，承载可替换的项目操作栏和右侧账户、Agent 入口。
 *
 * @param props - 项目工具栏、Agent 抽屉状态和切换回调。
 * @returns 画布顶部导航区域。
 */
export function CanvasProjectHeader({ toolbar, agentOpen, onToggleAgent, agentButtonRef }: CanvasProjectHeaderProps) {
  return (
    <div className={styles.topbar}>
      <div className={styles.topbarLeft}>{toolbar}</div>
      <div className={styles.topbarRight}>
        <UserMenu variant="header" className={styles.canvasHeaderCapsule} />
        <HeaderCapsule
          ref={agentButtonRef}
          className={styles.canvasHeaderCapsule}
          active={agentOpen}
          title="织光 Agent"
          aria-label="织光 Agent"
          onClick={onToggleAgent}
        >
          <Bot size={15} />
          <span>Agent</span>
        </HeaderCapsule>
      </div>
    </div>
  );
}
