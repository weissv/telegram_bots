#!/usr/bin/env bash
# ==============================================================================
# Telegram E-Commerce Engine — Zero-Touch Standalone VPS Installer ($350 Tier)
# Target OS: Ubuntu 22.04 LTS / Ubuntu 24.04 LTS
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}${BOLD}"
cat << "EOF"
  _____ _____ _      ______ _____ _____            __  __ 
 |_   _|  ___| |    |  ____/ ____|  __ \     /\   |  \/  |
   | | | |__ | |    | |__ | |  __| |__) |   /  \  | \  / |
   | | |  __|| |    |  __|| | |_ |  _  /   / /\ \ | |\/| |
  _| |_| |___| |____| |___| |__| | | \ \  / ____ \| |  | |
 |_____|_____|______|______\_____|_|  \_\/_/    \_\_|  |_|
  COMMERCE ENGINE — STANDALONE ZERO-TOUCH VPS INSTALLER
EOF
echo -e "${NC}"

# 1. Root check
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}❌ Please execute this installation script as root (e.g. sudo bash setup-standalone.sh)${NC}"
  exit 1
fi

# 2. System updates & Prerequisites installation
echo -e "${BLUE}📦 [1/7] Updating system and installing base dependencies...${NC}"
apt-get update -qq
apt-get install -y -qq curl git openssl jq ca-certificates gnupg lsb-release

# 3. Docker & Docker Compose installation check
echo -e "${BLUE}🐳 [2/7] Checking Docker & Docker Compose v2...${NC}"
if ! command -v docker &> /dev/null; then
  echo -e "${YELLOW}Installing Docker Engine...${NC}"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

# 4. Configuration Inputs
echo -e "${BLUE}⚙️  [3/7] Configuring Standalone Environment...${NC}"

if [ -f .env.standalone ]; then
  echo -e "${YELLOW}Reading existing .env.standalone file...${NC}"
  export $(grep -v '^#' .env.standalone | xargs)
fi

DOMAIN_NAME="${DOMAIN_NAME:-}"
BOT_TOKEN="${BOT_TOKEN:-}"
ADMIN_TELEGRAM_ID="${ADMIN_TELEGRAM_ID:-}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@${DOMAIN_NAME:-example.com}}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(openssl rand -base64 12)}"

if [ -z "$DOMAIN_NAME" ]; then
  read -rp "Enter your primary Domain Name (e.g. shop.example.com): " DOMAIN_NAME
fi

if [ -z "$BOT_TOKEN" ]; then
  read -rp "Enter your Telegram Bot Token from @BotFather: " BOT_TOKEN
fi

if [ -z "$ADMIN_TELEGRAM_ID" ]; then
  read -rp "Enter your Personal Telegram User ID (for instant order alerts): " ADMIN_TELEGRAM_ID
fi

# Generate cryptographically secure keys
ENCRYPTION_KEY=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 24)
DB_PASSWORD=$(openssl rand -hex 16)
WEBHOOK_SECRET=$(openssl rand -hex 32)
STANDALONE_TENANT_ID="00000000-0000-0000-0000-000000000001"

# Write .env.standalone
cat <<EOF > .env.standalone
MODE=standalone
DOMAIN_NAME=${DOMAIN_NAME}
ACME_EMAIL=${ADMIN_EMAIL}
BOT_TOKEN=${BOT_TOKEN}
ADMIN_TELEGRAM_ID=${ADMIN_TELEGRAM_ID}
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}

STANDALONE_TENANT_ID=${STANDALONE_TENANT_ID}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
JWT_SECRET=${JWT_SECRET}
DB_PASSWORD=${DB_PASSWORD}
WEBHOOK_SECRET=${WEBHOOK_SECRET}

PUBLIC_API_URL=https://api.${DOMAIN_NAME}
PUBLIC_MINIAPP_URL=https://${DOMAIN_NAME}
PUBLIC_ADMIN_URL=https://admin.${DOMAIN_NAME}
EOF

echo -e "${GREEN}✅ Environment configuration saved to .env.standalone${NC}"

# 5. Launch Docker Stack
echo -e "${BLUE}🚀 [4/7] Launching Docker Containers (Traefik SSL, PostgreSQL, API, Mini App, Admin)...${NC}"
docker compose -f docker/docker-compose.standalone.yml --env-file .env.standalone up -d --build

# 6. Wait for Database & Run Migrations
echo -e "${BLUE}🗄️  [5/7] Waiting for PostgreSQL database initialization...${NC}"
sleep 8

echo -e "${BLUE}🔄 [6/7] Running database migrations & seeder...${NC}"
docker exec -i standalone_api npx prisma db push --schema packages/database/prisma/schema.prisma
docker exec -i standalone_api npx tsx scripts/seed.ts

# 7. Configure Telegram Bot Webhook & Menu Button
echo -e "${BLUE}🤖 [7/7] Registering Webhook & Mini App Menu Button with Telegram API...${NC}"

# Set Webhook
WEBHOOK_URL="https://api.${DOMAIN_NAME}/api/v1/webhooks/${STANDALONE_TENANT_ID}"
curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"${WEBHOOK_URL}\",\"secret_token\":\"${WEBHOOK_SECRET}\"}" | jq .

# Set Chat Menu Button
MINIAPP_URL="https://${DOMAIN_NAME}?tenant_id=${STANDALONE_TENANT_ID}"
curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton" \
  -H "Content-Type: application/json" \
  -d "{\"menu_button\":{\"type\":\"web_app\",\"text\":\"🛍️ Open Store\",\"web_app\":{\"url\":\"${MINIAPP_URL}\"}}}" | jq .

# Output Completion Summary
echo -e "\n${GREEN}${BOLD}==============================================================================${NC}"
echo -e "${GREEN}${BOLD}🎉 STANDALONE TELEGRAM E-COMMERCE PLATFORM DEPLOYED SUCCESSFULLY!${NC}"
echo -e "${GREEN}${BOLD}==============================================================================${NC}"
echo -e "📱 ${BOLD}Telegram Mini App Storefront:${NC} https://${DOMAIN_NAME}"
echo -e "💼 ${BOLD}Merchant Admin Backoffice:${NC}   https://admin.${DOMAIN_NAME}"
echo -e "⚡ ${BOLD}Fastify API Endpoint:${NC}        https://api.${DOMAIN_NAME}"
echo -e "🔒 ${BOLD}Admin Email:${NC}                 ${ADMIN_EMAIL}"
echo -e "🔑 ${BOLD}Admin Password:${NC}              ${ADMIN_PASSWORD}"
echo -e "${GREEN}${BOLD}==============================================================================${NC}\n"
