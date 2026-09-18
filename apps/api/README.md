# Weavl API

## 模块边界

后端采用 NestJS 的功能模块组织方式。与业务能力对应的代码全部进入 `src/modules`：

- `auth`、`account`：身份、Session、套餐和积分。
- `projects`：项目及多画布持久化。
- `assets`：项目产物与全局资产元数据。
- `conversations`：Agent 会话和消息。
- `skills`：Skill 市场与个人 Skill。
- `workflows`：工作流定义、运行、审核和重试。
- `integrations`：模型渠道注册、路由、熔断和调用历史。
- `generations`：面向业务的生成入口。
- `templates`、`runs`：旧预设页面的兼容模块，运行状态同样写入 PostgreSQL。

`src/infrastructure` 只承载技术设施：Prisma、Redis、MinIO 和旧 JSON 的一次性迁移器。`src/common` 只放无业务归属的 HTTP、ID 等基础能力。这样新增业务域时可以增加模块，替换存储或供应商时无需改动页面领域逻辑。

## Prisma

数据模型在 `prisma/schema.prisma`，迁移在 `prisma/migrations`。应用代码统一注入 `PrismaService`，不要直接创建新的 `PrismaClient`，也不要在 Controller 中拼 SQL。

```bash
pnpm --filter @weavl/api db:migrate
pnpm --filter @weavl/api db:deploy
pnpm --filter @weavl/api db:studio
```

开发环境使用 `prisma migrate dev` 生成迁移；部署环境只运行 `prisma migrate deploy`，不要使用 `db push` 绕过迁移历史。

## 本地依赖

`.env.example` 默认连接：

- PostgreSQL：`127.0.0.1:5432/weavl`
- Redis：`127.0.0.1:6379`
- MinIO API：`127.0.0.1:9000`
- MinIO bucket：`weavl`

服务启动时会检查 Redis 连接并创建缺失的 MinIO bucket。`GET /api/health` 会分别报告 PostgreSQL、Redis 和 MinIO 状态。

## 模型与 API 渠道

`integrations` 将前端使用的逻辑模型与供应商的实际模型分开。一项逻辑模型可以配置多个渠道；路由按 `priority` 从小到大尝试，记录耗时、状态码和失败原因。渠道连续失败达到 `failureThreshold` 后，会在 `cooldownSeconds` 内暂时跳过，并自动尝试下一渠道。

GPT Image 2 使用 GeekNow 的 OpenAI Images 兼容接口 `https://api.geeknow.ai/v1`。ZenMux 的历史服务商和渠道配置暂时保留在数据库中，但服务商与全部渠道均已停用，不会参与生成或价格同步。模型、服务商、远端模型名、协议、BaseURL 和路由参数全部维护在 PostgreSQL；服务启动不会从环境变量覆盖这些配置。`.env` 只保存当前启用服务商的密钥和请求超时。未配置密钥的服务商不会进入候选路由。

平台使用稳定的内部 `modelId`。同一模型可以关联多个供应渠道，每条渠道分别维护 `remoteModel`、`protocol`、`baseUrl`、优先级和熔断参数，因此后续接入直连供应商不需要修改画布数据。`protocol` 首批支持 `openai-chat`、`openai-image`、`vertex-image`、`vertex-generate-content` 和 `vertex-video`。

基础配置接口位于 `/api/studio/integrations`，当前由登录会话保护；后台账号体系完成后需替换为管理员权限守卫：

- `GET|POST /providers`、`PATCH|DELETE /providers/:id`：查询和维护服务商及密钥环境变量引用。
- `GET|POST /models`、`PATCH|DELETE /models/:id`：查询和维护平台模型及能力参数。
- `GET|POST /channels`、`PATCH|DELETE /channels/:id`：查询和维护 BaseURL、远端模型名及路由策略。
- `GET /history`：查看最近调用记录。
- `GET /metrics?hours=24`：查看成功率、调用量和平均延迟。
- `POST /providers/:id/prices/sync`：人工拉取一次供应商成本目录；不会调整用户积分价格。
- `GET /providers/:id/prices/history`：查看人工同步结果、变更数量和缺失模型。
- `GET /channels/:id/cost-history`：查看单条渠道的供应商成本历史版本。

数据库只保存 `apiKeyEnv`，不保存 API Key 明文。调用时由 API 进程读取对应环境变量；以后接入密钥管理服务时只需替换凭据解析层。

