#!/usr/bin/env bash
# ============================================================
#  cca-PaaS — Cloudflare Full SSL Setup
#  Installs a Cloudflare Origin Certificate on this server
#  and reconfigures nginx to listen on HTTPS (port 443).
#  Run AFTER docker/setup.sh has already set up the project.
# ============================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

info()    { echo -e "${CYAN}[cca-PaaS]${RESET} $*"; }
success() { echo -e "${GREEN}[✔]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[!]${RESET} $*"; }
error()   { echo -e "${RED}[✘]${RESET} $*" >&2; }

# ── load shared nginx generators ─────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=docker/_nginx_generators.sh
source "${SCRIPT_DIR}/_nginx_generators.sh"

CF_SSL_DIR="/etc/cloudflare-ssl"
CERT_FILE="${CF_SSL_DIR}/cert.pem"
KEY_FILE="${CF_SSL_DIR}/key.pem"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# ── ensure we run from project root ─────────────────────────
cd "$PROJECT_DIR"

# ── check .env exists ────────────────────────────────────────
if [ ! -f .env ]; then
  error ".env file not found. Run docker/setup.sh first."
  exit 1
fi

# ── read current domain from .env ────────────────────────────
CURRENT_APP_URL=$(grep '^APP_URL=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")
DOMAIN=$(echo "$CURRENT_APP_URL" | sed 's|https\?://||' | sed 's|/.*||')

if [ -z "$DOMAIN" ]; then
  error "APP_URL not set in .env. Run docker/setup.sh first."
  exit 1
fi

# ── banner ───────────────────────────────────────────────────
clear 2>/dev/null || true
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║    cca-PaaS — Cloudflare Full SSL Setup          ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  Domain: ${BOLD}${CYAN}${DOMAIN}${RESET}"
echo -e "  ${DIM}This script installs a Cloudflare Origin Certificate${RESET}"
echo -e "  ${DIM}and configures nginx to serve HTTPS on port 443.${RESET}"
echo ""

# ── Step 1: Instructions ─────────────────────────────────────
echo -e "${BOLD}Step 1 — Generate a Cloudflare Origin Certificate${RESET}"
echo ""
echo -e "  Open your Cloudflare Dashboard and follow these steps:"
echo ""
echo -e "  ${BOLD}1.${RESET} Go to: ${CYAN}https://dash.cloudflare.com/${RESET}"
echo -e "  ${BOLD}2.${RESET} Select your domain: ${BOLD}${DOMAIN}${RESET}"
echo -e "  ${BOLD}3.${RESET} Click: ${BOLD}SSL/TLS → Origin Server${RESET}"
echo -e "  ${BOLD}4.${RESET} Click: ${BOLD}Create Certificate${RESET}"
echo -e "  ${BOLD}5.${RESET} Keep defaults (RSA, 15 years), click ${BOLD}Create${RESET}"
echo -e "  ${BOLD}6.${RESET} You will see two text boxes:"
echo -e "       • ${BOLD}Origin Certificate${RESET} (starts with -----BEGIN CERTIFICATE-----)"
echo -e "       • ${BOLD}Private Key${RESET}         (starts with -----BEGIN PRIVATE KEY-----)"
echo -e "  ${BOLD}7.${RESET} ${RED}Keep this page open!${RESET} The private key cannot be retrieved again."
echo ""
read -rp "  Press Enter when you have the certificate and key ready..." _
echo ""

# ── Step 2: Create SSL directory ─────────────────────────────
echo -e "${BOLD}Step 2 — Creating SSL directory${RESET}"
echo ""

if [ "$(id -u)" -eq 0 ]; then
  mkdir -p "$CF_SSL_DIR"
  chmod 700 "$CF_SSL_DIR"
else
  sudo mkdir -p "$CF_SSL_DIR"
  sudo chmod 700 "$CF_SSL_DIR"
  sudo chown "$(id -u):$(id -g)" "$CF_SSL_DIR"
fi
success "SSL directory ready: ${CF_SSL_DIR}"
echo ""

# ── Step 3: Paste certificate ────────────────────────────────
echo -e "${BOLD}Step 3 — Paste your Origin Certificate${RESET}"
echo ""
echo -e "  ${DIM}Paste the full certificate block below (including BEGIN/END lines).${RESET}"
echo -e "  ${DIM}Input ends automatically when '-----END CERTIFICATE-----' is detected.${RESET}"
echo ""

CERT_CONTENT=""
while IFS= read -r line; do
  CERT_CONTENT+="${line}"$'\n'
  [[ "$line" == "-----END CERTIFICATE-----" ]] && break
done

if ! echo "$CERT_CONTENT" | grep -q "BEGIN CERTIFICATE"; then
  error "Invalid certificate — must start with '-----BEGIN CERTIFICATE-----'."
  exit 1
fi

echo "$CERT_CONTENT" > "$CERT_FILE"
chmod 600 "$CERT_FILE"
success "Certificate saved to ${CERT_FILE}"
echo ""

# ── Step 4: Paste private key ────────────────────────────────
echo -e "${BOLD}Step 4 — Paste your Private Key${RESET}"
echo ""
echo -e "  ${DIM}Paste the full private key block below (including BEGIN/END lines).${RESET}"
echo -e "  ${DIM}Input ends automatically when the '-----END ... KEY-----' line is detected.${RESET}"
echo ""

KEY_CONTENT=""
while IFS= read -r line; do
  KEY_CONTENT+="${line}"$'\n'
  [[ "$line" =~ ^"-----END "[A-Z\ ]+"KEY-----"$ ]] && break
done

if ! echo "$KEY_CONTENT" | grep -qE "BEGIN (EC |RSA |)PRIVATE KEY"; then
  error "Invalid private key — must contain 'BEGIN PRIVATE KEY' or 'BEGIN EC PRIVATE KEY'."
  rm -f "$CERT_FILE"
  exit 1
fi

echo "$KEY_CONTENT" > "$KEY_FILE"
chmod 600 "$KEY_FILE"
success "Private key saved to ${KEY_FILE}"
echo ""

# ── Step 5: Generate nginx config with SSL ───────────────────
echo -e "${BOLD}Step 5 — Configuring nginx for HTTPS${RESET}"
echo ""

generate_nginx_cloudflare_ssl "$DOMAIN" "$CF_SSL_DIR"
success "nginx.conf updated (port 443 SSL + HTTP → HTTPS redirect)."
echo ""

# ── Step 6: Create docker-compose.override.yml ───────────────
generate_compose_cloudflare_ssl_override "$CF_SSL_DIR"
success "docker-compose.override.yml created (port 443 + SSL cert volume)."
echo ""

# ── Step 7: Update COOKIE_SECURE in .env ─────────────────────
if grep -q '^COOKIE_SECURE=' .env; then
  sed -i 's|^COOKIE_SECURE=.*|COOKIE_SECURE=true|' .env
else
  echo "COOKIE_SECURE=true" >> .env
fi
success "COOKIE_SECURE=true set in .env"
echo ""

# ── Step 8: Restart frontend container ───────────────────────
echo -e "${BOLD}Step 6 — Restarting frontend...${RESET}"
echo ""
docker compose up -d --no-deps frontend
success "Frontend restarted."
echo ""

# ── Done ─────────────────────────────────────────────────────
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${GREEN}║      Cloudflare Full SSL is ready!               ║${RESET}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  ${BOLD}Final step:${RESET} Go to Cloudflare Dashboard and set:"
echo -e "  ${CYAN}SSL/TLS → Overview → Full${RESET}"
echo ""
echo -e "  Your site will be accessible at:"
echo -e "  ${BOLD}${CYAN}https://${DOMAIN}${RESET}"
echo ""
echo -e "  ${DIM}To revert to Flexible mode, run: bash docker/setup.sh${RESET}"
echo ""
