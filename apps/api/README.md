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

首批文本、图片和视频模型已通过 ZenMux 接入。只需在 `.env` 中填写 `ZENMUX_API_KEY`；OpenAI Chat 与 Vertex AI 端点已有默认值，也可以分别通过 `ZENMUX_BASE_URL`、`ZENMUX_VERTEX_BASE_URL` 覆盖。
模型目录集中维护在 `src/modules/integrations/model-catalog.ts`，当前包含 4 个文本模型、4 个图片模型和 4 个视频模型，以及每种模态的 Weavl 自动路由入口。

平台使用稳定的内部 `modelId`，供应商渠道保存自己的 `remoteModel` 和 `protocol`。后续接入直连供应商时，为同一个 `modelId` 增加渠道即可参与优先级路由与故障切换，无需修改画布数据。更多渠道使用 `WEAVL_MODEL_CHANNELS_JSON`：
渠道首次注册后，`priority`、`enabled`、`failureThreshold` 和 `cooldownSeconds` 由数据库保留，服务重启不会覆盖运维调整。

```json
[
  {
    "id": "channel.direct.deepseek",
    "provider": "deepseek",
    "protocol": "openai-chat",
    "modelKind": "text",
    "modelId": "deepseek-v4.1-flash",
    "remoteModel": "deepseek-v4.1-flash",
    "label": "DeepSeek 直连",
    "baseUrl": "https://example.com/v1",
    "apiKeyEnv": "DEEPSEEK_API_KEY",
    "priority": 5,
    "failureThreshold": 3,
    "cooldownSeconds": 60
  }
]
```

`protocol` 首批支持 `openai-chat`、`vertex-image`、`vertex-generate-content` 和 `vertex-video`。`apiKeyEnv` 只保存密钥所在的环境变量名，数据库和配置 JSON 都不保存密钥明文。调用历史可通过 `GET /api/studio/integrations/history` 查看，`GET /api/studio/integrations/metrics?hours=24` 返回渠道成功率和平均延迟；未配置真实渠道时，文本生成保留本地模拟响应。

媒体生成接口：

- `GET /api/studio/generations/models?kind=image|video`：获取模型目录与配置状态。
- `POST /api/studio/generations/image`：同步生成图片并保存为项目产物，不会自动进入全局资产库。
- `POST /api/studio/generations/video`：提交视频任务并持久化到 `generation_jobs`。
- `GET /api/studio/generations/video/:jobId`：轮询任务，完成后落库产物。
