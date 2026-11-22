#!/bin/bash
set -euo pipefail
test "$(id -u)" = 0
. /etc/os-release
test "$ID" = ubuntu && test "$VERSION_CODENAME" = noble
test "$(uname -m)" = x86_64

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl unattended-upgrades ufw
install -d -m 0755 /usr/share/keyrings /opt/blackbook/releases
install -d -m 0700 /etc/blackbook
id blackbook >/dev/null 2>&1 || useradd --system --user-group --home-dir /var/lib/blackbook --shell /usr/sbin/nologin blackbook

scratch="$(mktemp -d)"
trap 'rm -rf -- "$scratch"' EXIT
node_archive=node-v24.22.2-linux-x64.tar.xz
curl -fsSL --retry 3 "https://nodejs.org/dist/v24.22.2/$node_archive" -o "$scratch/$node_archive"
(
  cd "$scratch"
  printf '%s  %s\n' 48cc0e21e048790e54c0cf5749c2725005313d652651c40b7a21feb9697aaf75 "$node_archive" | sha256sum -c -
)
install -d -m 0755 /opt/blackbook/node
tar -xJf "$scratch/$node_archive" --strip-components=1 --no-same-owner -C /opt/blackbook/node

curl -fsSL --retry 3 https://pkgs.tailscale.com/stable/ubuntu/noble.noarmor.gpg -o "$scratch/tailscale.gpg"
curl -fsSL --retry 3 https://pkgs.tailscale.com/stable/ubuntu/noble.tailscale-keyring.list -o "$scratch/tailscale.list"
install -m 0644 "$scratch/tailscale.gpg" /usr/share/keyrings/tailscale-archive-keyring.gpg
install -m 0644 "$scratch/tailscale.list" /etc/apt/sources.list.d/tailscale.list
apt-get update
apt-get install -y tailscale
systemctl enable --now tailscaled.service

ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw --force enable
