"use client";

import { useRouter } from "next/navigation";
import { Clock, Layers, Plus, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import styles from "./page.module.scss";

const PROJECTS = [
  { name: "电商主图批量流水线", nodes: 12, updated: "2 小时前" },
  { name: "法式服装短视频织法", nodes: 8, updated: "昨天" },
  { name: "品牌视觉灵感画布", nodes: 15, updated: "3 天前" },
  { name: "国风水墨分镜工作台", nodes: 6, updated: "上周" },
  { name: "新品发布全链路编排", nodes: 21, updated: "上周" },
  { name: "个人风格 LoRA 试验田", nodes: 4, updated: "2 周前" },
] as const;

export default function ProjectsPage() {
  const router = useRouter();

  return (
    <AppShell>
      <div className={styles.container}>
        <div className={styles.head}>
          <div>
            <h2 className={styles.title}>
              <Layers size={18} />
              项目
            </h2>
            <p className={styles.sub}>点击项目进入画布编排，节点式工作流创作</p>
          </div>
          <button className={styles.newBtn} onClick={() => router.push("/canvas")}>
            <Plus size={14} />
            新建项目
          </button>
        </div>

        <div className={styles.grid}>
          {PROJECTS.map((p) => (
            <div
              key={p.name}
              className={styles.card}
              onClick={() => router.push("/canvas")}
            >
              <div className={styles.cardCover}>
                <Sparkles size={20} />
              </div>
              <h4 className={styles.cardTitle}>{p.name}</h4>
              <div className={styles.cardMeta}>
                <span>{p.nodes} 个节点</span>
                <span className={styles.cardTime}>
                  <Clock size={11} />
                  {p.updated}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
