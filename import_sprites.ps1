# import_sprites.ps1
# Usage: clic-droit > Exécuter avec PowerShell
$ErrorActionPreference = "Stop"

function Copy-Sprites($src, $dst) {
  if (-not (Test-Path $src)) { throw "Dossier introuvable: $src" }
  if (-not (Test-Path $dst)) { New-Item -ItemType Directory -Path $dst | Out-Null }

  Get-ChildItem -Path $src -Filter *.png -Recurse | Where-Object {
    $_.BaseName -notmatch "_"
  } | ForEach-Object {
    $lower = ($_.BaseName.ToLower() + ".png")
    Copy-Item $_.FullName -Destination (Join-Path $dst $lower) -Force
  }
}

# 1) Sprites normaux -> assets\pkm
Copy-Sprites -src (Join-Path $PSScriptRoot "Front") -dst (Join-Path $PSScriptRoot "assets\pkm")

# 2) Sprites shiny -> assets\pkm_shiny
Copy-Sprites -src (Join-Path $PSScriptRoot "Front shiny") -dst (Join-Path $PSScriptRoot "assets\pkm_shiny")

Write-Host "Import terminé. Sprites normaux et shiny copiés."
