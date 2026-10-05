#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

# ssh2 links vendored OpenSSL (see remote-core), so the .app does not need
# Homebrew libssl at runtime. Apple notarization still requires a Developer ID
# certificate + notary credentials; without them we ship an ad-hoc / unsigned
# DMG and document Gatekeeper right-click → Open for first launch.

if [[ "${TAURI_SIGNING_IDENTITY:-}" == "" ]]; then
  echo "Open Diff macOS: building without Apple signing identity (ad-hoc / unsigned)."
  echo "Set TAURI_SIGNING_IDENTITY (and notary env vars) to produce a notarized DMG."
  corepack pnpm tauri build --bundles app,dmg --no-sign
else
  corepack pnpm tauri build --bundles app,dmg
fi
