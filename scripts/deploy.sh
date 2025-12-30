#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/legacy.mp.ls}"
REPO_URL="${REPO_URL:-https://github.com/patbritton/legacy.git}"
BRANCH="${BRANCH:-main}"
PORT="${PORT:-3001}"
OWNER_GROUP="www-data:www-data"
APPLY_PERMS="${APPLY_PERMS:-true}"

mkdir -p "$APP_DIR"
cd "$APP_DIR"

if [ ! -d .git ]; then
  if [ -n "$(ls -A)" ]; then
    echo "Error: $APP_DIR is not empty and not a git repository."
    exit 1
  fi
  git clone "$REPO_URL" .
fi

git fetch --all
git reset --hard "origin/$BRANCH"

if [ -f package-lock.json ]; then
  npm ci --production --ignore-scripts
else
  npm install --production --ignore-scripts
fi

npm run build

pm2 restart legacy-app || pm2 start npm --name legacy-app -- run start -- --port "$PORT"
if command -v sudo >/dev/null 2>&1; then
  sudo env PATH="$PATH" pm2 startup systemd -u www-data --hp /var/www
else
  pm2 startup systemd -u www-data --hp /var/www
fi
pm2 save

if [ "$APPLY_PERMS" = "true" ]; then
  chown -R "$OWNER_GROUP" "$APP_DIR"
  find "$APP_DIR" -type d -exec chmod 755 {} \;
  find "$APP_DIR" -type f -exec chmod 644 {} \;
  if [ -f "$APP_DIR/.env" ]; then
    chmod 600 "$APP_DIR/.env"
  fi
fi