供应商成本同步目前只支持人工触发，没有定时任务。同步结果写入渠道的 `costPricing`，变化时追加 `ChannelCostVersion`。人工维护的 `ModelPricingRule` 优先级最高；没有人工规则时，系统使用已同步的渠道成本和全局计费策略自动报价。

媒体生成接口：

- `GET /api/studio/generations/models?kind=image|video`：获取模型目录与配置状态。
- `POST /api/studio/generations/image`：创建图片任务、预扣积分并写入 BullMQ，立即返回 `jobId`。
- `GET /api/studio/generations/image/:jobId`：查询图片任务，完成后返回项目产物；不会自动进入全局资产库。
- `POST /api/studio/generations/video`：提交视频任务并持久化到 `generation_jobs`。
- `GET /api/studio/generations/video/:jobId`：轮询任务，完成后落库产物。

所有后台任务共用 `generation-tasks` 队列，载荷通过 `kind` 区分文本、图片、视频、音频、数字人、文档和工作流；当前图片处理器已接入，其他处理器可以按相同契约注册。任务状态以 PostgreSQL 的业务任务表为准，BullMQ 和 Redis 只承担可靠调度。生产环境由 Compose 中独立的 `worker` 服务消费任务，API 通过 `WEAVL_RUN_GENERATION_WORKER=false` 禁止抢占消费；本地开发默认由 API 进程内置消费。Worker 重启时会恢复尚未完成的队列任务，任务完成、失败退款和积分结算均按任务 ID 幂等处理。

## 模型积分计费

默认计费策略保存在 `billing_policies`：1 积分价值 `¥0.035`、成本加价率 `10%`、美元兑人民币汇率 `7.2`。成本报价按以下公式计算：

```text
目标售价（元） = 供应商成本（元） × (1 + 10%)
消费积分       = ceil(目标售价 ÷ 0.035)
```

积分只允许整数，因此单次低成本调用向上取整后，实际加价率可能高于 10%。报价响应会同时返回 `costCny`、`targetSaleCny`、`chargedValueCny` 和 `effectiveMarkupRate`，便于后台核对取整造成的差额。自动路由会按可用渠道中的较高成本预授权，避免故障切换后出现成本倒挂；实际调用完成后使用命中的渠道结算。

Token 模型在页面展示输入、输出等每百万 Token 的积分单价，不展示容易误导的单次积分数。文本接口会读取供应商同步返回的 `usage`，按真实输入、缓存输入和输出 Token 多退少补。ZenMux 的异步媒体账单需要在生成完成约 3–5 分钟后通过 generation 查询接口获取；相关模型当前展示“生成后结算”，后续由持久化对账任务完成最终扣费。

模型积分不写死在代码中。`model_pricing_rules` 通过 `conditions` 匹配分辨率、画质等参数，`unitField` 指定数量或时长字段，最终积分为 `max(minimumCredits, creditsPerUnit × units)`。空条件可作为模型默认规则，数字越小的 `priority` 越先匹配。

例如，以下规则表示该模型在 4K 画质下每张消耗 8 积分：

```json
{
  "modelId": "gpt-image-2.5-flare",
  "name": "4K 图片",
  "conditions": { "resolution": "4K" },
  "unitField": "count",
  "creditsPerUnit": 8,
  "minimumCredits": 8,
  "priority": 10
}
```

- `GET|POST /api/studio/billing/pricing-rules`、`PATCH|DELETE /pricing-rules/:id`：维护模型价格。
- `GET|PATCH /api/studio/billing/policy`：查询或维护积分人民币价值、成本加价率和美元汇率。
- `POST /api/studio/billing/quote`：按模型和参数试算积分，不扣费。
- `GET /api/studio/billing/usage`：查询当前用户的生成用量与计价快照。
- `GET /api/studio/billing/ledger`：查询当前用户的积分扣除和返还流水。

固定价格模型生成前会原子预扣积分；同步任务成功后确认消费，失败则返还。文本 Token 模型先按输出上限预扣，成功后根据供应商返回的实际 Token 用量多退少补。异步视频在任务完成后确认消费，提交或生成失败时返还。每条用量会保存输入、价格和实际用量快照，因此后续调价不会改变历史账单。

报价示例：

```http
POST /api/studio/billing/quote
Content-Type: application/json

{
  "modelId": "kimi-k2.8-preview",
  "parameters": { "maxOutputTokens": 1000 }
}
```

Token 模型响应中的 `meteredRates` 已包含汇率和 10% 加价，可直接在前端展示；`creditsPerMTokens` 的单位是“积分 / 百万 Token”。
