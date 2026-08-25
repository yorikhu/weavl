"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  CheckCircle2,
  Coins,
  Lock,
  Play,
  RefreshCw,
  Sparkles,
} from "lucide-react";

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
      <div className="mx-auto max-w-[1400px] space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">预设 Web UI</h2>
            <p className="text-xs text-muted-foreground">
              面向普通创作者：底层复杂工作流已封装为表单填空与全流程步骤监控
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>预计消耗:</span>
            <div className="flex items-center gap-1 font-semibold text-[var(--accent)]">
              <Coins className="h-3.5 w-3.5" />
              <span>40 积分</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* 左列：表单 */}
          <div className="col-span-12 space-y-5 rounded-3xl border border-border bg-card p-6 lg:col-span-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-xs font-bold">Step 1/3: 基础设置</h3>
              <span className="text-xs font-medium text-[var(--accent)]">电商短视频预设 v2.1</span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">
                  创作主题 / 核心卖点
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input)] px-3.5 py-2.5 text-xs outline-none focus:ring-1 focus:ring-border-strong"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">风格滤镜</label>
                  <select className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input)] px-3 py-2.5 text-xs outline-none">
                    <option>Film Vintage 35mm</option>
                    <option>Cyberpunk Neon</option>
                    <option>Clean Studio Minimal</option>
                    <option>Cinematic Sunset</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">合作类型</label>
                  <select className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input)] px-3 py-2.5 text-xs outline-none">
                    <option>Orgw-K 英文</option>
                    <option>CN 国风定制</option>
                    <option>EU 欧洲极简</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">画质精细度 (Steps)</span>
                  <span className="font-medium">{intensity} / 100</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={100}
                  value={intensity}
                  onChange={(e) => setIntensity(Number(e.target.value))}
                  className="w-full cursor-pointer accent-[var(--accent)]"
                />
              </div>

              <button
                onClick={startGenerate}
                disabled={isGenerating}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 py-3.5 text-xs font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition-all hover:brightness-110 disabled:opacity-60"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>全流程流水线生成中... (预计 45s)</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>立即开始生成 (消耗 40 积分)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 右列：步骤监控 */}
          <div className="col-span-12 space-y-5 rounded-3xl border border-border bg-card p-6 lg:col-span-7">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-xs font-bold">流水线步骤监控 (Step Monitor)</h3>
              <span className="flex items-center gap-1 text-xs text-[var(--success)]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                就绪状态
              </span>
            </div>

            <div className="space-y-3">
              {SHOTS.map((step, idx) => {
                const active = isGenerating && generatingShot === idx;
                const done = !isGenerating && generatingShot === -1 && false;
                return (
                  <div
                    key={step.shot}
                    className={`flex items-center justify-between rounded-2xl border p-3.5 transition-all ${
                      active
                        ? "animate-pulse border-[var(--accent)] bg-[var(--accent-soft)]"
                        : "border-[var(--sub-card-border)] bg-sub-card"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-xs font-bold">
                        {idx + 1}
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold">{step.shot} · {step.name}</h4>
                        <span className="text-[10px] text-muted-foreground">
                          {step.duration} · 阶段状态: {active ? "正在渲染中..." : done ? "已完成" : "已就绪"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        title="局部重生成该镜头"
                        className="rounded-lg border border-border bg-card p-2 text-muted-foreground transition-all hover:text-[var(--foreground)]"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        title="锁定下游避免污染"
                        className="rounded-lg border border-border bg-card p-2 text-muted-foreground transition-all hover:text-[var(--foreground)]"
                      >
                        <Lock className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 产物预览 */}
            <div className="flex items-center justify-between rounded-2xl border border-border bg-[var(--sider)] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--accent-soft)] bg-[var(--accent-soft)] text-[var(--accent)]">
                  <Play className="h-5 w-5" />
                </div>
                <div>
                  <h5 className="text-xs font-bold">预设最终产物 (合成 4K 视频)</h5>
                  <p className="text-[11px] text-muted-foreground">15.0s · 1080x1920 · 60fps · 带自动配乐与字幕</p>
                </div>
              </div>
              <button className="rounded-xl bg-[var(--foreground)] px-4 py-2 text-xs font-bold text-[var(--background)] transition-all hover:opacity-90">
                下载高清大片
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
