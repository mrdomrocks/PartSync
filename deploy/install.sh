#!/usr/bin/env bash
# Install PartSync from GitHub into $HOME/PartSync.
# That folder is the app: package.json, the build, and the database live there.
set -euo pipefail

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Run this as your normal user, not root. It asks for sudo only to install the service." >&2
  exit 1
fi

REPO="${PARTSYNC_REPO:-https://github.com/mrdomrocks/PartSync.git}"
ROOT="${PARTSYNC_ROOT:-$HOME/PartSync}"
APP="$ROOT"
PORT="${PARTSYNC_PORT:-4747}"
BRANCH="${PARTSYNC_BRANCH:-main}"
UNIT="/etc/systemd/system/partsync.service"

if [[ ! -f "$APP/package.json" && -f "$ROOT/partsync/package.json" ]]; then
  echo "This checkout still has the app inside $ROOT/partsync." >&2
  echo "Use a current copy, where package.json is in $ROOT." >&2
  exit 1
fi

if ! command -v sudo >/dev/null 2>&1; then
  echo "sudo is required to install the boot service." >&2
  exit 1
fi

sudo apt-get update
sudo apt-get install -y git build-essential python3 ca-certificates curl

need_node=0
if ! command -v node >/dev/null 2>&1; then
  need_node=1
else
  node_major="$(node -p "Number(process.versions.node.split('.')[0])")"
  node_minor="$(node -p "Number(process.versions.node.split('.')[1])")"
  if [[ "$node_major" -lt 20 || ( "$node_major" -eq 20 && "$node_minor" -lt 9 ) ]]; then
    need_node=1
  fi
fi
if [[ "$need_node" -eq 1 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
  hash -r
fi

NODE="$(command -v node)"

sudo systemctl stop partsync 2>/dev/null || true

if command -v ss >/dev/null 2>&1; then
  if ss -ltn | grep -qE ":${PORT}([^0-9]|$)"; then
    echo "Port ${PORT} is still in use after stopping PartSync. Nothing else was stopped." >&2
    exit 1
  fi
fi

if [[ -d "$ROOT/.git" ]]; then
  git -C "$ROOT" fetch origin "$BRANCH"
  git -C "$ROOT" checkout "$BRANCH"
  git -C "$ROOT" pull --ff-only origin "$BRANCH"
elif [[ -e "$ROOT" ]]; then
  echo "$ROOT already exists and is not a PartSync checkout." >&2
  exit 1
else
  git clone --branch "$BRANCH" "$REPO" "$ROOT"
fi

if [[ ! -f "$APP/package.json" ]]; then
  echo "The app was not found at $APP." >&2
  echo "package.json should be in the clone itself, next to deploy/." >&2
  exit 1
fi

cd "$APP"
npm install
npm run build

sudo tee "$UNIT" >/dev/null <<EOF
[Unit]
Description=PartSync stock monitor
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${USER}
WorkingDirectory=${APP}
Environment=NODE_ENV=production
EnvironmentFile=-${APP}/.env.local
ExecStart=${NODE} ${APP}/node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port ${PORT}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now partsync

address="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo "PartSync is running from ${APP}."
if [[ -n "${address}" ]]; then
  echo "Open http://${address}:${PORT}"
else
  echo "Open http://<this-machine-ip>:${PORT}"
fi
