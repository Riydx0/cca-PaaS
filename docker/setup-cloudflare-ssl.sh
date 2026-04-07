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

CF_SSL_DIR="/etc/cloudflare-ssl"
CERT_FILE="${CF_SSL_DIR}/cert.pem"
KEY_FILE="${CF_SSL_DIR}/key.pem"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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
echo -e "${BOLD}║    Domain: ${CYAN}${DOMAIN}${RESET}${BOLD}$(printf '%*s' $((33 - ${#DOMAIN})))'║'${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "${DIM}  This script installs a Cloudflare Origin Certificate${RESET}"
echo -e "${DIM}  and configures nginx to serve HTTPS on port 443.${RESET}"
echo -e "${DIM}  After this, set Cloudflare SSL/TLS mode to \"Full\".${RESET}"
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
echo -e "       • ${BOLD}Private Key${RESET} (starts with -----BEGIN PRIVATE KEY----- or -----BEGIN EC PRIVATE KEY-----)"
echo -e "  ${BOLD}7.${RESET} ${RED}Keep this page open!${RESET} You cannot retrieve the key again."
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
echo -e "  ${DIM}Paste the certificate below (the full block including BEGIN/END lines).${RESET}"
echo -e "  ${DIM}When done, press Enter then type ${BOLD}DONE${RESET}${DIM} on a new line and press Enter.${RESET}"
echo ""

CERT_CONTENT=""
while IFS= read -r line; do
  [[ "$line" == "DONE" ]] && break
  CERT_CONTENT+="${line}"$'\n'
done

if [ -z "$CERT_CONTENT" ] || ! echo "$CERT_CONTENT" | grep -q "BEGIN CERTIFICATE"; then
  error "Invalid certificate. It must contain 'BEGIN CERTIFICATE'."
  exit 1
fi

echo "$CERT_CONTENT" > "$CERT_FILE"
chmod 600 "$CERT_FILE"
success "Certificate saved to ${CERT_FILE}"
echo ""

# ── Step 4: Paste private key ────────────────────────────────
echo -e "${BOLD}Step 4 — Paste your Private Key${RESET}"
echo ""
echo -e "  ${DIM}Paste the private key below (the full block including BEGIN/END lines).${RESET}"
echo -e "  ${DIM}When done, press Enter then type ${BOLD}DONE${RESET}${DIM} on a new line and press Enter.${RESET}"
echo ""

KEY_CONTENT=""
while IFS= read -r line; do
  [[ "$line" == "DONE" ]] && break
  KEY_CONTENT+="${line}"$'\n'
done

if [ -z "$KEY_CONTENT" ] || ! echo "$KEY_CONTENT" | grep -qE "BEGIN (EC |RSA |)PRIVATE KEY"; then
  error "Invalid private key. It must contain 'BEGIN PRIVATE KEY' or 'BEGIN EC PRIVATE KEY'."
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

cat > docker/nginx.conf <<NGINXEOF
# Cloudflare trusted proxy ranges
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
set_real_ip_from 103.31.4.0/22;
set_real_ip_from 104.16.0.0/13;
set_real_ip_from 104.24.0.0/14;
set_real_ip_from 108.162.192.0/18;
set_real_ip_from 131.0.72.0/22;
set_real_ip_from 141.101.64.0/18;
set_real_ip_from 162.158.0.0/15;
set_real_ip_from 172.64.0.0/13;
set_real_ip_from 173.245.48.0/20;
set_real_ip_from 188.114.96.0/20;
set_real_ip_from 190.93.240.0/20;
set_real_ip_from 197.234.240.0/22;
set_real_ip_from 198.41.128.0/17;
set_real_ip_from 2400:cb00::/32;
set_real_ip_from 2606:4700::/32;
set_real_ip_from 2803:f800::/32;
set_real_ip_from 2405:b500::/32;
set_real_ip_from 2405:8100::/32;
set_real_ip_from 2a06:98c0::/29;
set_real_ip_from 2c0f:f248::/32;
real_ip_header   CF-Connecting-IP;
real_ip_recursive on;

# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name ${DOMAIN};
    return 301 https://\$host\$request_uri;
}

# HTTPS server with Cloudflare Origin Certificate
server {
    listen 443 ssl;
    server_name ${DOMAIN};

    ssl_certificate     ${CF_SSL_DIR}/cert.pem;
    ssl_certificate_key ${CF_SSL_DIR}/key.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 10m;

    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://api:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
NGINXEOF

success "nginx.conf updated for Cloudflare Full SSL."
echo ""

# ── Step 6: Create docker-compose.override.yml ───────────────
cat > docker-compose.override.yml <<'OVERRIDEEOF'
# Auto-generated by docker/setup-cloudflare-ssl.sh
# Adds HTTPS port binding and Cloudflare SSL certificate volume
services:
  frontend:
    ports:
      - "443:443"
    volumes:
      - /etc/cloudflare-ssl:/etc/cloudflare-ssl:ro
OVERRIDEEOF

success "docker-compose.override.yml created (port 443 + SSL volume)."
echo ""

# ── Step 7: Update COOKIE_SECURE in .env ─────────────────────
if grep -q '^COOKIE_SECURE=' .env; then
  sed -i 's|^COOKIE_SECURE=.*|COOKIE_SECURE=true|' .env
else
  echo "COOKIE_SECURE=true" >> .env
fi
success "COOKIE_SECURE=true set in .env"
echo ""

# ── Step 8: Restart frontend ─────────────────────────────────
echo -e "${BOLD}Step 6 — Restarting services...${RESET}"
echo ""
docker compose up -d --remove-orphans
success "Services restarted."
echo ""

# ── Done ─────────────────────────────────────────────────────
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${GREEN}║      Cloudflare Full SSL is ready!               ║${RESET}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  ${BOLD}Final step:${RESET} Go to Cloudflare Dashboard and set:"
echo -e "  ${CYAN}SSL/TLS → Overview → Full${RESET}"
echo ""
echo -e "  ${DIM}Your site will be accessible at:${RESET}"
echo -e "  ${BOLD}${CYAN}https://${DOMAIN}${RESET}"
echo ""
echo -e "  ${DIM}To revert to Flexible mode:${RESET}"
echo -e "  ${DIM}  1. Set Cloudflare SSL/TLS → Flexible${RESET}"
echo -e "  ${DIM}  2. Run: bash docker/setup.sh (and re-enter your domain)${RESET}"
echo ""
