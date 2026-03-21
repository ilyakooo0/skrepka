#!/bin/sh
set -eu

REPO="ilyakooo0/skrepka"
INSTALL_BIN="/usr/local/bin/skrepka-server"
UNIT_DEST="/etc/systemd/system/skrepka.service"

if [ "$(id -u)" -ne 0 ]; then
  echo "error: must be run as root" >&2
  exit 1
fi

detect_platform() {
  os=$(uname -s)
  arch=$(uname -m)

  case "$os" in
    Linux)  os_name="linux" ;;
    Darwin) os_name="macos" ;;
    *) echo "error: unsupported OS: $os" >&2; exit 1 ;;
  esac

  case "$arch" in
    x86_64|amd64)  arch_name="x86_64" ;;
    aarch64|arm64) arch_name="arm64" ;;
    *) echo "error: unsupported architecture: $arch" >&2; exit 1 ;;
  esac

  echo "${os_name}-${arch_name}"
}

PLATFORM=$(detect_platform)
ASSET="server-${PLATFORM}"

echo "Detected platform: ${PLATFORM}"
echo "Downloading latest release..."

DOWNLOAD_URL="https://github.com/${REPO}/releases/latest/download/${ASSET}"

if command -v curl >/dev/null 2>&1; then
  curl -fSL "$DOWNLOAD_URL" -o "$INSTALL_BIN"
elif command -v wget >/dev/null 2>&1; then
  wget -q "$DOWNLOAD_URL" -O "$INSTALL_BIN"
else
  echo "error: curl or wget required" >&2
  exit 1
fi

chmod 755 "$INSTALL_BIN"
echo "Installed binary to ${INSTALL_BIN}"

case "$PLATFORM" in
  linux-*)
    cat > "$UNIT_DEST" <<'EOF'
[Unit]
Description=Skrepka relay server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/skrepka-server
Restart=on-failure
RestartSec=5

DynamicUser=yes
StateDirectory=skrepka
WorkingDirectory=/var/lib/skrepka

ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
NoNewPrivileges=yes

[Install]
WantedBy=multi-user.target
EOF

    if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "active"; then
      echo "Opening port 8080 (ufw)..."
      ufw allow 8080/tcp
    elif command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active --quiet firewalld; then
      echo "Opening port 8080 (firewalld)..."
      firewall-cmd --add-port=8080/tcp --permanent
      firewall-cmd --reload
    fi

    systemctl daemon-reload
    if systemctl is-active --quiet skrepka; then
      echo "Restarting existing service..."
      systemctl restart skrepka
      echo "Service restarted with updated binary."
    else
      systemctl enable --now skrepka
      echo "Service enabled and started."
    fi
    echo "Check status with: systemctl status skrepka"
    ;;
  *)
    echo "Binary installed. Systemd service setup skipped (not Linux)."
    ;;
esac
