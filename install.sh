#!/bin/sh
set -eu

# `pipefail` is not in POSIX sh, so it cannot go in the `set -eu` above: dash
# before 0.5.12 (and other strict shells) abort on the unknown option, and with
# `set -e` that kills the install outright. Probe in a subshell and enable it only
# where it exists. It matters here — this script pipes `curl` into `gpg`, `tee`,
# and `tar`, and without pipefail a failed download is masked by the exit status
# of the *last* command in the pipe, so a 404 would sail through as success.
if (set -o pipefail 2>/dev/null); then
  set -o pipefail
fi

REPO="ilyakooo0/skrepka"
INSTALL_BIN="/usr/local/bin/skrepka-server"
UNIT_DEST="/etc/systemd/system/skrepka.service"

DOMAIN="${DOMAIN:-${1:-}}"

if [ -z "$DOMAIN" ]; then
  echo "error: DOMAIN is required" >&2
  echo "usage: DOMAIN=skrepka.example.com sh install.sh" >&2
  exit 1
fi

# Normalize DOMAIN before it reaches the Caddyfile, the systemd unit, or
# --serverHost. Lowercase it, and strip a scheme, a path, and a :port if the
# operator pasted a URL. This is not cosmetic: --serverHost is the name clients
# bind their auth signature to ("skrepka-auth-v1:<host>:<challenge>", PROTOCOL.md
# §6) and the server compares it against the bare lowercased hostname, so
# "HTTPS://Relay.Example.com/" as-is would never match a client's signature. It is
# also the federation identity, which peers reject via isValidServerName unless it
# is lowercase and free of a trailing dot.
DOMAIN=$(printf '%s' "$DOMAIN" | tr 'A-Z' 'a-z' | sed 's|^[a-z][a-z0-9+.-]*://||; s|/.*||; s|:.*||; s|\.*$||')

# Validate what is left is a plausible hostname. An unvalidated DOMAIN is
# interpolated into a Caddyfile and a systemd unit, so a stray space, quote, or
# newline is a config-injection vector, not just a typo.
case "$DOMAIN" in
  "" | *[!a-z0-9.-]* | -* | .* )
    echo "error: DOMAIN must be a valid hostname (letters, digits, '.' and '-'), got: '${DOMAIN}'" >&2
    echo "usage: DOMAIN=skrepka.example.com sh install.sh" >&2
    exit 1
    ;;
esac

if [ "$(id -u)" -ne 0 ]; then
  echo "error: must be run as root" >&2
  exit 1
fi

# SHA-256 of $1 on stdout, or empty when no hashing tool exists. Linux ships
# sha256sum (coreutils); macOS ships shasum instead.
sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | cut -d' ' -f1
  else
    echo ""
  fi
}

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

  # CI only publishes server-macos-arm64; there is no Intel macOS asset, so bail
  # out here rather than 404ing on the download.
  if [ "$os_name" = "macos" ] && [ "$arch_name" != "arm64" ]; then
    echo "error: only arm64 (Apple silicon) macOS is supported; no release asset is built for Intel macOS" >&2
    exit 1
  fi

  echo "${os_name}-${arch_name}"
}

# Install Caddy with whichever package manager the host actually has. The
# upstream Debian repo recipe is apt-only; on RHEL-family hosts (which this
# script otherwise supports — see the firewalld branch below) `apt-get` does not
# exist and `set -e` would abort the whole install. Caddy ships an official COPR
# repo there instead.
install_caddy() {
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    apt-get update
    apt-get install -y caddy
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y 'dnf-command(copr)'
    dnf copr enable -y @caddy/caddy
    dnf install -y caddy
  elif command -v yum >/dev/null 2>&1; then
    yum install -y yum-plugin-copr
    yum copr enable -y @caddy/caddy
    yum install -y caddy
  elif command -v brew >/dev/null 2>&1; then
    brew install caddy
  else
    echo "error: no supported package manager found (apt-get, dnf, yum, brew)" >&2
    echo "install Caddy manually (https://caddyserver.com/docs/install), then re-run" >&2
    exit 1
  fi
}

PLATFORM=$(detect_platform)
ASSET="server-${PLATFORM}"

echo "Detected platform: ${PLATFORM}"
echo "Downloading latest release..."

DOWNLOAD_URL="https://github.com/${REPO}/releases/latest/download/${ASSET}"
CHECKSUM_URL="${DOWNLOAD_URL}.sha256"

# Download to a temp file next to the destination, then rename. Writing straight
# to $INSTALL_BIN fails with ETXTBSY while the service is running; rename(2) is
# atomic and happily replaces a busy binary (the running process keeps the old
# inode until it is restarted below).
TMP_BIN="${INSTALL_BIN}.new.$$"
TMP_SUM="${TMP_BIN}.sha256"
trap 'rm -f "$TMP_BIN" "$TMP_SUM"' EXIT INT TERM

# $1 = url, $2 = destination. Returns non-zero on any HTTP or transport error
# (curl -f, wget's default) so an optional download can be probed with `if`.
fetch_to() {
  if command -v curl >/dev/null 2>&1; then
    curl -fSL "$1" -o "$2"
  elif command -v wget >/dev/null 2>&1; then
    wget -q "$1" -O "$2"
  else
    echo "error: curl or wget required" >&2
    exit 1
  fi
}

fetch_to "$DOWNLOAD_URL" "$TMP_BIN"

