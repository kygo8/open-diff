param(
  [string] $Configuration = "release",
  [string] $Version = "1.0.0"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$releaseRoot = Join-Path $repoRoot "src-tauri\target\$Configuration"
$portableRoot = Join-Path $repoRoot "src-tauri\target\$Configuration\bundle\portable"
$stagingRoot = Join-Path $portableRoot "OpenDiff"
$archivePath = Join-Path $portableRoot "OpenDiff_${Version}_x64_portable.zip"

corepack pnpm tauri:build

if (Test-Path $stagingRoot) {
  Remove-Item -LiteralPath $stagingRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null

Copy-Item -LiteralPath (Join-Path $releaseRoot "open-diff-app.exe") -Destination (Join-Path $stagingRoot "open-diff-app.exe") -Force
Copy-Item -LiteralPath (Join-Path $releaseRoot "open-diff-cli.exe") -Destination (Join-Path $stagingRoot "open-diff-cli.exe") -Force
Copy-Item -LiteralPath (Join-Path $repoRoot "README.md") -Destination (Join-Path $stagingRoot "README.md") -Force
Copy-Item -LiteralPath (Join-Path $repoRoot "LICENSE") -Destination (Join-Path $stagingRoot "LICENSE") -Force

if (Test-Path $archivePath) {
  Remove-Item -LiteralPath $archivePath -Force
}

Compress-Archive -Path (Join-Path $stagingRoot "*") -DestinationPath $archivePath -CompressionLevel Optimal

Write-Output $archivePath
