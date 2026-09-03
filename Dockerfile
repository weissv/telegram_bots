FROM node:22-alpine AS base
WORKDIR /app
RUN npm install -g pnpm@11.24.0

FROM base AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @telegram-commerce/database db:generate
RUN pnpm --filter @telegram-commerce/config build
RUN pnpm --filter @telegram-commerce/i18n build
RUN pnpm --filter @telegram-commerce/database build
RUN pnpm --filter @telegram-commerce/payments build
RUN pnpm --filter @telegram-commerce/telegram-engine build
RUN pnpm --filter @telegram-commerce/api build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g pnpm@11.24.0

COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/ ./packages/
COPY --from=builder /app/apps/api/ ./apps/api/
COPY --from=builder /app/node_modules/ ./node_modules/

EXPOSE 3000
CMD ["sh", "-c", "echo '🔄 Applying Prisma DB schema...' && pnpm --filter @telegram-commerce/database db:push --accept-data-loss && echo '🚀 Starting API...' && node apps/api/dist/index.js"]
