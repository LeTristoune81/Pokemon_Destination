# --- Fix encodage "mojibake" (PokÃ©dex, CapacitÃ©s, etc.) ---
# Principe : on prend le texte actuel (déjà corrompu), on le re-transforme en octets Latin-1,
# puis on le redécode proprement en UTF-8. On sauvegarde en UTF-8 SANS BOM.

$latin1 = [System.Text.Encoding]::GetEncoding(28591)   # ISO-8859-1
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

Get-ChildItem -Recurse -Include *.html,*.css,*.js | ForEach-Object {
    $raw = Get-Content $_.FullName -Raw
    $bytes = $latin1.GetBytes($raw)
    $fixed = [System.Text.Encoding]::UTF8.GetString($bytes)

    # Ajoute <meta charset="utf-8"> si absent (IMPORTANT pour les pages HTML)
    if ($_.Extension -eq ".html" -and $fixed -notmatch '<meta\s+charset="utf-8"') {
        $fixed = $fixed -replace '(<head[^>]*>)', '$1`n  <meta charset="utf-8">'
    }

    # Normalise les liens "region/" (évite les problèmes d’accents dans les chemins)
    $fixed = $fixed -replace 'R%C3%83%C2%A9gion/', 'region/' `
                     -replace 'R%C3%A9gion/', 'region/' `
                     -replace 'Région/', 'region/'

    [System.IO.File]::WriteAllText($_.FullName, $fixed, $utf8NoBom)
    Write-Host "✔ Fixed: $($_.FullName)"
}

Write-Host "✅ Encodage normalisé. Vous pouvez redéployer."
