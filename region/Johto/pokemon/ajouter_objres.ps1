# ajoute le bloc "Objet tenu & Ressource" à tous les fichiers HTML du dossier
$files = Get-ChildItem -Path . -Filter *.html
foreach ($f in $files) {
    $content = Get-Content $f.FullName -Raw
    if ($content -notmatch 'id="objres"') {
        $pattern = '<div class="h2">Pokédex</div>'
        $injection = @"
<div class="h2">Objet tenu & Ressource</div>
<ul id="objres"></ul>

$pattern
"@
        $newContent = $content -replace [regex]::Escape($pattern), $injection
        Set-Content -Path $f.FullName -Value $newContent -Encoding UTF8
        Write-Host "✅ Modifié :" $f.Name
    } else {
        Write-Host "Déjà présent :" $f.Name
    }
}
Write-Host "Terminé."
