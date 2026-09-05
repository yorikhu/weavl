"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import type { InputDef, RunView, CandidateArtifact } from "@weavl/shared";
import {
  CheckCircle2,
  Coins,
  FileCheck2,
  RefreshCw,
  Sparkles,
  ClipboardList,
  PackageCheck,
} from "lucide-react";
import styles from "./page.module.scss";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

type Phase = "form" | "running" | "done" | "error";

export default function PresetPage() {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [template, setTemplate] = useState<{
    id: string;
    name: string;
    inputs: InputDef[];
    gates: { afterStep: string; title: string; description?: string }[];
    totalSteps: number;
    cost: { min: number; max: number };
  } | null>(null);
  const [run, setRun] = useState<RunView | null>(null);
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/templates`)
      .then((r) => r.json())
      .then((list: {
        id: string;
        name: string;
        inputs: InputDef[];
        gates: { afterStep: string; title: string; description?: string }[];
        totalSteps: number;
        cost: { min: number; max: number };
      }[]) => {
        const t = list?.[0];
        if (!t) return;
        setTemplate(t);
        const init: Record<string, string> = {};
        t.inputs.forEach((d: InputDef) => {
          if (d.type === "select" && d.options[0]) init[d.name] = d.options[0].value;
          else if (d.type === "number" && d.default != null) init[d.name] = String(d.default);
          else init[d.name] = "";
        });
        setInputs(init);
      })
      .catch(() => setError("无法连接 API（localhost:3001），请先启动 pnpm dev:api"));
  }, []);

  const startRun = useCallback(async () => {
    if (!template) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: template.id, inputs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "创建失败");
      setRun(data);
      setPhase(data.status === "succeeded" ? "done" : "running");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [template, inputs]);

  const decide = useCallback(
    async (action: "confirm" | "regenerate") => {
      if (!run) return;
      setBusy(true);
      try {
        const res = await fetch(`${API}/runs/${run.id}/decide`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, candidateId: selected ?? undefined }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? "操作失败");
        setRun(data);
        setSelected(null);
        setPhase(data.status === "succeeded" ? "done" : "running");
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [run, selected],
  );

  const gate = template?.gates.find((g) => g.afterStep === run?.awaitingGate);
  const candidates: CandidateArtifact[] = run?.candidates ?? [];
  const pkg = run?.contentPackage;

  return (
    <AppShell>
      <div className={styles.container}>
        <div className={styles.head}>
          <div>
            <h2 className={styles.title}>{template?.name ?? "预设加载中…"}</h2>
            <p className={styles.sub}>
              表单填写业务信息 → 系统生成 → 关键节点人工确认 → 交付内容包
            </p>
          </div>
          {template && (
            <div className={styles.costHint}>
              <span>预计成本:</span>
              <span className={styles.costValue}>
                <Coins size={14} />
                ¥{template.cost.min}–{template.cost.max}
              </span>
            </div>
          )}
        </div>

        {error && <div className={styles.errorBar}>{error}</div>}

        <div className={styles.grid}>
          {/* 左列：Schema 驱动表单 / 进度 */}
          <div className={styles.card}>
            {phase === "form" && (
              <>
                <div className={styles.cardHead}>
                  <h3 className={styles.cardTitle}>第 1 步 · 填写商品信息</h3>
                  <span className={styles.cardBadge}>
                    {template?.totalSteps ?? "-"} 个后台步骤 · {template?.gates.length ?? "-"} 个人工确认点
                  </span>
                </div>
                {template?.inputs.map((def) => (
                  <div key={def.name} className={styles.field}>
                    <label className={styles.label}>
                      {def.label}
                      {def.required ? " *" : ""}
                    </label>
                    {def.type === "textarea" ? (
                      <textarea
                        className={styles.textarea}
                        rows={3}
                        placeholder={"placeholder" in def ? def.placeholder : undefined}
                        maxLength={"maxLength" in def ? def.maxLength : undefined}
                        value={inputs[def.name] ?? ""}
                        onChange={(e) => setInputs((s) => ({ ...s, [def.name]: e.target.value }))}
                      />
                    ) : def.type === "select" ? (
                      <select
                        className={styles.select}
                        value={inputs[def.name] ?? ""}
                        onChange={(e) => setInputs((s) => ({ ...s, [def.name]: e.target.value }))}
                      >
                        {def.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={def.type === "number" ? "number" : "text"}
                        className={styles.input}
                        placeholder={"placeholder" in def ? def.placeholder : undefined}
                        maxLength={"maxLength" in def ? def.maxLength : undefined}
                        value={inputs[def.name] ?? ""}
                        onChange={(e) => setInputs((s) => ({ ...s, [def.name]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}
                <button className={styles.generateBtn} disabled={busy} onClick={startRun}>
                  {busy ? (
                    <>
                      <RefreshCw size={16} className="spin" />
                      正在启动…
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      开始生成内容包
                    </>
                  )}
                </button>
              </>
            )}

            {phase === "running" && (
              <>
                <div className={styles.cardHead}>
                  <h3 className={styles.cardTitle}>任务进行中</h3>
                  <span className={styles.cardBadge}>
                    {run?.completedSteps}/{run?.totalSteps} 步
                  </span>
                </div>
                <div className={styles.progressTrack}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${((run?.completedSteps ?? 0) / (run?.totalSteps || 1)) * 100}%` }}
                  />
                </div>
                {gate ? (
                  <div className={styles.gateBanner}>
                    <ClipboardList size={16} />
                    等待确认：{gate.title}
                    {gate.description ? ` — ${gate.description}` : ""}
                  </div>
                ) : (
                  <div className={styles.gateWait}>后台执行中…</div>
                )}
                {run?.decisions && run.decisions.length > 0 && (
                  <div className={styles.decisions}>
                    {run.decisions.map((d, i) => (
                      <div key={i} className={styles.decisionRow}>
                        <CheckCircle2 size={12} />
                        已确认 {d.gate}（{d.action}）
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {phase === "done" && pkg && (
              <>
                <div className={styles.cardHead}>
                  <h3 className={styles.cardTitle}>
                    <PackageCheck size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
                    内容包已就绪
                  </h3>
                  <span className={styles.cardBadge}>
                    {pkg.channel} · v{pkg.version} · 实际成本 ¥{run?.actualCost}
                  </span>
                </div>
                {pkg.fields.map((f) => (
                  <div key={f.key} className={styles.pkgField}>
                    <div className={styles.pkgLabel}>{f.label}</div>
                    <pre className={styles.pkgValue}>{f.value}</pre>
                  </div>
                ))}
                <button
                  className={styles.downloadBtn}
                  onClick={() => {
                    const blob = new Blob(
                      [pkg.fields.map((f) => `【${f.label}】\n${f.value}`).join("\n\n———\n\n")],
                      { type: "text/plain;charset=utf-8" },
                    );
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = `${pkg.id}.txt`;
                    a.click();
                  }}
                >
                  导出内容包（TXT）
                </button>
              </>
            )}
          </div>

          {/* 右列：候选确认 / 结果 */}
          <div className={styles.card}>
            {phase === "running" && gate && (
              <>
                <div className={styles.cardHead}>
                  <h3 className={styles.cardTitle}>{gate.title} · 选择一个候选</h3>
                  <span className={styles.cardBadge}>{candidates.length} 个候选</span>
                </div>
                <div className={styles.candidateList}>
                  {candidates.map((c, i) => (
                    <button
                      key={c.id}
                      className={`${styles.candidate} ${selected === c.id ? styles.candidateActive : ""}`}
                      onClick={() => setSelected(c.id)}
                    >
                      <div className={styles.candidateHead}>
                        <span className={styles.candidateIndex}>{i + 1}</span>
                        <span className={styles.candidateTag}>{c.variantLabel}</span>
                      </div>
                      <pre className={styles.candidateContent}>{c.content}</pre>
                    </button>
                  ))}
                </div>
                <div className={styles.gateActions}>
                  <button
                    className={styles.confirmBtn}
                    disabled={!selected || busy}
                    onClick={() => decide("confirm")}
                  >
                    <CheckCircle2 size={14} />
                    采纳并继续
                  </button>
                  <button className={styles.regenerateBtn} disabled={busy} onClick={() => decide("regenerate")}>
                    <RefreshCw size={14} />
                    换一批
                  </button>
                </div>
              </>
            )}

            {phase === "running" && !gate && (
              <div className={styles.emptyState}>
                <FileCheck2 size={32} />
                <p>正在执行后台步骤，下一个确认点出现后会在这里展示候选</p>
              </div>
            )}

            {phase === "form" && (
              <div className={styles.emptyState}>
                <Sparkles size={32} />
                <p>
                  填写左侧表单并开始后，生成结果会在这里出现。
                  <br />
                  流程包含 3 个人工确认点：选题方向 → 文案 → 封面
                </p>
              </div>
            )}

            {phase === "done" && (
              <div className={styles.emptyState}>
                <PackageCheck size={32} />
                <p>
                  任务完成，全部决策已留痕（{run?.decisions?.length ?? 0} 次）。
                  <br />
                  左侧为最终内容包，可导出后发布到{pkg?.channel}。
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
