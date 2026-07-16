param (
    [string]$ProjectPath = "."
)

$OutputFile = "contexte_backend.txt"

try {
    $ResolvedPath = (Resolve-Path $ProjectPath -ErrorAction Stop).Path
} catch {
    Write-Error "Repertoire invalide : $ProjectPath"
    exit 1
}

Write-Host "Scan du backend AGT Platform..." -ForegroundColor Cyan
Write-Host "Racine : $ResolvedPath"
Write-Host "Sortie : $OutputFile"

$excludeDirs = @("__pycache__", ".git", "node_modules", "staticfiles", "mediafiles", "migrations")
$alwaysInclude = @("models.py", "serializers.py", "views.py", "urls.py", "apps.py", "local.py", "strategy.py", "settings.py")
$extensions = @("*.py", "*.md", "*.yml", "*.yaml", "*.txt")

function Should-Exclude($path) {
    foreach ($dir in $excludeDirs) {
        if ($path -like "*\$dir\*") {
            $filename = Split-Path $path -Leaf
            if ($alwaysInclude -contains $filename) { return $false }
            return $true
        }
    }
    return $false
}

$files = Get-ChildItem -Path $ResolvedPath -Recurse -Include $extensions -File |
    Where-Object { -not (Should-Exclude $_.FullName) } |
    Sort-Object FullName

$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add("# CONTEXTE BACKEND - AGT Platform Django")
$lines.Add("# Genere le : $(Get-Date -Format 'yyyy-MM-dd HH:mm')")
$lines.Add("# Racine : $ResolvedPath")
$lines.Add("")

$count = 0
foreach ($file in $files) {
    $relativePath = $file.FullName.Replace($ResolvedPath, "").TrimStart("\")

    if ($file.Length -gt 200000) {
        $lines.Add("// FILE: $relativePath [OMIS - trop volumineux]")
        $lines.Add("")
        continue
    }

    $lines.Add("// FILE: $relativePath")
    $lines.Add("// -------------------------------------------------------------------------------")

    try {
        $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8 -ErrorAction Stop
        if ($content) { $lines.Add($content) }
    } catch {
        $lines.Add("// [Erreur lecture]")
    }

    $lines.Add("")
    $lines.Add("// END OF FILE: $relativePath")
    $lines.Add("")
    $count++
}

[System.IO.File]::WriteAllLines($OutputFile, $lines, [System.Text.Encoding]::UTF8)

$sizeKb = [math]::Round((Get-Item $OutputFile).Length / 1KB)
Write-Host "Scan termine ! $count fichiers - $sizeKb Ko" -ForegroundColor Green
Write-Host "Uploader contexte_backend.txt dans la memoire du projet Claude.ai"