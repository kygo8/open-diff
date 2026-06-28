#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

if [[ "${TAURI_SIGNING_IDENTITY:-}" == "" ]]; then
  corepack pnpm tauri build --bundles app,dmg --no-sign
else
  corepack pnpm tauri build --bundles app,dmg
fi
