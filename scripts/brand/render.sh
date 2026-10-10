#!/usr/bin/env bash
# Renders the X (Twitter) profile assets to scripts/brand/out/ at twice their display size.
# Usage: scripts/brand/render.sh   (needs Google Chrome or Chromium)
set -euo pipefail
cd "$(dirname "$0")"
chrome=$(command -v google-chrome || command -v chromium || command -v chromium-browser)
mkdir -p out

shoot() { # file width height output
  "$chrome" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
    --window-size="$2,$3" --screenshot="out/$4" "file://$PWD/$1" 2>/dev/null
  echo "out/$4"
}

shoot x-banner.html 1500 500 x-banner.png
shoot x-avatar.html 500 500 x-avatar.png
