#!/usr/bin/env bash
# ============================================================
#  cca-PaaS — Interactive Setup Script
#  Generates .env, configures nginx, and launches Docker.
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

# ── nginx.conf generators ────────────────────────────────────

# Default: no domain — accept any host on HTTP
generate_nginx_default() {
  cat > docker/nginx.conf <<'NGINXEOF'
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://api:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINXEOF
}

# HTTP with specific server_name — used as fallback when SSL cert is unavailable
# but a domain was entered.
generate_nginx_http_domain() {
  local domain="$1"
  cat > docker/nginx.conf <<NGINXEOF
server {
    listen 80;
    server_name ${domain};

    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://api:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
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
}

# Cloudflare: trusted real IP resolution + safe proto detection only from CF IPs
generate_nginx_cloudflare() {
  local domain="$1"
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

server {
    listen 80;
    server_name ${domain};

    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://api:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        # Cloudflare always terminates HTTPS — tell the API it came in over https
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
}

# Let's Encrypt SSL: domain with HTTPS, redirect HTTP → HTTPS
generate_nginx_ssl() {
  local domain="$1"
  cat > docker/nginx.conf <<NGINXEOF
# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name ${domain};
    return 301 https://\$host\$request_uri;
}

# HTTPS server
server {
    listen 443 ssl;
    server_name ${domain};

    ssl_certificate     /etc/letsencrypt/live/${domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem;
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
}

# Generate docker-compose.override.yml to expose port 443 (Let's Encrypt only)
generate_compose_ssl_override() {
  cat > docker-compose.override.yml <<'OVERRIDEEOF'
# Auto-generated by docker/setup.sh — Let's Encrypt SSL mode
# Adds HTTPS port binding on top of the base docker-compose.yml
services:
  frontend:
    ports:
      - "443:443"
OVERRIDEEOF
}

# ── print_success ────────────────────────────────────────────
print_success() {
  local app_url="${1:-}"
  local server_ip
  server_ip=$(hostname -I 2>/dev/null | awk '{print $1}')
  local display_url="${app_url:-http://${server_ip:-your-server-ip}}"

  echo ""
  echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════╗${RESET}"
  echo -e "${BOLD}${GREEN}║            cca-PaaS is LIVE!                     ║${RESET}"
  echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════╝${RESET}"
  echo ""
  echo -e "  Open your browser and finish setup:"
  echo -e "  ${BOLD}${CYAN}${display_url}/setup${RESET}"
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
      EXISTING_URL=$(grep '^APP_URL=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")
      print_success "$EXISTING_URL"
      exit 0
      ;;
  esac
fi

# ════════════════════════════════════════════════════════════
#  Step 1 of 2 — Database Password (optional)
# ════════════════════════════════════════════════════════════
echo -e "${BOLD}Step 1 of 2 — Database Password${RESET}"
echo -e "  ${DIM}Press Enter to auto-generate a secure random password.${RESET}"
echo ""

read -rp "  DB Password [leave blank to auto-generate]: " DB_PASSWORD_INPUT
echo ""

if [ -z "$DB_PASSWORD_INPUT" ]; then
  DB_PASSWORD="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 24)"
  success "Auto-generated a secure DB password."
else
  DB_PASSWORD="$(echo "$DB_PASSWORD_INPUT" | tr -d "'\"\$\\ #")"
  if [ "$DB_PASSWORD" != "$DB_PASSWORD_INPUT" ]; then
    warn "Some special characters were removed from your DB password for .env compatibility."
  fi
  success "DB Password set."
fi

# ════════════════════════════════════════════════════════════
#  Step 2 of 2 — Domain Name (optional)
# ════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}Step 2 of 2 — Domain Name (optional)${RESET}"
echo -e "  ${DIM}If you have a domain pointed to this server, enter it here.${RESET}"
echo -e "  ${DIM}Leave blank to use the server IP address only.${RESET}"
echo ""

read -rp "  Domain name (e.g. app.yourdomain.com) [leave blank to skip]: " DOMAIN_INPUT
echo ""

DOMAIN=""
APP_URL=""
COOKIE_SECURE="false"

if [ -n "$DOMAIN_INPUT" ]; then
  # Normalize: strip protocol prefix and trailing slashes
  DOMAIN=$(echo "$DOMAIN_INPUT" | sed 's|https\?://||' | sed 's|/.*||' | tr -d ' ' | tr '[:upper:]' '[:lower:]')

  echo -e "  Domain: ${BOLD}${DOMAIN}${RESET}"
  echo ""

  echo -e "  Are you using ${BOLD}Cloudflare proxy${RESET} for this domain?"
  echo -e "  ${DIM}(Cloudflare handles HTTPS — your server only needs HTTP on port 80)${RESET}"
  read -rp "  Using Cloudflare proxy? [Y/n]: " CF_INPUT
  echo ""

  USE_CF=true
  case "$CF_INPUT" in
    [Nn]*) USE_CF=false ;;
  esac

  if $USE_CF; then
    # ── Cloudflare mode ──────────────────────────────────────
    APP_URL="https://${DOMAIN}"
    # COOKIE_SECURE stays false: Cloudflare terminates HTTPS at the edge.
    # nginx → API communication is HTTP internally, so express-session must
    # NOT require a secure connection before setting the session cookie.
    COOKIE_SECURE="false"
    info "Generating nginx config for Cloudflare..."
    generate_nginx_cloudflare "$DOMAIN"
    rm -f docker-compose.override.yml
    success "nginx.conf: Cloudflare proxy mode (HTTP origin, HTTPS at edge)."
    echo ""
    echo -e "  ${DIM}Reminder: enable Cloudflare orange-cloud proxy on your A record.${RESET}"
    echo -e "  ${DIM}Server IP: $(hostname -I 2>/dev/null | awk '{print $1}')${RESET}"
    echo ""
  else
    # ── Direct SSL (Let's Encrypt) mode ─────────────────────
    APP_URL="https://${DOMAIN}"

    warn "Make sure port 80 is open and your DNS A record already points to this server."
    echo ""

    if ! command -v certbot &>/dev/null; then
      info "Installing certbot..."
      if command -v apt-get &>/dev/null; then
        apt-get update -qq
        apt-get install -y certbot -qq
        success "certbot installed."
      elif command -v dnf &>/dev/null; then
        dnf install -y certbot -q
        success "certbot installed."
      elif command -v yum &>/dev/null; then
        yum install -y certbot -q
        success "certbot installed."
      else
        warn "Cannot auto-install certbot. Please install manually and re-run."
        warn "Falling back to HTTP-only mode."
        APP_URL="http://${DOMAIN}"
        generate_nginx_http_domain "$DOMAIN"
        success "nginx.conf configured (HTTP only — add SSL later manually)."
      fi
    fi

    if command -v certbot &>/dev/null; then
      read -rp "  Email for Let's Encrypt notifications (optional): " CERT_EMAIL
      echo ""

      if certbot certonly \
          --standalone \
          --non-interactive \
          --agree-tos \
          --email "${CERT_EMAIL:-admin@${DOMAIN}}" \
          -d "$DOMAIN" \
          --quiet 2>&1; then
        success "SSL certificate obtained for ${DOMAIN}."
        info "Generating HTTPS nginx config..."
        generate_nginx_ssl "$DOMAIN"
        generate_compose_ssl_override
        COOKIE_SECURE="true"
        success "nginx.conf configured with HTTPS (Let's Encrypt)."
        success "docker-compose.override.yml created (port 443 enabled)."
      else
        warn "certbot failed. Common causes:"
        warn "  - DNS A record not yet propagated to this server"
        warn "  - Port 80 is blocked by a firewall"
        warn "  Run 'certbot certonly --standalone -d ${DOMAIN}' manually after fixing."
        warn "Falling back to HTTP-only mode."
        APP_URL="http://${DOMAIN}"
        generate_nginx_http_domain "$DOMAIN"
        rm -f docker-compose.override.yml
      fi
    fi
  fi
else
  # ── No domain — IP-only mode ─────────────────────────────
  generate_nginx_default
  success "nginx.conf configured (HTTP, IP-only mode)."
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

{
  echo "# ============================================================"
  echo "# cca-PaaS — Generated by docker/setup.sh"
  echo "# ============================================================"
  echo ""
  echo "DB_PASSWORD=${DB_PASSWORD}"
  echo ""
  echo "SESSION_SECRET=${SESSION_SECRET}"
  echo ""
  echo "# Set to true when serving over HTTPS (enables secure cookies)"
  echo "COOKIE_SECURE=${COOKIE_SECURE}"
  echo ""
  if [ -n "$APP_URL" ]; then
    echo "APP_URL=${APP_URL}"
    echo ""
  fi
  echo "# URL to the raw VERSION file on GitHub — enables update checks from Admin Panel"
  echo "GITHUB_RAW_VERSION_URL=https://raw.githubusercontent.com/Riydx0/cca-PaaS/main/VERSION"
  echo ""
  echo "# Optional: port to expose on the host machine (default: 80)"
  echo "# LISTEN_PORT=80"
} > .env

success ".env file created."
echo ""

# ════════════════════════════════════════════════════════════
#  Launch Docker
# ════════════════════════════════════════════════════════════
echo -e "${BOLD}Building and launching cca-PaaS...${RESET}"
echo -e "${DIM}  This may take 2-5 minutes on first run.${RESET}"
echo ""

docker compose up -d --build

print_success "$APP_URL"