# Verify the binary against the release's published SHA-256 before it is ever
# executed as root. This is the only integrity check in the chain: the download is
# HTTPS, but that authenticates GitHub's CDN, not the artifact — a compromised or
# swapped release asset would otherwise be installed and launched unquestioned.
#
# The check is best-effort by necessity: releases cut before CI began publishing
# .sha256 files have no checksum to compare against, and refusing to install from
# them would break upgrades from every existing deployment. So a *missing*
# checksum warns and proceeds, while a checksum that is present and does *not*
# match is fatal — the case that actually indicates tampering.
if fetch_to "$CHECKSUM_URL" "$TMP_SUM" 2>/dev/null; then
  EXPECTED=$(cut -d' ' -f1 < "$TMP_SUM")
  ACTUAL=$(sha256_of "$TMP_BIN")
  if [ -z "$ACTUAL" ]; then
    echo "warning: no sha256sum/shasum available; skipping checksum verification" >&2
  elif [ -z "$EXPECTED" ]; then
    echo "warning: checksum file is empty; skipping verification" >&2
  elif [ "$EXPECTED" != "$ACTUAL" ]; then
    echo "error: checksum verification FAILED for ${ASSET}" >&2
    echo "  expected: ${EXPECTED}" >&2
    echo "  actual:   ${ACTUAL}" >&2
    echo "refusing to install a binary that does not match its published checksum" >&2
    exit 1
  else
    echo "Checksum verified (${ACTUAL})"
  fi
else
  echo "warning: no published checksum at ${CHECKSUM_URL}; skipping verification" >&2
  echo "         (releases predating checksum publication have none)" >&2
fi

chmod 755 "$TMP_BIN"
mv -f "$TMP_BIN" "$INSTALL_BIN"
echo "Installed binary to ${INSTALL_BIN}"

case "$PLATFORM" in
  linux-*)
    cat > "$UNIT_DEST" <<EOF
[Unit]
Description=Skrepka relay server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
# --bindHost keeps the relay on the loopback interface. Caddy terminates TLS and
# reverse-proxies to localhost:8080, so nothing needs to reach the backend
# directly — and it must not. The server trusts X-Forwarded-For for rate-limit
# and session-IP bucketing (--trustForwardedFor defaults to True, which is correct
# *behind* Caddy), so a backend reachable from the internet lets any client set
# that header itself and mint a fresh rate-limit bucket per request, defeating
# every per-IP limit at once.
# --serverHost is the federation identity AND the hostname clients bind their
# auth signature to ("skrepka-auth-v1:<host>:<challenge>"). It defaults to
# "localhost", which no client ever dials, so /auth/verify would reject every
# signature. It must be the public name clients use to reach this relay.
# --http-max-body-bytes must exceed maxBlobLen (40 MiB hex) plus the JSON
# envelope, otherwise the runtime's default 16 MiB body cap rejects a
# max-size blob with 413 before the handler's BlobHex check is ever reached.
#
# WARNING: as of Knot 2026.6.26.1947 the runtime ACCEPTS but SILENTLY IGNORES
# --<name>=<value> constant overrides; only --debug, --help and
# --http-max-body-bytes are honoured at startup (constant overrides currently work
# only at `knot build` time). So --bindHost and --serverHost below are inert on
# today's released binary: it listens on 0.0.0.0:8080 regardless. They are kept
# because they are the documented interface and become effective the moment the
# runtime honours them. Until then the loopback restriction is enforced at the
# firewall instead (see the port-8080 rules below) — do not remove those on the
# assumption that --bindHost is doing the work.
ExecStart=/usr/local/bin/skrepka-server --bindHost=127.0.0.1 --serverHost=${DOMAIN} --http-max-body-bytes=42M
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

    if ! command -v caddy >/dev/null 2>&1; then
      echo "Installing Caddy..."
      install_caddy
    fi

    mkdir -p /etc/caddy
    cat > /etc/caddy/Caddyfile <<CADDYEOF
${DOMAIN} {
    reverse_proxy localhost:8080
}
CADDYEOF

    # Ports 80/443 are the public surface (Caddy). Port 8080 — the relay backend —
    # must never be reachable from off-box: it speaks plain HTTP and trusts
    # X-Forwarded-For, so a direct caller can forge that header and bypass every
    # per-IP rate limit. This is normally the job of --bindHost=127.0.0.1 in the
    # unit above, but the current runtime ignores constant overrides (see the
    # WARNING there), so the binary really is listening on 0.0.0.0:8080 and the
    # firewall is what actually closes it. Loopback is unaffected by these rules —
    # ufw always permits the `lo` interface and firewalld puts it in the trusted
    # zone — so Caddy -> localhost:8080 keeps working.
    if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "active"; then
      echo "Opening ports 80, 443 and blocking 8080 (ufw)..."
      ufw allow 80/tcp
      ufw allow 443/tcp
      ufw deny 8080/tcp
    elif command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active --quiet firewalld; then
      echo "Opening ports 80, 443 (firewalld)..."
      firewall-cmd --add-port=80/tcp --permanent
      firewall-cmd --add-port=443/tcp --permanent
      # firewalld denies anything not explicitly opened, so 8080 is already closed;
      # just make sure a previous install did not leave it open.
      firewall-cmd --remove-port=8080/tcp --permanent 2>/dev/null || true
      firewall-cmd --reload
    else
      echo "" >&2
      echo "WARNING: no active ufw/firewalld found — port 8080 was NOT firewalled." >&2
      echo "  The relay backend listens on 0.0.0.0:8080 in plain HTTP and trusts" >&2
      echo "  X-Forwarded-For, so anyone who can reach it directly can spoof that" >&2
      echo "  header and bypass all per-IP rate limiting." >&2
      echo "  Block inbound 8080 at your host or cloud firewall / security group." >&2
      echo "" >&2
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

    systemctl restart caddy
    echo "Caddy configured for https://${DOMAIN}"
    echo "Check status with: systemctl status skrepka"
    ;;
  *)
    echo "Binary installed. Systemd service setup skipped (not Linux)."
    ;;
esac
