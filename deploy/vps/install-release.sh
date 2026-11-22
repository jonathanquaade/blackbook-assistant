#!/bin/bash
set -euo pipefail
test "$(id -u)" = 0
test "${1:-}" = "${1//[^a-f0-9]/}" && test "${#1}" = 40

base=/opt/blackbook
release="$base/releases/$1"
test ! -e "$release"
scratch="$(mktemp -d "$base/releases/.incoming.XXXXXXXX")"
link="$base/.current-$1"
trap 'rm -rf -- "$scratch"; rm -f -- "$link"' EXIT

tar xzf - --no-same-owner -C "$scratch"
test -f "$scratch/web/package-lock.json"
chown -R ubuntu:ubuntu "$scratch"
(
  cd "$scratch/web"
  runuser -u ubuntu -- env PATH="$base/node/bin:/usr/bin:/bin" npm ci --no-audit --no-fund
  runuser -u ubuntu -- env PATH="$base/node/bin:/usr/bin:/bin" NEXT_TELEMETRY_DISABLED=1 npm run build
)
chown -R root:root "$scratch"
chmod 0755 "$scratch"
mv -T "$scratch" "$release"
ln -s "$release" "$link"
mv -Tf "$link" "$base/current"
