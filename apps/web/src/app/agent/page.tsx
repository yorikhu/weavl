import { AppShell } from "@/components/app-shell";
import { Bot, Send } from "lucide-react";

export default function AgentPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-[1100px]">
        <div className="flex h-[700px] flex-col overflow-hidden rounded-3xl border border-border shadow-2xl">
          {/* Agent 头部 */}
          <div className="frost-header flex items-center justify-between border-b border-border p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-950">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold">织光官方导演 Agent</h3>
                <p className="text-[10px] text-muted-foreground">
                  具备全局上下文感知能力 · 支持精准局部调优与重算
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[var(--success)]" />
              <span className="text-xs text-muted-foreground">在线就绪</span>
            </div>
          </div>

          {/* 消息流（静态示意） */}
          <div className="flex-1 space-y-4 overflow-y-auto bg-[var(--sider)] p-6">
            <div className="flex max-w-[80%] items-start gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-2xl border border-border bg-card p-4 text-xs leading-relaxed">
                <p className="mb-1 font-medium">你好！我是你的专属织光导演。</p>
                <p className="text-muted-foreground">
                  你可以告诉我你的创作主题（如&ldquo;打造一组法式复古夏季短视频&rdquo;），我将为你自动推荐最佳工作流预设、拆解分镜参数，并协助你进行单镜头微调。
                </p>
              </div>
            </div>
          </div>

          {/* 输入区 */}
          <div className="frost-header flex items-center gap-3 border-t border-border p-4">
            <input
              type="text"
              placeholder="与织光导演交流创意，按 Enter 发送..."
              className="flex-1 rounded-xl border border-[var(--input-border)] bg-[var(--input)] px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-border-strong"
            />
            <button className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 p-3 text-slate-950 transition-all hover:brightness-110">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
