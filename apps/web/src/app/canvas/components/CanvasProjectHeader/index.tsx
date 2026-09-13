"use client";

import type { RefObject } from "react";
import { Bot, ChevronDown, Home, Layers, Plus, Trash2 } from "lucide-react";
import { Popover } from "@/components/Popover";
import { StarburstLogo } from "@/components/StarburstLogo";
import { UserMenu } from "@/components/UserMenu";
import { HeaderCapsule } from "@/components/HeaderCapsule";
import { AccountHeaderCapsule } from "@/components/AccountHeaderCapsule";
import styles from "./index.module.scss";

interface CanvasProjectHeaderProps {
  projectName: string;
  onProjectNameChange: (name: string) => void;
  projectMenuOpen: boolean;
  onProjectMenuOpenChange: (open: boolean) => void;
  onHome: () => void;
  onProjects: () => void;
  onCreateProject: () => void;
  onDeleteProject: () => void;
  agentOpen: boolean;
  onToggleAgent: () => void;
  agentButtonRef: RefObject<HTMLButtonElement | null>;
}

export function CanvasProjectHeader({
  projectName,
  onProjectNameChange,
  projectMenuOpen,
  onProjectMenuOpenChange,
  onHome,
  onProjects,
  onCreateProject,
  onDeleteProject,
  agentOpen,
  onToggleAgent,
  agentButtonRef,
}: CanvasProjectHeaderProps) {
  return (
    <div className={styles.topbar}>
      <div className={styles.topbarLeft}>
        <div className={styles.projectIdentity}>
          <Popover
            mode="click"
            open={projectMenuOpen}
            onOpenChange={onProjectMenuOpenChange}
            side="bottom"
            align="start"
            sideOffset={8}
            showArrow={false}
            ariaLabel="项目操作"
            contentRole="menu"
            contentClassName={`${styles.projectPopover} glass-strong`}
            trigger={
              <button
                type="button"
                className={`${styles.projectMenuTrigger} ${projectMenuOpen ? styles.projectMenuTriggerOpen : ""}`}
                aria-label="打开项目菜单"
                aria-expanded={projectMenuOpen}
              >
                <StarburstLogo size={19} />
                <ChevronDown
                  size={13}
                  className={`${styles.projectMenuChevron} ${projectMenuOpen ? styles.projectMenuChevronOpen : ""}`}
                />
              </button>
            }
          >
            <button type="button" role="menuitem" className={styles.projectMenuItem} onClick={onHome}>
              <Home size={14} />
              回到主页
            </button>
            <button type="button" role="menuitem" className={styles.projectMenuItem} onClick={onProjects}>
              <Layers size={14} />
              全部项目
            </button>
            <button type="button" role="menuitem" className={styles.projectMenuItem} onClick={onCreateProject}>
              <Plus size={14} />
              创建项目
            </button>
            <div className={styles.projectMenuSeparator} role="separator" />
            <button
              type="button"
              role="menuitem"
              className={`${styles.projectMenuItem} ${styles.projectMenuItemDanger}`}
              onClick={onDeleteProject}
            >
              <Trash2 size={14} />
              删除项目
            </button>
          </Popover>
          <input
            className={styles.projectNameInput}
            value={projectName}
            onChange={(event) => onProjectNameChange(event.target.value)}
            onBlur={() => onProjectNameChange(projectName.trim() || "未命名项目")}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            aria-label="项目名称"
            spellCheck={false}
          />
        </div>
      </div>
      <div className={styles.topbarRight}>
        <UserMenu
          trigger={
            <AccountHeaderCapsule
              amount={100}
              plan="Plus"
              className={styles.canvasHeaderCapsule}
              aria-label="用户菜单"
            />
          }
        />
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
