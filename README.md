# Weavl

以项目画布为创作载体、以资产为连接层的 AIGC 工作台。首页、项目、Weavl Agent、市场、工作流与资产各自独立，产物通过项目资产和全局资产流转。

## 技术结构

- `apps/web`：Next.js 前端。
- `apps/api`：NestJS API。业务按功能域放在 `src/modules`，数据库、缓存和对象存储放在 `src/infrastructure`。
- `packages/shared`：前后端共享契约。
- PostgreSQL：业务数据的唯一事实来源，通过 Prisma ORM 访问。
- Redis：登录 Session 和短期缓存。
- MinIO：图片、视频、音频、PDF 等二进制资产；PostgreSQL 只保存元数据和对象键。

更完整的后端边界和模型渠道配置见 [API 文档](apps/api/README.md)。

## 本地运行

需要 Node.js 22+、pnpm 11 和 Docker。复制环境配置后先执行迁移：

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
pnpm dev:infra
pnpm --filter @weavl/api db:deploy
pnpm dev
```

`pnpm dev` 会先检查 PostgreSQL、Redis 和 MinIO：已经健康运行的容器会直接复用，缺失或停止的服务才会启动。只需启动应用进程时可运行 `pnpm dev:apps`；需要停止本地基础设施时运行 `pnpm dev:infra:stop`，数据卷会继续保留。

Web 地址为 `http://localhost:3000`，API 地址为 `http://localhost:3001/api`。内部测试阶段不开放注册；空数据库首次启动时会建立本地演示账号，账号和密码由 `WEAVL_DEMO_EMAIL`、`WEAVL_DEMO_PASSWORD` 配置。

如果本地保留旧版 `apps/api/data/weavl.mock.json`，首次连接空数据库时会自动导入一次。后续所有读写都进入 PostgreSQL、Redis 和 MinIO，JSON 文件不再参与运行。

## 数据库命令

```bash
pnpm --filter @weavl/api db:migrate  # 开发时创建迁移
pnpm --filter @weavl/api db:deploy   # 应用已有迁移
pnpm --filter @weavl/api db:studio   # 打开 Prisma Studio
```

## 验证

```bash
pnpm typecheck
pnpm lint
pnpm build
```
