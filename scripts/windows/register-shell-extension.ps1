param(
  [Parameter(Mandatory = $true)]
  [string]$AppPath,

  [string]$ProductName = 'Open Diff',

  [string]$VerbKey = 'OpenDiff'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $AppPath -PathType Leaf)) {
  throw "Application executable not found: $AppPath"
}

$label = "Compare with $ProductName"
$command = "`"$AppPath`" --shell-compare `"%1`""
$entries = @(
  @{
    Key = "HKCU:\Software\Classes\*\shell\$VerbKey"
    Label = $label
    Command = $command
  },
  @{
    Key = "HKCU:\Software\Classes\Directory\shell\$VerbKey"
    Label = $label
    Command = $command
  }
)

foreach ($entry in $entries) {
  New-Item -Path $entry.Key -Force | Out-Null
  New-ItemProperty -Path $entry.Key -Name 'MUIVerb' -Value $entry.Label -PropertyType String -Force |
    Out-Null
  New-ItemProperty -Path $entry.Key -Name 'Icon' -Value $AppPath -PropertyType String -Force |
    Out-Null
  New-Item -Path "$($entry.Key)\command" -Force | Out-Null
  Set-ItemProperty -Path "$($entry.Key)\command" -Name '(default)' -Value $entry.Command
}

Write-Host "Registered $ProductName context menu entries for files and folders."
