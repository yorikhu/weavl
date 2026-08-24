import { verticalOf, type TemplateManifest } from "@loom/shared";

// 第一个花样的 manifest 雏形 —— 后续将移入模板包注册中心
const firstTemplate: Pick<
  TemplateManifest,
  "id" | "name" | "category" | "cost" | "price"
> = {
  id: "ecom.product-image",
  name: "产品白底图",
  category: "image",
  cost: { min: 0.3, max: 0.8 },
  price: "free",
};

export default function Home() {
  const vertical = verticalOf(firstTemplate.id);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-5xl font-semibold tracking-wide">织光</h1>
        <p className="text-sm opacity-60">
          The Loom is the loom · 把 AI 之光，一梭一梭织成作品
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 px-6 py-4 text-sm backdrop-blur">
        <p className="mb-2 opacity-60">第一个花样（模板包雏形）</p>
        <p>
          <span className="font-mono">{firstTemplate.id}</span> ·{" "}
          {firstTemplate.name} · vertical = <span className="font-mono">{vertical}</span>
        </p>
        <p className="mt-1 opacity-60">
          单次预估成本 ¥{firstTemplate.cost.min} – ¥{firstTemplate.cost.max}
        </p>
      </div>

      <p className="text-xs opacity-40">
        web :3000 · api :3001 · monorepo by pnpm
      </p>
    </main>
  );
}
