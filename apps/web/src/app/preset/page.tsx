"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  CheckCircle2,
  Coins,
  Lock,
  Play,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import styles from "./page.module.scss";

const SHOTS = [
  { shot: "镜头 1", name: "商品特写与质感光泽", duration: "3.5s" },
  { shot: "镜头 2", name: "模特法式街景动态走秀", duration: "4.0s" },
  { shot: "镜头 3", name: "面料纽扣微距细节展示", duration: "3.5s" },
  { shot: "镜头 4", name: "品牌 LOGO 与优惠字幕定格", duration: "4.0s" },
] as const;

export default function PresetPage() {
  const [title, setTitle] = useState("法式复古亚麻衬衫·春夏新品大片");
  const [intensity, setIntensity] = useState(85);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingShot, setGeneratingShot] = useState(-1);

  const startGenerate = () => {
    if (isGenerating) return;
    setIsGenerating(true);
    let step = 0;
    const timer = setInterval(() => {
      step += 1;
      setGeneratingShot(step);
      if (step >= SHOTS.length) {
        clearInterval(timer);
        setIsGenerating(false);
        setGeneratingShot(-1);
      }
    }, 900);
  };

  return (
    <AppShell>
      <div className={styles.container}>
        <div className={styles.head}>
          <div>
            <h2 className={styles.title}>预设 Web UI</h2>
            <p className={styles.sub}>
              面向普通创作者：底层复杂工作流已封装为表单填空与全流程步骤监控
            </p>
          </div>
          <div className={styles.costHint}>
            <span>预计消耗:</span>
            <span className={styles.costValue}>
              <Coins size={14} />
              40 积分
            </span>
          </div>
        </div>

        <div className={styles.grid}>
          {/* 左列：表单 */}
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <h3 className={styles.cardTitle}>Step 1/3: 基础设置</h3>
              <span className={styles.cardBadge}>电商短视频预设 v2.1</span>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>创作主题 / 核心卖点</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={styles.input}
              />
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label}>风格滤镜</label>
                <select className={styles.select}>
                  <option>Film Vintage 35mm</option>
                  <option>Cyberpunk Neon</option>
                  <option>Clean Studio Minimal</option>
                  <option>Cinematic Sunset</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>合作类型</label>
                <select className={styles.select}>
                  <option>Orgw-K 英文</option>
                  <option>CN 国风定制</option>
                  <option>EU 欧洲极简</option>
                </select>
              </div>
            </div>

            <div className={styles.sliderRow}>
              <div className={styles.sliderHead}>
                <span className={styles.sliderLabel}>画质精细度 (Steps)</span>
                <span className={styles.sliderValue}>{intensity} / 100</span>
              </div>
              <input
                type="range"
                min={50}
                max={100}
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
                className={styles.slider}
              />
            </div>

            <button
              onClick={startGenerate}
              disabled={isGenerating}
              className={styles.generateBtn}
            >
              {isGenerating ? (
                <>
                  <RefreshCw size={16} className="spin" />
                  全流程流水线生成中... (预计 45s)
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  立即开始生成 (消耗 40 积分)
                </>
              )}
            </button>
          </div>

          {/* 右列：步骤监控 */}
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <h3 className={styles.cardTitle}>流水线步骤监控 (Step Monitor)</h3>
              <span className={styles.costValue}>
                <CheckCircle2 size={14} />
                就绪状态
              </span>
            </div>

            <div className={styles.steps}>
              {SHOTS.map((step, idx) => {
                const active = isGenerating && generatingShot === idx;
                return (
                  <div
                    key={step.shot}
                    className={`${styles.stepRow} ${active ? styles.active : ""}`}
                  >
                    <div className={styles.stepLeft}>
                      <span className={styles.stepIndex}>{idx + 1}</span>
                      <div>
                        <h4 className={styles.stepName}>
                          {step.shot} · {step.name}
                        </h4>
                        <p className={styles.stepMeta}>
                          {step.duration} · 阶段状态: {active ? "正在渲染中..." : "已就绪"}
                        </p>
                      </div>
                    </div>
                    <div className={styles.stepActions}>
                      <button className={styles.iconBtn} title="局部重生成该镜头">
                        <RefreshCw size={14} />
                      </button>
                      <button className={styles.iconBtn} title="锁定下游避免污染">
                        <Lock size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={styles.output}>
              <div className={styles.outputLeft}>
                <span className={styles.outputIcon}>
                  <Play size={20} />
                </span>
                <div>
                  <h5 className={styles.outputTitle}>预设最终产物 (合成 4K 视频)</h5>
                  <p className={styles.outputMeta}>
                    15.0s · 1080x1920 · 60fps · 带自动配乐与字幕
                  </p>
                </div>
              </div>
              <button className={styles.downloadBtn}>下载高清大片</button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
