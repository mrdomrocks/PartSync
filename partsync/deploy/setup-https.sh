#!/usr/bin/env bash
# Put PartSync behind HTTPS on its usual port with Caddy and a certificate made on this Pi.
#
#   sudo ./deploy/setup-https.sh          set it up, or refresh it after the Pi's address changes
#   sudo ./deploy/setup-https.sh --undo   go back to plain http on the same port
set -euo pipefail

PORT="${PARTSYNC_PORT:-4747}"
APP_PORT="${PARTSYNC_APP_PORT:-4748}"
SERVICE="${PARTSYNC_SERVICE:-partsync}"
DROPIN="/etc/systemd/system/${SERVICE}.service.d/https.conf"
CADDYFILE="/etc/caddy/Caddyfile"
MARK="# Written by PartSync deploy/setup-https.sh"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run this with sudo." >&2
  exit 1
fi
if ! systemctl cat "$SERVICE" >/dev/null 2>&1; then
  echo "There is no $SERVICE service yet. Install deploy/partsync.service first (see the README)." >&2
  exit 1
fi

if [[ "${1:-}" == "--undo" ]]; then
  rm -f "$DROPIN"
  if [[ -f "$CADDYFILE" ]] && grep -qF "$MARK" "$CADDYFILE"; then
    systemctl disable --now caddy || true
    rm -f "$CADDYFILE"
  fi
  systemctl daemon-reload
  systemctl restart "$SERVICE"
  echo "PartSync is back on plain http://<pi-address>:$PORT."
  exit 0
fi

if [[ -f "$CADDYFILE" ]] && ! grep -qF "$MARK" "$CADDYFILE" \
  && ! grep -qF "The Caddyfile is an easy way to configure your Caddy web server" "$CADDYFILE"; then
  echo "$CADDYFILE already has someone else's config. Merge the PartSync site into it by hand." >&2
  exit 1
fi

if ! command -v caddy >/dev/null 2>&1; then
  apt-get update
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
    | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
    > /etc/apt/sources.list.d/caddy-stable.list
  chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
fi

# The certificate names every address people might type, so list them all.
NAME="$(hostname)"
SITES=("https://localhost:$PORT" "https://$NAME:$PORT" "https://$NAME.local:$PORT")
for ip in $(hostname -I); do
  if [[ "$ip" == *:* ]]; then
    [[ "$ip" == fe80:* ]] || SITES+=("https://[$ip]:$PORT")
  else
    SITES+=("https://$ip:$PORT")
  fi
done
SITE_LIST="$(IFS=,; echo "${SITES[*]}" | sed 's/,/, /g')"

cat > "$CADDYFILE" <<EOF
$MARK
{
	auto_https disable_redirects
	servers :$PORT {
		listener_wrappers {
			http_redirect
			tls
		}
	}
}

$SITE_LIST {
	tls internal
	reverse_proxy 127.0.0.1:$APP_PORT
}
EOF
caddy validate --config "$CADDYFILE" --adapter caddyfile

APP_DIR="$(systemctl show -p WorkingDirectory --value "$SERVICE")"
NEXT_BIN="$APP_DIR/node_modules/next/dist/bin/next"
if [[ ! -f "$NEXT_BIN" ]]; then
  echo "Could not find $NEXT_BIN. Run npm install and npm run build in $APP_DIR first." >&2
  exit 1
fi
mkdir -p "$(dirname "$DROPIN")"
cat > "$DROPIN" <<EOF
$MARK
[Service]
Environment=PARTSYNC_SECURE_COOKIES=1
ExecStart=
ExecStart=$(command -v node) $NEXT_BIN start --hostname 127.0.0.1 --port $APP_PORT
EOF

systemctl daemon-reload
systemctl restart "$SERVICE"
systemctl enable caddy
systemctl restart caddy

ROOT_CA="/var/lib/caddy/.local/share/caddy/pki/authorities/local/root.crt"
FIRST_IP="$(hostname -I | awk '{print $1}')"
echo
echo "PartSync is on https://${FIRST_IP}:$PORT (also https://$NAME.local:$PORT)."
echo "http:// on that port now redirects to https://."
echo "Each browser warns about the certificate once. To stop the warning, install this file"
echo "as a trusted root certificate on each computer or phone: $ROOT_CA"
echo "If the Pi's address changes, run this script again. A DHCP reservation on the router avoids that."
