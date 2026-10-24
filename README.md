# 🛍️ Telegram E-Commerce Platform

> **Next-Generation Multi-Tenant Telegram Commerce Engine & SaaS Platform**  
> Build, launch, and scale online storefronts inside Telegram with Telegram Mini Apps (TWA), interactive inline keyboard bots, instant merchant web admin backoffices, and multi-currency payments.

---

## 🌟 Key Features

* **Multi-Tenant Architecture**: Complete query-level database isolation with Prisma Client Extensions. Each merchant storefront operates in complete isolation.
* **Full-Screen Telegram Mini App (TWA)**: Modern React 18 + Tailwind CSS storefront with haptic feedback, custom brand colors, category filtering, search, dynamic banners, and instant checkout.
* **Interactive Inline Bot**: Fallback keyboard-driven Telegram bot for customers who prefer native text & inline keyboards without opening web views.
* **Zero-Touch Onboarding Wizard**: Platform Master Bot (`@miraiedu_bot`) provisions new merchant stores in under 2 minutes directly inside Telegram.
* **Enterprise Concurrency Safety**: Stock reservation with atomic row-level conditional updates (`UPDATE "Product" SET stock = stock - qty WHERE stock >= qty`) and BullMQ-driven 15-minute reservation timeouts.
* **Merchant Backoffice (Admin Panel)**: Complete web-based management center with live revenue metrics, average order value, product inventory CRUD, order status workflow, and theme customizer.
* **Multi-Currency & Internationalization**: Full dictionary localization in **Russian (RU)** and **Uzbek (UZ)** with currency formatting for `USD ($)`, `EUR (€)`, `GBP (£)`, `RUB (₽)`, `UZS (so'm)`, and Telegram Stars (`XTR`).
* **Multi-Gateway Payment Processing**: Native support for **Stripe**, **Telegram Stars**, **Payme**, **Click**, and instant test/mock checkout.
* **Dual Deployment Modes**:
  * **SaaS Mode**: Central cloud platform with recurring Stripe subscription tiers.
  * **Standalone VPS Mode ($350 Lifetime Tier)**: Automated `setup-standalone.sh` zero-touch installer with Docker Compose, PostgreSQL, and Traefik Let's Encrypt SSL.

---

## 🏗️ Monorepo Architecture

```
telegram_bots/
├── apps/
│   ├── admin/           # Merchant Web Backoffice (React, Vite, Tailwind)
│   ├── api/             # Central Fastify REST API, Webhooks & Static Host
│   ├── landing/         # Marketing Landing Page with Pricing & Features
│   ├── master-bot/      # Platform Onboarding Bot (@miraiedu_bot)
│   └── miniapp/         # Telegram Mini App Storefront (@twa-dev/sdk)
├── packages/
│   ├── config/          # Zod env schema, AES-256-GCM crypto, pricing tiers
│   ├── database/        # Prisma ORM schema, tenant query extensions, seeds
│   ├── i18n/            # Russian & Uzbek translation dictionaries & currencies
│   ├── payments/        # Stripe, Payme, Click, Telegram Stars & Mock gateways
│   ├── telegram-engine/ # GrammY multi-tenant bot runtime, sessions, handlers
│   └── ui/              # Shared Tailwind component library
├── docker/              # Dockerfiles, Docker Compose, and Traefik configs
├── scripts/             # Standalone VPS zero-touch installer & seed scripts
└── tests/               # Vitest integration and unit test suites
```

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
* **Node.js**: `>= 20.0.0`
* **Package Manager**: `pnpm >= 11.0.0` (or `npx pnpm`)
* **PostgreSQL**: `>= 16`
* **Redis**: `>= 7` (optional for local standalone, required for SaaS queues)

### 2. Environment Setup
```bash
cp .env.example .env
```
Fill in your database URL and cryptographic keys:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/telegram_commerce?schema=public"
ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
JWT_SECRET="super-secret-jwt-key-replace-in-production-12345"
```

### 3. Install Dependencies & Initialize Database
```bash
npx pnpm install
npx pnpm db:generate
npx pnpm db:push
```

### 4. Run Development Servers
```bash
npx pnpm dev
```
* **API & Webhooks**: [http://localhost:3000](http://localhost:3000)
* **Mini App Storefront**: [http://localhost:5173?tenant_id=demo-tenant](http://localhost:5173?tenant_id=demo-tenant)
* **Merchant Backoffice**: [http://localhost:5174](http://localhost:5174)
* **Landing Page**: [http://localhost:5175](http://localhost:5175)

---

## 🧪 Testing & Code Quality

```bash
# Run unit and integration tests (Vitest)
npx pnpm test

# Run TypeScript typechecks across all 11 packages
npx pnpm check-types

# Production bundle build
npx pnpm build
```

---

## 📦 Production Deployment

### Option A: Unified Container (Coolify / Docker)
The application can be deployed as a single high-efficiency container using `docker/Dockerfile.api`. The container compiles all shared packages, builds the static Mini App and Admin SPAs, serves them via Fastify, connects to PostgreSQL, and starts the Master Bot polling runner:

```bash
docker build -t telegram-commerce -f docker/Dockerfile.api .
docker run -p 3000:3000 --env-file .env telegram-commerce
```

### Option B: Standalone VPS Installer
Run the automated zero-touch script on an Ubuntu 22.04/24.04 server:
```bash
sudo bash scripts/setup-standalone.sh
```

---

## 🔒 Security Best Practices

1. **Token Encryption**: All `@BotFather` API tokens are encrypted with `AES-256-GCM` using authentication tags before being written to PostgreSQL.
2. **Telegram HMAC Verification**: Mini App requests are verified using HMAC-SHA256 against Telegram's `WebAppData` signature secret.
3. **Webhook Validation**: Every tenant bot webhook update validates the `X-Telegram-Bot-Api-Secret-Token` header.
4. **Tenant Isolation**: Prisma Client Extension ensures queries cannot cross tenant boundaries even in multi-tenant SaaS mode.

---

## 📄 License
MIT License. Built for enterprise commercial production.
