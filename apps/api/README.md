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

火山、阿里和 ZenMux 可以通过独立环境变量接入。更多渠道使用 `WEAVL_MODEL_CHANNELS_JSON`：

```json
[
  {
    "id": "channel.zenmux.backup",
    "provider": "zenmux",
    "modelKind": "text",
    "modelId": "weavl-text",
    "remoteModel": "provider-model-name",
    "label": "ZenMux 备用",
    "baseUrl": "https://example.com/v1",
    "apiKeyEnv": "ZENMUX_BACKUP_API_KEY",
    "priority": 20,
    "failureThreshold": 3,
    "cooldownSeconds": 60
  }
]
```

`apiKeyEnv` 只保存密钥所在的环境变量名，数据库和配置 JSON 都不保存密钥明文。调用历史可通过 `GET /api/studio/integrations/history` 查看，`GET /api/studio/integrations/metrics?hours=24` 返回渠道成功率和平均延迟；未配置真实渠道时，文本生成保留本地模拟响应，现有页面仍可完整运行。
