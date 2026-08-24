# loom

> 内部代号 **loom** · 对外品牌 **织光 (Zhiguang)** · The Loom is the loom.

AIGC content production studio. Every template is a declarative, model-agnostic workflow pack — add a new vertical by shipping data, not code.

## 架构

```
loom/
├── apps/
│   ├── web/          # Next.js — 织光台（工作台 / 模板商店 / 结果展示）
│   └── api/          # Nest.js — 编排层（工作流运行时 / 队列 / 模型抽象）
└── packages/
    └── shared/       # 前后端共享契约（TemplateManifest / Step / ModelRef）
```

**核心决策：垂直 = 数据，不是代码。** 每个垂直是一份模板包（manifest + prompts + assets），通过注册中心接入，不改核心代码。

## 快速开始

```bash
pnpm install
pnpm dev        # 并行启动 web + api
pnpm dev:web    # 仅前端  http://localhost:3000
pnpm dev:api    # 仅后端  http://localhost:3000/api
```

## 语言体系

| 中文 | 英文 | 含义 |
|---|---|---|
| 织光台 | Studio | 工作台 |
| 花样 | template pack | 模板包 |
| 织法 | workflow | 工作流 |
| 一梭 | step | 步骤 |
| 丝线 | asset | 素材 |
| 织品 | artifact | 成片 |
| 织光师 | weaver | 用户 |
| 开织 | run | 运行任务 |
