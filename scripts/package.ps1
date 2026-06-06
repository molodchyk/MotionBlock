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

if (Test-Path -LiteralPath $ZipPath) {
  Remove-Item -LiteralPath $ZipPath -Force
}

$Temp = Join-Path $Dist ("motionblock-build-" + [guid]::NewGuid().ToString("n"))
New-Item -ItemType Directory -Path $Temp | Out-Null

try {
  $ExcludedDirectories = @("\dist\", "\.git\")
  Get-ChildItem -LiteralPath $Root -Recurse -File |
    Where-Object {
      $path = $_.FullName
      -not ($ExcludedDirectories | Where-Object { $path.Contains($_) })
    } |
    ForEach-Object {
      $relative = $_.FullName.Substring($Root.Path.Length).TrimStart("\")
      $target = Join-Path $Temp $relative
      $targetDirectory = Split-Path -Path $target -Parent
      if (-not (Test-Path -LiteralPath $targetDirectory)) {
        New-Item -ItemType Directory -Path $targetDirectory | Out-Null
      }
      Copy-Item -LiteralPath $_.FullName -Destination $target
    }

  Compress-Archive -Path (Join-Path $Temp "*") -DestinationPath $ZipPath
  Write-Host "Created $ZipPath"
}
finally {
  if (Test-Path -LiteralPath $Temp) {
    Remove-Item -LiteralPath $Temp -Recurse -Force
  }
}
