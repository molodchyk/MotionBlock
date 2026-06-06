param(
  [int]$Port = 8765
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$TestDirectory = Join-Path $Root "test"

Write-Host "Serving MotionBlock fixtures at http://127.0.0.1:$Port/fixtures.html"
python -m http.server $Port --bind 127.0.0.1 --directory $TestDirectory
