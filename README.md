# Weavl

以资产为连接层的创作与自动化工作台。六个入口是首页、项目、Weavl Agent、市场、工作流与资产；项目可包含多张画布，Agent 会话和工作流运行可独立存在。

## 本地运行

需要 Node.js 22+ 和 pnpm 11。

```bash
pnpm install --ignore-scripts
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
pnpm dev
```

Web: `http://localhost:3000`；API: `http://localhost:3001/api`。本地演示账号为 `demo@weavl.local / weavl1234`，也可以注册新账号。修改演示密码请在首次启动前设置 `WEAVL_DEMO_PASSWORD`。

## 当前可验证的闭环

- 登录、注册、7 天 HttpOnly Session、退出；密码以 bcrypt 哈希保存。
- 原有账户胶囊与菜单保留，积分、套餐和资产容量读取持久化账户数据；套餐可提交开通意向，通知可标记已读。当前套餐容量是演示配置，支付、发票和真实积分扣费尚未接入。
- Agent 历史会话、归档、重命名、引用已有资产、选择提示词或 Skill、生成模拟文本资产、从会话创建项目。
- 项目与多画布创建、打开、自动保存节点／连线／视口；画布可引用资产，也可从 Agent 抽屉生成新资产。新增画布文本和媒体内容会登记到资产库。
- 市场的官方条目与私有提示词／Skill 创建、编辑、删除和版本号。
- 工作流定义、表单字段、阶段可见级别、模拟运行、关键阶段审核／编辑／重试／终止、历史记录和产物资产化；原有节点编辑器可保存图快照。
- 资产上传、预览、下载、来源筛选、搜索、文件夹、重命名、回收站与加入画布。

Mock API 使用 `zod` 校验请求、`bcryptjs` 处理密码、`dotenv` 加载配置，业务状态写入 `apps/api/data/weavl.mock.json`。此文件被 Git 忽略，重启 API 后仍可恢复本地数据。上传在演示模式下限制单文件 5 MB；不适合多人并发或生产部署。

## 扩展边界

前后端对象契约在 `packages/shared/src/studio.ts`。API 的 `studio` 模块按身份、资产、项目、会话、市场和工作流划分；页面通过 `studioApi` 统一访问。`apps/api/.env.example` 预留 PostgreSQL、Redis、对象存储、火山、阿里与 Zenmux 配置。当前这些连接**尚未激活**；`GET /api/studio/integrations` 仅返回安全的配置状态。接入真实供应商时应实现独立的存储、队列与模型适配器，并替换同步 JSON 存储和模拟生成器。

```bash
pnpm typecheck
pnpm lint
pnpm build
```

若 `pnpm build` 与正在运行的 Next 开发服务共享 `.next` 目录而报缓存冲突，请停止开发服务或在独立工作目录构建。
