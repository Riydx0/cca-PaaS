#!/usr/bin/env bash
# ============================================================
#  cca-PaaS — Docker + Docker Compose installer for Linux
#  Supports: Ubuntu, Debian, CentOS, Rocky Linux,
#            AlmaLinux, Fedora
# ============================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${CYAN}[cca-PaaS]${RESET} $*"; }
success() { echo -e "${GREEN}[✔]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[!]${RESET} $*"; }
error()   { echo -e "${RED}[✘]${RESET} $*" >&2; }

# ── root check ──────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  error "Please run as root:  sudo bash docker/install-docker.sh"
  exit 1
fi

REAL_USER="${SUDO_USER:-$(logname 2>/dev/null || echo '')}"

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║   cca-PaaS — Docker Installer for Linux      ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${RESET}"
echo ""

# ── detect OS ───────────────────────────────────────────────
DISTRO=""
VERSION_ID=""

if [ -f /etc/os-release ]; then
  # shellcheck disable=SC1091
  . /etc/os-release
  DISTRO="${ID:-}"
  VERSION_ID="${VERSION_ID:-}"
fi

# Normalise variants
case "$DISTRO" in
  rhel|almalinux|rocky) DISTRO_FAMILY="rhel" ;;
  centos)                DISTRO_FAMILY="centos" ;;
  fedora)                DISTRO_FAMILY="fedora" ;;
  ubuntu)                DISTRO_FAMILY="ubuntu" ;;
  debian)                DISTRO_FAMILY="debian" ;;
  *)                     DISTRO_FAMILY="" ;;
esac

# ── manual menu if distro not detected ──────────────────────
if [ -z "$DISTRO_FAMILY" ]; then
  warn "Could not auto-detect your Linux distribution."
  echo ""
  echo "  Please choose your OS:"
  echo "  1) Ubuntu (20.04 / 22.04 / 24.04)"
  echo "  2) Debian (11 Bullseye / 12 Bookworm)"
  echo "  3) CentOS 7"
  echo "  4) CentOS 8 / Stream"
  echo "  5) Rocky Linux / AlmaLinux (8 or 9)"
  echo "  6) Fedora (38+)"
  echo "  7) Exit"
  echo ""
  read -rp "  Enter number [1-7]: " CHOICE
  case "$CHOICE" in
    1) DISTRO_FAMILY="ubuntu"; DISTRO="ubuntu" ;;
    2) DISTRO_FAMILY="debian"; DISTRO="debian" ;;
    3) DISTRO_FAMILY="centos"; DISTRO="centos"; VERSION_ID="7" ;;
    4) DISTRO_FAMILY="centos"; DISTRO="centos"; VERSION_ID="8" ;;
    5) DISTRO_FAMILY="rhel";   DISTRO="centos" ;;
    6) DISTRO_FAMILY="fedora"; DISTRO="fedora" ;;
    *) info "Exiting."; exit 0 ;;
  esac
fi

info "Detected: ${DISTRO:-$DISTRO_FAMILY} ${VERSION_ID}"
echo ""

# ════════════════════════════════════════════════════════════
#  Installer functions
# ════════════════════════════════════════════════════════════

install_ubuntu_debian() {
  info "Updating package index..."
  apt-get update -qq

  info "Installing prerequisites..."
  apt-get install -y -qq \
    ca-certificates curl gnupg lsb-release

  info "Adding Docker's official GPG key..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/"${DISTRO}"/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  info "Adding Docker apt repository..."
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/${DISTRO} \
    $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list

  info "Installing Docker Engine + Compose plugin..."
  apt-get update -qq
  apt-get install -y -qq \
    docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin
}

install_centos7() {
  info "Installing yum-utils..."
  yum install -y -q yum-utils

  info "Adding Docker CE repository..."
  yum-config-manager --add-repo \
    https://download.docker.com/linux/centos/docker-ce.repo

  info "Installing Docker Engine + Compose plugin..."
  yum install -y -q \
    docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin
}

install_centos8_rhel_fedora() {
  local PM="dnf"
  command -v dnf &>/dev/null || PM="yum"

  info "Installing dnf-plugins-core..."
  $PM install -y -q dnf-plugins-core 2>/dev/null || true

  info "Adding Docker CE repository..."
  $PM config-manager --add-repo \
    https://download.docker.com/linux/centos/docker-ce.repo 2>/dev/null || \
  $PM config-manager --add-repo \
    https://download.docker.com/linux/fedora/docker-ce.repo

  info "Installing Docker Engine + Compose plugin..."
  $PM install -y -q \
    docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin
}

# ════════════════════════════════════════════════════════════
#  Run the right installer
# ════════════════════════════════════════════════════════════

case "$DISTRO_FAMILY" in
  ubuntu|debian)
    install_ubuntu_debian
    ;;
  centos)
    if [ "${VERSION_ID%%.*}" = "7" ]; then
      install_centos7
    else
      install_centos8_rhel_fedora
    fi
    ;;
  rhel|fedora)
    install_centos8_rhel_fedora
    ;;
esac

# ── Enable & start Docker ────────────────────────────────────
info "Enabling Docker service..."
systemctl enable docker --quiet
systemctl start  docker

# ── Add user to docker group ─────────────────────────────────
if [ -n "$REAL_USER" ] && id "$REAL_USER" &>/dev/null; then
  usermod -aG docker "$REAL_USER"
  success "User '${REAL_USER}' added to the docker group."
  warn "Log out and back in (or run: newgrp docker) for group changes to take effect."
else
  warn "Could not detect the calling user — add yourself to the docker group manually:"
  warn "  sudo usermod -aG docker \$USER"
fi

echo ""
success "Docker $(docker --version | awk '{print $3}' | tr -d ',') installed successfully!"
success "Docker Compose $(docker compose version --short) installed successfully!"
echo ""
echo -e "${BOLD}Next steps:${RESET}"
echo "  1. (Re-login or run: newgrp docker)"
echo "  2. Copy and fill environment variables:"
echo "       cp .env.example .env && nano .env"
echo "  3. Launch cca-PaaS:"
echo "       docker compose up -d --build"
echo ""
echo -e "${CYAN}Your app will be live at: http://\$(hostname -I | awk '{print \$1}')${RESET}"
echo ""
