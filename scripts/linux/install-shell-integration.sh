#!/usr/bin/env bash
# Install Open Diff Linux file-manager Open With / shell-compare integration.
# Reuses the same --shell-compare flow as Windows Explorer verbs (P1).
set -euo pipefail

APP_PATH="${1:-}"
PRODUCT_NAME="${2:-Open Diff}"

if [[ -z "$APP_PATH" ]]; then
  if command -v open-diff-app >/dev/null 2>&1; then
    APP_PATH="$(command -v open-diff-app)"
  elif command -v open-diff-cli >/dev/null 2>&1; then
    APP_PATH="$(command -v open-diff-cli)"
  else
    echo "usage: $0 <open-diff-app-or-cli-path> [product-name]" >&2
    exit 2
  fi
fi

if [[ ! -e "$APP_PATH" ]]; then
  echo "application not found: $APP_PATH" >&2
  exit 1
fi

apps_dir="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
mkdir -p "$apps_dir"
desktop="$apps_dir/open-diff-compare.desktop"
exec_path=$(printf '%s' "$APP_PATH" | sed 's/"/\\"/g')

cat > "$desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Version=1.0
Name=Compare with ${PRODUCT_NAME}
GenericName=File Compare
Comment=Compare files or folders with ${PRODUCT_NAME}
Exec="${exec_path}" --shell-compare %f
Icon=utilities-file-compare
Terminal=false
Categories=Utility;Development;FileTools;
MimeType=text/plain;text/markdown;text/html;application/json;application/xml;inode/directory;
Keywords=diff;compare;open-diff;
Actions=SelectLeft;
StartupNotify=false

[Desktop Action SelectLeft]
Name=Select Left for Compare
Exec="${exec_path}" --shell-compare --select-left %f
DESKTOP

chmod 644 "$desktop"
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$apps_dir" >/dev/null 2>&1 || true
fi

echo "Installed $desktop"
echo "Try: open-diff-cli --help   or   open-diff-cli left right   or   open-diff-cli shell-compare [--select-left] <path>"
