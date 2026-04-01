#!/usr/bin/env bash
# ============================================================
#  cca-PaaS — Interactive Setup Script
#  Prompts for Clerk keys + optional DB password,
#  generates SESSION_SECRET, writes .env, and launches Docker.
# ============================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

info()    { echo -e "${CYAN}[cca-PaaS]${RESET} $*"; }
success() { echo -e "${GREEN}[✔]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[!]${RESET} $*"; }
error()   { echo -e "${RED}[✘]${RESET} $*" >&2; }

# ── print_success — defined early so it can be called anywhere ──
print_success() {
  SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
  echo ""
  echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════╗${RESET}"
  echo -e "${BOLD}${GREEN}║            cca-PaaS is LIVE!                     ║${RESET}"
  echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════╝${RESET}"
  echo ""
  echo -e "  Open your browser:"
  echo -e "  ${BOLD}${CYAN}http://${SERVER_IP:-your-server-ip}${RESET}"
  echo ""
  echo -e "  Admin setup ${DIM}(first time only)${RESET}:"
  echo -e "  ${CYAN}http://${SERVER_IP:-your-server-ip}/bootstrap${RESET}"
  echo ""
  echo -e "  Useful commands:"
  echo -e "  ${DIM}docker compose logs -f       # view live logs${RESET}"
  echo -e "  ${DIM}docker compose down          # stop the app${RESET}"
  echo -e "  ${DIM}docker compose restart       # restart all services${RESET}"
  echo ""
}

# ── banner ──────────────────────────────────────────────────
clear 2>/dev/null || true
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║        cca-PaaS — First Time Setup               ║${RESET}"
echo -e "${BOLD}║  Enterprise Cloud Services Marketplace           ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "${DIM}  This script will configure your environment and launch${RESET}"
echo -e "${DIM}  cca-PaaS with Docker. It takes about 2-5 minutes.${RESET}"
echo ""

# ── dependency checks ────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  error "Docker is not installed."
  error "Run first:  sudo bash docker/install-docker.sh"
  exit 1
fi

if ! docker compose version &>/dev/null 2>&1; then
  error "Docker Compose plugin is not installed."
  error "Run first:  sudo bash docker/install-docker.sh"
  exit 1
fi

if ! command -v openssl &>/dev/null; then
  error "openssl is not installed. Install it first:"
  error "  Ubuntu/Debian:  apt-get install -y openssl"
  error "  CentOS/Fedora:  dnf install -y openssl"
  exit 1
fi

# ── check for existing .env ──────────────────────────────────
if [ -f .env ]; then
  echo ""
  warn "A .env file already exists."
  read -rp "  Overwrite it and reconfigure? [y/N]: " OVERWRITE
  echo ""
  case "$OVERWRITE" in
    [Yy]*)
      rm -f .env
      ;;
    *)
      info "Keeping existing .env. Launching Docker with current config..."
      echo ""
      docker compose up -d --build
      print_success
      exit 0
      ;;
  esac
fi

# ════════════════════════════════════════════════════════════
#  Step 1 — Clerk Secret Key
# ════════════════════════════════════════════════════════════
echo -e "${BOLD}Step 1 of 3 — Clerk Secret Key${RESET}"
echo -e "  Get it from: ${CYAN}https://dashboard.clerk.com${RESET} → API Keys"
echo -e "  ${DIM}Starts with: sk_live_... or sk_test_...${RESET}"
echo ""

CLERK_SECRET_KEY=""
while true; do
  read -rp "  Clerk Secret Key: " CLERK_SECRET_KEY
  if [[ "$CLERK_SECRET_KEY" == sk_* ]]; then
    success "Clerk Secret Key accepted."
    break
  else
    error "Invalid key — must start with 'sk_'. Try again."
  fi
done

echo ""

# ════════════════════════════════════════════════════════════
#  Step 2 — Clerk Publishable Key
# ════════════════════════════════════════════════════════════
echo -e "${BOLD}Step 2 of 3 — Clerk Publishable Key${RESET}"
echo -e "  Same page: ${CYAN}https://dashboard.clerk.com${RESET} → API Keys"
echo -e "  ${DIM}Starts with: pk_live_... or pk_test_...${RESET}"
echo ""

VITE_CLERK_PUBLISHABLE_KEY=""
while true; do
  read -rp "  Clerk Publishable Key: " VITE_CLERK_PUBLISHABLE_KEY
  if [[ "$VITE_CLERK_PUBLISHABLE_KEY" == pk_* ]]; then
    success "Clerk Publishable Key accepted."
    break
  else
    error "Invalid key — must start with 'pk_'. Try again."
  fi
done

echo ""

# ════════════════════════════════════════════════════════════
#  Step 3 — Database Password (optional)
# ════════════════════════════════════════════════════════════
echo -e "${BOLD}Step 3 of 3 — Database Password${RESET}"
echo -e "  ${DIM}Press Enter to auto-generate a secure random password.${RESET}"
echo ""

read -rp "  DB Password [leave blank to auto-generate]: " DB_PASSWORD_INPUT
echo ""

if [ -z "$DB_PASSWORD_INPUT" ]; then
  DB_PASSWORD="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 24)"
  success "Auto-generated a secure DB password."
else
  # Strip characters that would break .env parsing (quotes, $, spaces, #, backslash)
  DB_PASSWORD="$(echo "$DB_PASSWORD_INPUT" | tr -d "'\"\$\\ #")"
  if [ "$DB_PASSWORD" != "$DB_PASSWORD_INPUT" ]; then
    warn "Some special characters were removed from your DB password for .env compatibility."
  fi
  success "DB Password set."
fi

# ════════════════════════════════════════════════════════════
#  Generate SESSION_SECRET automatically
# ════════════════════════════════════════════════════════════
SESSION_SECRET="$(openssl rand -hex 32)"
success "Session secret generated automatically."
echo ""

# ════════════════════════════════════════════════════════════
#  Write .env
# ════════════════════════════════════════════════════════════
info "Writing .env file..."

cat > .env <<EOF
# ============================================================
# cca-PaaS — Generated by docker/setup.sh
# ============================================================

DB_PASSWORD=${DB_PASSWORD}

CLERK_SECRET_KEY=${CLERK_SECRET_KEY}
VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY}

SESSION_SECRET=${SESSION_SECRET}

# Optional: port to expose on the host machine (default: 80)
# LISTEN_PORT=80

# Optional: custom domain Clerk proxy (requires DNS setup)
# VITE_CLERK_PROXY_URL=https://yourdomain.com/api/__clerk
EOF

success ".env file created."
echo ""

# ════════════════════════════════════════════════════════════
#  Launch Docker
# ════════════════════════════════════════════════════════════
echo -e "${BOLD}Building and launching cca-PaaS...${RESET}"
echo -e "${DIM}  This may take 2-5 minutes on first run.${RESET}"
echo ""

docker compose up -d --build

print_success
