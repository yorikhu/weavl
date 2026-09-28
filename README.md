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

需要 Node.js 22+、pnpm 11 和 Docker。全新克隆后运行：

```bash
pnpm install
pnpm dev
```

`pnpm dev` 会在首次运行时从示例创建本地 `.env`（不会覆盖已有配置），检查并按需启动 Docker，构建项目固定版本的 MinIO，然后等待 PostgreSQL、Redis、MinIO 健康并自动应用数据库迁移。macOS 上 Docker Desktop 未运行时会自动后台启动并等待就绪。

MinIO 从官方源码的固定 release 和 commit 在本地构建，不依赖已停止公开分发的 `minio/minio` 镜像。首次构建需要下载 Go 构建镜像和源码，之后会复用 Docker 构建缓存。网络环境需要自定义 Go 模块代理时，可在根目录 `.env` 中设置 `GOPROXY`。

只需启动应用进程时可运行 `pnpm dev:apps`。运行 `pnpm dev:stop` 可释放前后端的 3000、3001 端口，并停止 PostgreSQL、Redis 和 MinIO；数据卷会继续保留。只停止基础设施时可运行 `pnpm dev:infra:stop`。

Web 地址为 `http://localhost:3000`，API 地址为 `http://localhost:3001/api`，MinIO Console 地址为 `http://localhost:19001`。为避免与宿主机上常见服务冲突，开发环境默认将 PostgreSQL、Redis、MinIO API 和 MinIO Console 分别映射到 `15432`、`16379`、`19000`、`19001`；可在 `deploy/dev.env` 中调整。内部测试阶段不开放注册；空数据库首次启动时会建立本地演示账号，账号和密码由 `WEAVL_DEMO_EMAIL`、`WEAVL_DEMO_PASSWORD` 配置。

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
