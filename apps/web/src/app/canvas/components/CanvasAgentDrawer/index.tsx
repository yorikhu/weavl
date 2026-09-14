"use client";

/* eslint-disable @next/next/no-img-element -- Agent attachments are local Data URLs, not optimizable remote images. */

import type { ChangeEvent, RefObject } from "react";
import { Bot, Plus, Send, X } from "lucide-react";
import { ComposerTextarea } from "@/components/ComposerTextarea";
import styles from "./index.module.scss";

export interface AgentMessage {
  role: "user" | "agent";
  text: string;
  thumb?: string | null;
}

interface CanvasAgentDrawerProps {
  drawerRef: RefObject<HTMLDivElement | null>;
  messages: AgentMessage[];
  model: string;
  input: string;
  thumb: string | null;
  onInputChange: (value: string) => void;
  onThumbChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveThumb: () => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function CanvasAgentDrawer({
  drawerRef,
  messages,
  model,
  input,
  thumb,
  onInputChange,
  onThumbChange,
  onRemoveThumb,
  onSubmit,
  onClose,
}: CanvasAgentDrawerProps) {
  return (
    <div ref={drawerRef} className={styles.agentDrawer}>
      <div className={styles.agentDrawerHead}>
        <div className={styles.agentDrawerHeadLeft}>
          <div className={styles.agentDrawerAvatar}>
            <Bot size={13} />
          </div>
          <div className={styles.agentDrawerTitle}>
            <span className={styles.agentDrawerName}>织光 Agent</span>
            <span className={styles.agentDrawerModel}>✦ {model}</span>
          </div>
        </div>
        <button className={styles.agentDrawerClose} onClick={onClose} aria-label="收起">
          <X size={13} />
        </button>
      </div>
      <div className={styles.agentDrawerMessages}>
        {messages.map((message, index) => (
          <div
            key={index}
            className={`${styles.agentBubbleRow} ${message.role === "user" ? styles.agentBubbleRowUser : ""}`}
          >
            {message.thumb && <img src={message.thumb} alt="参考图" className={styles.agentBubbleThumb} />}
            <div className={`${styles.agentBubble} ${message.role === "user" ? styles.agentBubbleUser : ""}`}>
              {message.text}
            </div>
          </div>
        ))}
      </div>
      <div className={styles.agentDrawerInputRow}>
        <label className={styles.chatPlus} title="添加参考图">
          <Plus size={14} />
          <input type="file" accept="image/*" hidden onChange={onThumbChange} />
        </label>
        {thumb && (
          <div className={styles.chatThumb}>
            <img src={thumb} alt="参考图" />
            <button className={styles.chatThumbClose} onClick={onRemoveThumb} aria-label="移除">
              <X size={10} />
            </button>
          </div>
        )}
        <ComposerTextarea
          className={styles.agentDrawerInput}
          placeholder="告诉 Agent 想做什么…"
          value={input}
          onValueChange={onInputChange}
          onSubmit={onSubmit}
          title="Enter 发送；Shift / Ctrl / Command + Enter 换行"
          rows={2}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            }
          }}
        />
        <button
          className={`${styles.chatSend} ${input.trim() || thumb ? styles.chatSendActive : ""}`}
          onClick={onSubmit}
          disabled={!input.trim() && !thumb}
          title="发送"
        >
          <Send size={13} />
        </button>
      </div>
    </div>
  );
}
