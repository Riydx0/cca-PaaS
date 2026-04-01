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

# ── version guard (auto-detected path) ──────────────────────
check_version_ubuntu()  {
  local major="${VERSION_ID%%.*}"
  case "$major" in
    20|22|24) ;;
    *) warn "Ubuntu ${VERSION_ID} is not officially tested. Supported: 20.04, 22.04, 24.04. Proceeding anyway..." ;;
  esac
}
check_version_debian()  {
  local major="${VERSION_ID%%.*}"
  case "$major" in
    11|12) ;;
    *) warn "Debian ${VERSION_ID} is not officially tested. Supported: 11, 12. Proceeding anyway..." ;;
  esac
}
check_version_centos()  {
  local major="${VERSION_ID%%.*}"
  case "$major" in
    7|8) ;;
    *) warn "CentOS ${VERSION_ID} is not officially tested. Supported: 7, 8/Stream. Proceeding anyway..." ;;
  esac
}
check_version_rhel()    {
  local major="${VERSION_ID%%.*}"
  case "$major" in
    8|9) ;;
    *) warn "Rocky/AlmaLinux ${VERSION_ID} is not officially tested. Supported: 8, 9. Proceeding anyway..." ;;
  esac
}
check_version_fedora()  {
  local major="${VERSION_ID%%.*}"
  if [ "$major" -lt 38 ] 2>/dev/null; then
    warn "Fedora ${VERSION_ID} is not officially tested. Supported: 38+. Proceeding anyway..."
  fi
}

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

# Run version check for auto-detected path
case "$DISTRO_FAMILY" in
  ubuntu)  check_version_ubuntu ;;
  debian)  check_version_debian ;;
  centos)  check_version_centos ;;
  rhel)    check_version_rhel ;;
  fedora)  check_version_fedora ;;
esac
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
  curl -fsSL "https://download.docker.com/linux/${DISTRO}/gpg" \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  info "Adding Docker apt repository..."
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/${DISTRO} $(lsb_release -cs) stable" \
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
  # Pick package manager
  if command -v dnf &>/dev/null; then
    PM="dnf"
  else
    PM="yum"
  fi

  info "Installing dnf-plugins-core (for config-manager sub-command)..."
  $PM install -y -q dnf-plugins-core

  # Verify config-manager is available after install
  if ! $PM config-manager --version &>/dev/null 2>&1; then
    error "'${PM} config-manager' not available after installing dnf-plugins-core."
    error "Try: ${PM} install -y dnf-plugins-core && ${PM} config-manager --add-repo ..."
    exit 1
  fi

  info "Adding Docker CE repository..."
  if [ "$DISTRO_FAMILY" = "fedora" ]; then
    $PM config-manager --add-repo \
      https://download.docker.com/linux/fedora/docker-ce.repo
  else
    $PM config-manager --add-repo \
      https://download.docker.com/linux/centos/docker-ce.repo
  fi

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
  *)
    error "Unsupported distribution family: ${DISTRO_FAMILY}. Cannot proceed."
    exit 1
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
echo "  1. Re-login or run:  newgrp docker"
echo "  2. Run the interactive setup (configures and launches everything):"
echo "       bash docker/setup.sh"
echo ""
echo -e "${CYAN}The setup script will ask for your Clerk API keys, then start the app automatically.${RESET}"
echo ""
