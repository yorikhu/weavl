"use client";

import { Bot, Send } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import styles from "./page.module.scss";

export default function AgentPage() {
  return (
    <AppShell>
      <div className={styles.wrap}>
        <div className={styles.panel}>
          <div className={`${styles.header} frost-header`}>
            <div className={styles.headerLeft}>
              <span className={styles.botIcon}>
                <Bot size={18} />
              </span>
              <div>
                <h3 className={styles.botName}>织光官方导演 Agent</h3>
                <p className={styles.botDesc}>
                  具备全局上下文感知能力 · 支持精准局部调优与重算
                </p>
              </div>
            </div>
            <div className={styles.online}>
              <span className={styles.dot} />
              在线就绪
            </div>
          </div>

          <div className={styles.stream}>
            <div className={styles.msgRow}>
              <span className={styles.msgAvatar}>
                <Bot size={14} />
              </span>
              <div className={styles.bubble}>
                <p className={styles.bubbleTitle}>你好！我是你的专属织光导演。</p>
                <p className={styles.bubbleBody}>
                  你可以告诉我你的创作主题（如&ldquo;打造一组法式复古夏季短视频&rdquo;），我将为你自动推荐最佳工作流预设、拆解分镜参数，并协助你进行单镜头微调。
                </p>
              </div>
            </div>
          </div>

          <div className={`${styles.inputBar} frost-header`}>
            <input
              type="text"
              placeholder="与织光导演交流创意，按 Enter 发送..."
              className={styles.input}
            />
            <button className={styles.sendBtn} aria-label="发送">
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
