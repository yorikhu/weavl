"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, Check, CirclePause, Plus, RotateCcw, X } from "lucide-react";
import type {
  Asset,
  CanvasProject,
  WorkflowDefinition,
  WorkflowField,
  WorkflowRunRecord,
  WorkflowStage,
} from "@weavl/shared";
import { AppShell } from "@/components/AppShell";
import { jsonBody, studioApi } from "@/lib/studioApi";
import { useAuth } from "@/provider/AuthProvider";
import ui from "@/styles/studio.module.scss";
import { assetToCanvasNode } from "@/utils/assetNode";
import { openCanvasAfter } from "@/utils/openCanvas";
import styles from "./page.module.scss";

type Tab = "discover" | "mine" | "runs";
const newWorkflow: {
  title: string;
  description: string;
  category: string;
  fields: WorkflowField[];
  stages: WorkflowStage[];
} = {
  title: "",
  description: "",
  category: "自定义",
  fields: [{ id: "brief", label: "任务说明", type: "textarea", required: true }],
  stages: [{ id: "draft", title: "初稿", instruction: "根据输入生成初稿", outputKind: "text", visibility: "review" }],
};

export default function WorkflowsWorkspace() {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("discover");
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [runs, setRuns] = useState<WorkflowRunRecord[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [projects, setProjects] = useState<CanvasProject[]>([]);
  const [active, setActive] = useState<WorkflowDefinition | null>(null);
  const [run, setRun] = useState<WorkflowRunRecord | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [projectId, setProjectId] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(newWorkflow);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const visible = useMemo(
    () => workflows.filter((item) => (tab === "mine" ? item.ownerId === user?.id : item.status === "published")),
    [workflows, tab, user?.id],
  );

  const refresh = useCallback(async () => {
    try {
      const [definitions, history, files, projectItems] = await Promise.all([
        studioApi<WorkflowDefinition[]>("/studio/workflows"),
        studioApi<WorkflowRunRecord[]>("/studio/workflows/runs"),
        studioApi<Asset[]>("/studio/assets"),
        studioApi<CanvasProject[]>("/studio/projects"),
      ]);
      setWorkflows(definitions);
      setRuns(history);
      setAssets(files);
      setProjects(projectItems);
      setRun((current) => (current ? history.find((item) => item.id === current.id) || current : null));
    } catch (cause) {
      setError((cause as Error).message);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("workflowId");
    const workflow = workflows.find((item) => item.id === requested);
    if (workflow) {
      setActive(workflow);
      window.history.replaceState(null, "", "/workflows");
    }
  }, [workflows]);

  async function saveDefinition() {
    setError("");
    try {
      const workflow = await studioApi<WorkflowDefinition>("/studio/workflows", {
        method: "POST",
        body: jsonBody(form),
      });
      await studioApi(`/studio/workflows/${workflow.id}`, { method: "PATCH", body: jsonBody({ status: "published" }) });
      setEditing(false);
      setForm(newWorkflow);
      setTab("mine");
      await refresh();
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function startRun() {
    if (!active) return;
    setError("");
    setBusy(true);
    try {
      const next = await studioApi<WorkflowRunRecord>(`/studio/workflows/${active.id}/runs`, {
        method: "POST",
        body: jsonBody({ inputs, projectId: projectId || undefined }),
      });
      setRun(next);
      setActive(null);
      setTab("runs");
      await refresh();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function act(path: string, body?: unknown) {
    if (!run) return;
    setBusy(true);
    setError("");
    try {
      const next = await studioApi<WorkflowRunRecord>(`/studio/workflows/runs/${run.id}/${path}`, {
        method: "POST",
        body: body ? jsonBody(body) : undefined,
      });
      setRun(next);
      setReviewText("");
      await refresh();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addToProject(asset: Asset) {
    const project = projects.find((item) => item.id === run?.projectId) || projects[0];
    if (!project) {
      router.push("/projects");
      return;
    }
    const canvas = project.canvases[0]!;
    try {
      await openCanvasAfter(async () => {
        const latest = await studioApi<CanvasProject>(`/studio/projects/${project.id}`);
        const currentCanvas = latest.canvases.find((item) => item.id === canvas.id) || canvas;
        const nodes = [...currentCanvas.nodes, assetToCanvasNode(asset, currentCanvas.nodes.length)];
        await studioApi(`/studio/projects/${project.id}/canvases/${canvas.id}`, {
          method: "PATCH",
          body: jsonBody({ nodes }),
        });
        return { projectId: project.id, canvasId: canvas.id };
      });
      await refresh();
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  function addField() {
    setForm((current) => ({
      ...current,
      fields: [
        ...current.fields,
        { id: `field_${current.fields.length + 1}`, label: "新字段", type: "text", required: false },
      ] as WorkflowField[],
    }));
  }
  function addStage() {
    setForm((current) => ({
      ...current,
      stages: [
        ...current.stages,
        {
          id: `stage_${current.stages.length + 1}`,
          title: "新阶段",
          instruction: "",
          outputKind: "text",
          visibility: "preview",
        },
      ] as WorkflowStage[],
    }));
  }

  const runDefinition = run ? (run.definitionSnapshot ?? workflows.find((item) => item.id === run.workflowId)) : null;
  return (
    <AppShell>
      <div className={ui.page}>
        <header className={ui.header}>
          <div>
            <span className={ui.eyebrow}>REPEATABLE WORK</span>
            <h1 className={ui.title}>工作流</h1>
            <p className={ui.description}>将有效方法变成可重复的流程。使用者填表和审核，设计者管理节点与版本。</p>
          </div>
          <button
            className={ui.button}
            onClick={() => {
              setForm(newWorkflow);
              setEditing(true);
            }}
          >
            <Plus size={14} />
            创建工作流
          </button>
        </header>
        <div className={ui.tabs}>
          {(["discover", "mine", "runs"] as Tab[]).map((key) => (
            <button key={key} className={`${ui.tab} ${tab === key ? ui.tabActive : ""}`} onClick={() => setTab(key)}>
              {key === "discover" ? "发现" : key === "mine" ? "我的工作流" : "运行记录"}
            </button>
          ))}
        </div>
        {error && <p className={ui.error}>{error}</p>}
        {tab === "runs" ? (
          <div className={styles.runLayout}>
            <div className={styles.runList}>
              {runs.length === 0 ? (
                <div className={ui.empty}>还没有运行记录。</div>
              ) : (
                runs.map((item) => (
                  <button
                    key={item.id}
                    className={`${ui.card} ${styles.runItem} ${run?.id === item.id ? styles.runActive : ""}`}
                    onClick={() => {
                      setRun(item);
                      setReviewText("");
                    }}
                  >
                    <strong>
                      {item.definitionSnapshot?.title ||
                        workflows.find((def) => def.id === item.workflowId)?.title ||
                        "工作流"}
                    </strong>
                    <small>
                      {new Date(item.updatedAt).toLocaleString("zh-CN")} ·{" "}
                      {item.status === "awaiting_review"
                        ? "待审核"
                        : item.status === "succeeded"
                          ? "已完成"
                          : item.status === "cancelled"
                            ? "已终止"
                            : "运行中"}
                    </small>
                  </button>
                ))
              )}
            </div>
            <section className={`${ui.card} ${styles.runDetail}`}>
              {run && runDefinition ? (
                <>
                  <div className={ui.rowBetween}>
                    <div>
                      <span className={ui.eyebrow}>RUN DETAILS</span>
                      <h2 className={styles.detailTitle}>{runDefinition.title}</h2>
                      <p className={ui.cardText}>
                        版本 {run.workflowVersion} · {run.stages.length} 个阶段 · {run.status}
                      </p>
                    </div>
                    {run.status === "awaiting_review" && (
                      <button className={ui.buttonQuiet} onClick={() => void act("cancel")}>
                        <CirclePause size={14} />
                        终止运行
                      </button>
                    )}
                  </div>
                  <div className={styles.stages}>
                    {run.stages.map((stage, index) => {
                      const def = runDefinition.stages[index];
                      const ref = stage.assetRefs.at(-1);
                      const asset = assets.find((item) => item.id === ref?.assetId);
                      return (
                        <article key={stage.stageId} className={styles.stage}>
                          <div className={styles.stageNo}>{String(index + 1).padStart(2, "0")}</div>
                          <div className={styles.stageContent}>
                            <div className={ui.rowBetween}>
                              <strong>{def?.title || stage.stageId}</strong>
                              <span className={ui.badge}>
                                {stage.status === "waiting"
                                  ? "等待审核"
                                  : stage.status === "approved"
                                    ? "已采纳"
                                    : stage.status === "completed"
                                      ? "已完成"
                                      : "待运行"}
                              </span>
                            </div>
                            <p>{def?.instruction}</p>
                            {asset && def?.visibility !== "hidden" && (
                              <>
                                <pre className={styles.output}>
                                  {asset.versions.find((version) => version.id === ref?.versionId)?.content ||
                                    asset.versions.at(-1)?.content}
                                </pre>
                                <div className={styles.stageActions}>
                                  <span className={ui.meta}>
                                    资产 v{asset.versions.length} · 尝试 {stage.attempts} 次
                                  </span>
                                  <button onClick={() => void addToProject(asset)}>加入画布</button>
                                  <button
                                    onClick={() => {
                                      sessionStorage.setItem("weavl:agent-asset-id", asset.id);
                                      router.push("/agent");
                                    }}
                                  >
                                    交给 Agent
                                  </button>
                                  <button onClick={() => router.push("/assets")}>在资产中查看</button>
                                </div>
                              </>
                            )}
                            {stage.status === "waiting" && run.status === "awaiting_review" && (
                              <div className={styles.review}>
                                <textarea
                                  className={ui.textarea}
                                  value={reviewText}
                                  onChange={(event) => setReviewText(event.target.value)}
                                  placeholder="可选：编辑这版产物后采纳；留空则直接采纳"
                                />
                                <div className={ui.row}>
                                  <button
                                    className={ui.button}
                                    disabled={busy}
                                    onClick={() =>
                                      void act("decide", { action: "approve", content: reviewText || undefined })
                                    }
                                  >
                                    <Check size={14} />
                                    采纳并继续
                                  </button>
                                  <button
                                    className={ui.buttonQuiet}
                                    disabled={busy}
                                    onClick={() => void act("decide", { action: "retry" })}
                                  >
                                    <RotateCcw size={14} />
                                    重试本阶段
                                  </button>
                                </div>
                              </div>
                            )}
                            {stage.status !== "pending" && stage.status !== "waiting" && (
                              <button
                                className={styles.retryLink}
                                onClick={() => void act("retry", { stageId: stage.stageId })}
                              >
                                从此阶段重新运行下游
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className={ui.empty}>选择一条运行记录，查看阶段产物与审核状态。</div>
              )}
            </section>
          </div>
        ) : (
          <div className={`${ui.grid} ${styles.workflowGrid}`}>
            {visible.map((workflow) => (
              <article key={workflow.id} className={`${ui.card} ${styles.workflowCard}`}>
                <div className={ui.rowBetween}>
                  <span className={ui.badge}>{workflow.category}</span>
                  <span className={ui.meta}>
                    v{workflow.version} · {workflow.status === "published" ? "已发布" : "草稿"}
                  </span>
                </div>
                <div>
                  <h2 className={ui.cardTitle}>{workflow.title}</h2>
                  <p className={ui.cardText}>{workflow.description}</p>
                </div>
                <div className={styles.workflowStages}>
                  {workflow.stages.map((stage, index) => (
                    <span key={stage.id}>
                      {stage.title}
                      {index < workflow.stages.length - 1 && <ArrowRight size={11} />}
                    </span>
                  ))}
                </div>
                <div className={ui.rowBetween}>
                  <span className={ui.meta}>
                    {workflow.fields.length} 个输入 · {workflow.stages.length} 个阶段
                  </span>
                  <div className={ui.row}>
                    {workflow.ownerId === user?.id && (
                      <button
                        className={styles.textButton}
                        onClick={() => router.push(`/workflow?workflowId=${workflow.id}`)}
                      >
                        编辑节点
                      </button>
                    )}
                    <button
                      className={ui.buttonQuiet}
                      onClick={() => {
                        setActive(workflow);
                        setInputs({});
                        setProjectId("");
                      }}
                    >
                      使用 <ArrowUpRight size={13} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
            {visible.length === 0 && (
              <div className={ui.empty}>还没有工作流。创建并发布一个流程后即可使用表单运行。</div>
            )}
          </div>
        )}
        {active && (
          <div className={styles.overlay} onClick={() => setActive(null)}>
            <section className={styles.modal} onClick={(event) => event.stopPropagation()}>
              <div className={ui.rowBetween}>
                <div>
                  <span className={ui.eyebrow}>RUN WORKFLOW</span>
                  <h2 className={styles.detailTitle}>{active.title}</h2>
                </div>
                <button onClick={() => setActive(null)}>
                  <X size={18} />
                </button>
              </div>
              <p className={ui.cardText}>{active.description}</p>
              <div className={styles.formFields}>
                {active.fields.map((field) => (
                  <label key={field.id}>
                    <span className={ui.label}>
                      {field.label}
                      {field.required ? " *" : ""}
                    </span>
                    {field.type === "textarea" ? (
                      <textarea
                        className={ui.textarea}
                        value={inputs[field.id] || ""}
                        onChange={(event) => setInputs({ ...inputs, [field.id]: event.target.value })}
                      />
                    ) : field.type === "select" || field.type === "asset" ? (
                      <select
                        className={ui.select}
                        value={inputs[field.id] || ""}
                        onChange={(event) => setInputs({ ...inputs, [field.id]: event.target.value })}
                      >
                        <option value="">请选择</option>
                        {field.type === "asset"
                          ? assets.map((asset) => (
                              <option key={asset.id} value={asset.id}>
                                {asset.name} · {asset.source}
                              </option>
                            ))
                          : field.options?.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                      </select>
                    ) : (
                      <input
                        className={ui.input}
                        type={field.type === "number" ? "number" : "text"}
                        value={inputs[field.id] || ""}
                        onChange={(event) => setInputs({ ...inputs, [field.id]: event.target.value })}
                      />
                    )}
                  </label>
                ))}
                <label>
                  <span className={ui.label}>结果加入项目（可选）</span>
                  <select
                    className={ui.select}
                    value={projectId}
                    onChange={(event) => setProjectId(event.target.value)}
                  >
                    <option value="">暂不关联项目</option>
                    {projects.map((project) => (
                      <option value={project.id} key={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className={ui.rowBetween}>
                <span className={ui.meta}>当前为模拟运行 · 关键阶段可审核与重试</span>
                <button className={ui.button} disabled={busy} onClick={() => void startRun()}>
                  开始运行 <ArrowRight size={14} />
                </button>
              </div>
            </section>
          </div>
        )}
        {editing && (
          <div className={styles.overlay} onClick={() => setEditing(false)}>
            <section className={styles.modal} onClick={(event) => event.stopPropagation()}>
              <div className={ui.rowBetween}>
                <div>
                  <span className={ui.eyebrow}>WORKFLOW DESIGN</span>
                  <h2 className={styles.detailTitle}>创建工作流</h2>
                </div>
                <button onClick={() => setEditing(false)}>
                  <X size={18} />
                </button>
              </div>
              <div className={styles.formFields}>
                <label>
                  <span className={ui.label}>名称</span>
                  <input
                    className={ui.input}
                    value={form.title}
                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                  />
                </label>
                <label>
                  <span className={ui.label}>说明</span>
                  <textarea
                    className={ui.textarea}
                    value={form.description}
                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                  />
                </label>
                <label>
                  <span className={ui.label}>分类</span>
                  <input
                    className={ui.input}
                    value={form.category}
                    onChange={(event) => setForm({ ...form, category: event.target.value })}
                  />
                </label>
                <div className={ui.rowBetween}>
                  <strong>表单字段</strong>
                  <button className={ui.buttonQuiet} onClick={addField}>
                    <Plus size={12} />
                    字段
                  </button>
                </div>
                {form.fields.map((field, index) => (
                  <div className={styles.inlineForm} key={index}>
                    <input
                      className={ui.input}
                      value={field.id}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          fields: current.fields.map((value, i) =>
                            i === index ? { ...value, id: event.target.value } : value,
                          ),
                        }))
                      }
                      placeholder="字段 ID"
                    />
                    <input
                      className={ui.input}
                      value={field.label}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          fields: current.fields.map((value, i) =>
                            i === index ? { ...value, label: event.target.value } : value,
                          ),
                        }))
                      }
                      placeholder="标签"
                    />
                    <select
                      className={ui.select}
                      value={field.type}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          fields: current.fields.map((value, i) =>
                            i === index ? { ...value, type: event.target.value as WorkflowField["type"] } : value,
                          ),
                        }))
                      }
                    >
                      <option value="text">文本</option>
                      <option value="textarea">长文本</option>
                      <option value="number">数字</option>
                      <option value="select">选择</option>
                      <option value="asset">资产</option>
                    </select>
                    <button
                      type="button"
                      className={ui.buttonDanger}
                      onClick={() =>
                        setForm((current) => ({ ...current, fields: current.fields.filter((_, i) => i !== index) }))
                      }
                    >
                      移除
                    </button>
                    {field.type === "select" && (
                      <input
                        className={ui.input}
                        value={field.options?.join("、") || ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            fields: current.fields.map((value, i) =>
                              i === index
                                ? {
                                    ...value,
                                    options: event.target.value
                                      .split(/[、,，]/)
                                      .map((option) => option.trim())
                                      .filter(Boolean),
                                  }
                                : value,
                            ),
                          }))
                        }
                        placeholder="选项，以顿号分隔"
                      />
                    )}
                  </div>
                ))}
                <div className={ui.rowBetween}>
                  <strong>运行阶段</strong>
                  <button className={ui.buttonQuiet} onClick={addStage}>
                    <Plus size={12} />
                    阶段
                  </button>
                </div>
                {form.stages.map((stage, index) => (
                  <div className={styles.stageForm} key={index}>
                    <div className={styles.inlineForm}>
                      <input
                        className={ui.input}
                        value={stage.id}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            stages: current.stages.map((value, i) =>
                              i === index ? { ...value, id: event.target.value } : value,
                            ),
                          }))
                        }
                        placeholder="阶段 ID"
                      />
                      <input
                        className={ui.input}
                        value={stage.title}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            stages: current.stages.map((value, i) =>
                              i === index ? { ...value, title: event.target.value } : value,
                            ),
                          }))
                        }
                        placeholder="阶段名称"
                      />
                      <select
                        className={ui.select}
                        value={stage.visibility}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            stages: current.stages.map((value, i) =>
                              i === index
                                ? { ...value, visibility: event.target.value as WorkflowStage["visibility"] }
                                : value,
                            ),
                          }))
                        }
                      >
                        <option value="hidden">隐藏</option>
                        <option value="summary">摘要</option>
                        <option value="preview">预览</option>
                        <option value="review">审核</option>
                      </select>
                      <select
                        className={ui.select}
                        value={stage.outputKind}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            stages: current.stages.map((value, i) =>
                              i === index
                                ? { ...value, outputKind: event.target.value as WorkflowStage["outputKind"] }
                                : value,
                            ),
                          }))
                        }
                      >
                        <option value="text">文本</option>
                        <option value="image">图片</option>
                        <option value="video">视频</option>
                        <option value="audio">音频</option>
                        <option value="pdf">PDF</option>
                        <option value="word">Word</option>
                        <option value="ppt">PPT</option>
                        <option value="file">文件</option>
                      </select>
                      <button
                        type="button"
                        className={ui.buttonDanger}
                        disabled={form.stages.length === 1}
                        onClick={() =>
                          setForm((current) => ({ ...current, stages: current.stages.filter((_, i) => i !== index) }))
                        }
                      >
                        移除
                      </button>
                    </div>
                    <input
                      className={ui.input}
                      value={stage.instruction}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          stages: current.stages.map((value, i) =>
                            i === index ? { ...value, instruction: event.target.value } : value,
                          ),
                        }))
                      }
                      placeholder="处理说明"
                    />
                  </div>
                ))}
              </div>
              <button className={ui.button} onClick={() => void saveDefinition()}>
                创建并发布
              </button>
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
