FROM node:22-bookworm-slim AS builder

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.7.0 --activate
ARG NPM_REGISTRY=https://registry.npmjs.org
RUN pnpm config set registry "${NPM_REGISTRY}"

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json tsconfig.base.json
COPY apps/web apps/web
COPY packages/shared packages/shared
ARG NEXT_PUBLIC_API_URL=/api
ARG NEXT_PUBLIC_ASSET_PREFIX=
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_ASSET_PREFIX=${NEXT_PUBLIC_ASSET_PREFIX}
RUN pnpm --filter @weavl/shared build && pnpm --filter @weavl/web build

FROM nginx:1.27-alpine AS runner
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/out /usr/share/nginx/html

EXPOSE 80
