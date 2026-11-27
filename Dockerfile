# See docker/Dockerfile.api. This image copies node_modules, which includes
# esbuild binaries compiled with a vulnerable Go stdlib.
FROM golang:1.26.11-alpine@sha256:ecb67f987aa1a57794c91d19ade7ae0209f2f0f5496aaef9e6ae85ddf92d02ab AS esbuild-stdlib
RUN apk add --no-cache curl ca-certificates
WORKDIR /src
# The toolchain is the pinned base image. GOTOOLCHAIN=local stops Go from
# downloading another one. The proxy is listed twice so a dropped connection
# falls through, and go mod download is retried below.
ENV CGO_ENABLED=0 \
    GOFLAGS="-trimpath -mod=mod" \
    GOTOOLCHAIN=local \
    GOPROXY=https://proxy.golang.org,https://proxy.golang.org,direct \
    GOSUMDB=sum.golang.org
# Tag archives instead of git clone: clone died on a reset connection in
# production. Checksums are the GitHub archive/refs/tags tarballs.
RUN set -eu; \
    mkdir -p /out; \
    fetch_tar() { \
      url="$1"; dest="$2"; sha="$3"; n=0; \
      while [ "$n" -lt 10 ]; do \
        n=$((n + 1)); \
        if curl --retry 10 --retry-all-errors --retry-delay 5 --connect-timeout 30 -fL -C - -o "$dest" "$url"; then \
          if echo "${sha}  ${dest}" | sha256sum -c -; then \
            return 0; \
          fi; \
          echo "checksum mismatch for ${dest} (attempt ${n}), discarding" >&2; \
          rm -f "$dest"; \
        else \
          echo "download interrupted (attempt ${n}), will resume: ${url}" >&2; \
        fi; \
        sleep 5; \
      done; \
      return 1; \
    }; \
    go_retry() { \
      n=0; \
      while [ "$n" -lt 10 ]; do \
        n=$((n + 1)); \
        if "$@"; then \
          return 0; \
        fi; \
        echo "go command failed (attempt ${n}): $*" >&2; \
        sleep 5; \
      done; \
      return 1; \
    }; \
    set -- \
      0.21.5 b4f83a253a28575ab9bc0e84201138f6293dc655ee74219f670d7cfa20e26a27 \
      0.25.12 eca56e4242e68ebde6f327458c71457e614a2b0564b30a45d60fc633e0ccaab4 \
      0.28.2 300162f899361d9f0263065f8728ef9086dcfc1a3d36bcbc4e0abe5de9c58bf8; \
    while [ "$#" -ge 2 ]; do \
      v="$1"; sha="$2"; shift 2; \
      fetch_tar "https://github.com/evanw/esbuild/archive/refs/tags/v${v}.tar.gz" "esbuild-${v}.tar.gz" "$sha"; \
      tar -xzf "esbuild-${v}.tar.gz"; \
      (cd "esbuild-${v}" && go_retry go mod download && go_retry go build -o "/out/esbuild-${v}" ./cmd/esbuild); \
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
