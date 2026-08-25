"use client";

import { CheckCircle2, Grid, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import styles from "./page.module.scss";

const NODES = [
  {
    title: "Input (用户输入)",
    tone: "default" as const,
    rows: [
      ["主文案", "商品核心卖点"],
      ["比例", "9:16 (竖屏短视频)"],
    ],
  },
  {
    title: "Skill 算子调度",
    tone: "accent" as const,
    rows: [
      ["模型", "Weavl-Visual-XL"],
      ["镜头组", "4段分镜流水线"],
    ],
  },
  {
    title: "Output (阶段交付)",
    tone: "success" as const,
    rows: [
      ["产物", "4K 商业视频 + 音轨"],
      ["耗时", "~45 秒"],
    ],
  },
];

export default function CanvasPage() {
  return (
    <AppShell>
      <div className={styles.container}>
        <div className={styles.head}>
          <div>
            <h2 className={styles.title}>
              <Grid size={18} className={styles.titleIcon} />
              可视化编排画布 (Canvas)
            </h2>
            <p className={styles.sub}>
              工作流节点自定义，拖拽式编排，发布后将作为 WebUI 预设呈现给普通用户
            </p>
          </div>
          <div className={styles.headActions}>
            <button className={styles.ghostBtn}>导入模板</button>
            <button className={styles.publishBtn}>一键发布为预设 WebUI</button>
          </div>
        </div>

        <div className={styles.board}>
          <div className={styles.gridBg} />
          <div className={styles.flow}>
            {NODES.map((node, i) => (
              <div key={node.title} className={styles.flowItem}>
                {i > 0 && <div className={styles.edge} />}
                <div className={`${styles.node} ${node.tone === "accent" ? styles.accent : ""}`}>
                  <div className={styles.nodeHead}>
                    <h3
                      className={`${styles.nodeTitle} ${
                        node.tone === "accent"
                          ? styles.accentText
                          : node.tone === "success"
                            ? styles.successText
                            : ""
                      }`}
                    >
                      {node.title}
                    </h3>
                    {node.tone === "accent" ? (
                      <Sparkles size={14} className={styles.titleIcon} />
                    ) : node.tone === "success" ? (
                      <CheckCircle2 size={14} style={{ color: "var(--success)" }} />
                    ) : (
                      <span className={styles.edge} style={{ width: 8, height: 8 }} />
                    )}
                  </div>
                  {node.rows.map(([k, v]) => (
                    <div key={k} className={styles.nodeRow}>
                      <span className={styles.nodeKey}>{k}: </span>
                      <span>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
