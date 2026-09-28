# Weavl 生产部署

## 架构

- `web`：Nginx 托管 Next.js 静态导出，并将 `/api` 反向代理到 NestJS。
- `api`：NestJS 生产构建。
- `migrate`：API 启动前执行 `prisma migrate deploy`，成功后退出。
- `postgres`：业务数据唯一事实来源。
- `redis`：Session、登录限制和短期缓存。
- `minio`：图片、视频及文档对象存储。

MinIO 镜像由 `deploy/minio/Dockerfile` 从固定的官方源码 release 和 commit 构建，避免依赖已经停止公开分发的上游预构建镜像。更新版本时必须同时更新并核对 release 与完整 commit。

PostgreSQL、Redis、MinIO S3 API 和 MinIO Console 均不直接暴露公网端口。Nginx 通过 `/weavl/*` 代理带签名的媒体访问，服务器安全组只需开放 `22` 和 `80`。

## 首次部署

```bash
cd /opt/weavl
cp deploy/.env.example .env
chmod 600 .env
# 修改所有 replace-with... 密码，并填写 ZENMUX_API_KEY
docker compose build
docker compose up -d
docker compose ps
curl --fail http://127.0.0.1/api/health
```

访问地址为 `http://服务器IP`。使用 IP 且未配置 TLS 时，`WEAVL_COOKIE_SECURE` 必须为 `false`；接入 HTTPS 域名后改为 `true`。

如果部署服务器访问 npm 或 Debian 官方源较慢，可在 `.env` 中调整 `NPM_REGISTRY`、`DEBIAN_MIRROR` 和 `DEBIAN_SECURITY_MIRROR`。这些配置只影响镜像构建，不改变应用运行时行为。

## 更新

```bash
cd /opt/weavl
git pull --ff-only
docker compose build
docker compose up -d --remove-orphans
docker image prune -f
```

数据库和对象文件保存在 Compose 命名卷中，重新构建容器不会丢失。不要使用 `docker compose down -v`，该命令会删除所有持久化数据。

## 排查

```bash
docker compose ps
docker compose logs --tail=200 api
docker compose logs --tail=200 migrate
docker compose logs --tail=200 postgres redis minio
curl --fail http://127.0.0.1/api/health
```
