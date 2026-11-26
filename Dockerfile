# See docker/Dockerfile.api. This image copies node_modules, which includes
# esbuild binaries compiled with a vulnerable Go stdlib.
FROM golang:1.26.11-alpine@sha256:ecb67f987aa1a57794c91d19ade7ae0209f2f0f5496aaef9e6ae85ddf92d02ab AS esbuild-stdlib
RUN apk add --no-cache git ca-certificates
WORKDIR /src
ENV CGO_ENABLED=0 \
    GOFLAGS=-trimpath \
    GOTOOLCHAIN=local
RUN set -eu; \
    mkdir -p /out; \
    for v in 0.21.5 0.25.12 0.28.2; do \
      git clone --depth 1 --branch "v${v}" https://github.com/evanw/esbuild.git "esbuild-${v}"; \
      (cd "esbuild-${v}" && go build -o "/out/esbuild-${v}" ./cmd/esbuild); \
      ver_out=$(go version -m "/out/esbuild-${v}"); \
      printf '%s\n' "$ver_out" | grep -q 'go1\.26\.11'; \
      built=$("/out/esbuild-${v}" --version); \
      [ "$built" = "$v" ]; \
    done

FROM node:22-alpine AS base
WORKDIR /app
RUN apk upgrade --no-cache \
    && npm install -g pnpm@11.24.0

FROM base AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

RUN pnpm install --frozen-lockfile=false
COPY docker/patch-esbuild-stdlib.sh /tmp/patch-esbuild-stdlib.sh
COPY --from=esbuild-stdlib /out/ /opt/esbuild-stdlib/
RUN sh /tmp/patch-esbuild-stdlib.sh /app/node_modules /opt/esbuild-stdlib \
    && rm -rf /opt/esbuild-stdlib /tmp/patch-esbuild-stdlib.sh
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
RUN apk upgrade --no-cache \
    && apk add --no-cache curl \
    && npm install -g pnpm@11.24.0

COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/ ./packages/
COPY --from=builder /app/apps/api/ ./apps/api/
COPY --from=builder /app/node_modules/ ./node_modules/

EXPOSE 3000
CMD ["sh", "-c", "echo '🔄 Applying Prisma DB schema...' && (pnpm --filter @telegram-commerce/database db:push --accept-data-loss || true) && echo '🚀 Starting API...' && node apps/api/dist/index.js"]
