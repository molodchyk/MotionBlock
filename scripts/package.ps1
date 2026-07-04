param(
  [string]$OutputDirectory = ""
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Dist = if ($OutputDirectory) { $OutputDirectory } else { Join-Path $Root "dist" }
$Dist = [System.IO.Path]::GetFullPath($Dist)

if (-not (Test-Path -LiteralPath $Dist)) {
  New-Item -ItemType Directory -Path $Dist | Out-Null
}

$Manifest = Get-Content -LiteralPath (Join-Path $Root "manifest.json") -Raw | ConvertFrom-Json
$ZipPath = Join-Path $Dist ("motionblock-" + $Manifest.version + ".zip")

Get-ChildItem -LiteralPath $Dist -Filter "motionblock-*.zip" -File | Remove-Item -Force

$Temp = Join-Path $Dist ("motionblock-build-" + [guid]::NewGuid().ToString("n"))
New-Item -ItemType Directory -Path $Temp | Out-Null

function Copy-PackageItem {
  param([string]$RelativePath)

  $source = Join-Path $Root $RelativePath
  if (-not (Test-Path -LiteralPath $source)) {
    throw "Required package input is missing: $RelativePath"
  }

  $target = Join-Path $Temp $RelativePath
  $targetDirectory = Split-Path -Path $target -Parent
  if (-not (Test-Path -LiteralPath $targetDirectory)) {
    New-Item -ItemType Directory -Path $targetDirectory | Out-Null
  }

  Copy-Item -LiteralPath $source -Destination $target -Recurse -Force
}

try {
  $PackageInputs = @(
    "manifest.json",
    "_locales",
    "assets\icons",
    "src\app",
    "src\features",
    "src\platform",
    "src\background.js",
    "src\content.css",
    "src\content.js",
    "src\options.css",
    "src\options.html",
    "src\options.js",
    "src\popup.css",
    "src\popup.html",
    "src\popup.js",
    "src\shared"
  )

  foreach ($item in $PackageInputs) {
    Copy-PackageItem -RelativePath $item
  }

  Compress-Archive -Path (Join-Path $Temp "*") -DestinationPath $ZipPath
  Write-Host "Created $ZipPath"
}
finally {
  if (Test-Path -LiteralPath $Temp) {
    Remove-Item -LiteralPath $Temp -Recurse -Force
  }
}
