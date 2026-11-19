FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS dependencies
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

FROM dependencies AS builder
COPY packages/shared/ ./packages/shared/
COPY apps/web/ ./apps/web/
RUN pnpm --filter @snackflow/shared build
RUN pnpm --filter @snackflow/web build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app/apps/web
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/packages/shared /app/packages/shared
COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/apps/web/package.json ./package.json

EXPOSE 3000
CMD ["pnpm", "start"]
