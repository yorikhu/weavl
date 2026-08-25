import { AppShell } from "@/components/app-shell";
import { Coins } from "lucide-react";

const MARKET_ITEMS = [
  { title: "35mm 胶片质感调色 Skill", type: "Skill", author: "ColorLab", uses: "14.2k", price: 0, desc: "模拟柯达经典暖调胶片颗粒与色散" },
  { title: "电商服装高转化分镜 Prompt", type: "Prompt", author: "Weavl 官方", uses: "32.8k", price: 20, desc: "精准控制服装特写、材质光泽与动态走秀" },
  { title: "4K 人物皮肤超分辨率重绘", type: "Skill", author: "PixelMaster", uses: "8.9k", price: 50, desc: "保持五官一致性下的微距毛孔与高光修复" },
  { title: "国风水墨意境粒子流动", type: "Prompt", author: "墨客", uses: "19.1k", price: 0, desc: "传统水墨晕染与现代 3D 深度光影结合" },
  { title: "自动生成双语字幕与配音 Skill", type: "Skill", author: "AudioGen", uses: "27.4k", price: 10, desc: "智能对齐唇形与专业旁白合成" },
  { title: "赛博朋克霓虹夜景工作流", type: "Prompt", author: "NeoTokyo", uses: "11.5k", price: 30, desc: "雨夜地面反射、全息霓虹与暗部细节增强" },
] as const;

export default function MarketPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] space-y-6">
        <div>
          <h2 className="text-lg font-bold">织光资源市场 (Market)</h2>
          <p className="text-xs text-muted-foreground">
            精选高质感提示词 (Prompts) 与垂直工程技能 (Skills)
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {MARKET_ITEMS.map((item) => (
            <div
              key={item.title}
              className="flex flex-col justify-between space-y-4 rounded-2xl border border-border bg-card p-5 transition-all hover:border-border-strong hover:bg-card-hover"
            >
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      item.type === "Skill"
                        ? "border border-blue-500/20 bg-blue-500/10 text-blue-400"
                        : "border border-[var(--accent-soft)] bg-[var(--accent-soft)] text-[var(--accent)]"
                    }`}
                  >
                    {item.type}
                  </span>
                  <div className="flex items-center gap-1 text-xs font-bold text-[var(--accent)]">
                    {item.price > 0 && <Coins className="h-3 w-3" />}
                    <span>{item.price > 0 ? `${item.price} 积分` : "免费"}</span>
                  </div>
                </div>
                <h4 className="mb-1 text-sm font-bold">{item.title}</h4>
                <p className="text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
                <span className="text-muted-foreground">
                  {item.author} · {item.uses} 次使用
                </span>
                <button className="rounded-xl border border-border-strong bg-[var(--foreground)] px-3 py-1.5 font-medium text-[var(--background)] transition-all hover:opacity-90">
                  立即使用
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
