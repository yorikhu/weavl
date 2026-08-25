import { AppShell } from "@/components/app-shell";
import { Grid, Sparkles, CheckCircle2 } from "lucide-react";

export default function CanvasPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Grid className="h-5 w-5 text-[var(--accent)]" />
              可视化编排画布 (Canvas)
            </h2>
            <p className="text-xs text-muted-foreground">
              工作流节点自定义，拖拽式编排，发布后将作为 WebUI 预设呈现给普通用户
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="rounded-xl border border-border bg-sub-card px-4 py-2 text-xs font-medium transition-all hover:border-border-strong">
              导入模板
            </button>
            <button className="rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-bold text-slate-950 transition-all hover:brightness-110">
              一键发布为预设 WebUI
            </button>
          </div>
        </div>

        {/* 画布占位：网格底纹 + 节点流示意 */}
        <div className="relative flex h-[620px] select-none items-center justify-center overflow-hidden rounded-3xl border border-border bg-[var(--sider)] p-8">
          <div className="absolute inset-0 opacity-15 bg-[radial-gradient(var(--border-strong)_1px,transparent_1px)] [background-size:24px_24px]" />

          <div className="relative z-10 flex flex-wrap items-center justify-center gap-12">
            {[
              { title: "Input (用户输入)", tone: "default", rows: [["主文案", "商品核心卖点"], ["比例", "9:16 (竖屏短视频)"]] },
              { title: "Skill 算子调度", tone: "accent", rows: [["模型", "Weavl-Visual-XL"], ["镜头组", "4段分镜流水线"]] },
              { title: "Output (阶段交付)", tone: "success", rows: [["产物", "4K 商业视频 + 音轨"], ["耗时", "~45 秒"]] },
            ].map((node, i) => (
              <div key={node.title} className="flex items-center gap-12">
                {i > 0 && (
                  <div className="relative h-0.5 w-8 bg-border-strong">
                    <div className="absolute top-1/2 right-0 h-1.5 w-1.5 -translate-y-1/2 rotate-45 bg-muted-foreground" />
                  </div>
                )}
                <div
                  className={`w-56 rounded-2xl border bg-card p-4 shadow-xl ${
                    node.tone === "accent"
                      ? "ring-1 ring-[var(--accent-soft)]"
                      : node.tone === "success"
                        ? ""
                        : ""
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span
                      className={`text-xs font-bold ${
                        node.tone === "accent"
                          ? "text-[var(--accent)]"
                          : node.tone === "success"
                            ? "text-[var(--success)]"
                            : ""
                      }`}
                    >
                      {node.title}
                    </span>
                    {node.tone === "accent" ? (
                      <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
                    ) : node.tone === "success" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-[var(--success)]" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-[var(--success)]" />
                    )}
                  </div>
                  <div className="space-y-2 text-[11px]">
                    {node.rows.map(([k, v]) => (
                      <div key={k} className="rounded-lg border border-[var(--sub-card-border)] bg-sub-card p-2">
                        <span className="text-muted-foreground">{k}: </span>
                        <span>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
