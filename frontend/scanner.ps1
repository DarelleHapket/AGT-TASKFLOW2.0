<#
.SYNOPSIS
Extrait le code source d'un projet Next.js pour l'utiliser comme contexte IA.
FIX : Utilise StreamWriter au lieu de Add-Content pour éviter les erreurs de verrouillage.
#>

param (
    [string]$ProjectPath = "."
)

$OutputFilename = "contexte_frontend_PME.txt"

# Résolution du chemin absolu
try {
    $ResolvedPath = (Resolve-Path $ProjectPath -ErrorAction Stop).Path
} catch {
    Write-Error "Erreur: Répertoire invalide ($ProjectPath)."
    exit 1
}

$OutputFile = Join-Path $ResolvedPath $OutputFilename

# Suppression de l'ancien fichier s'il existe
if (Test-Path $OutputFile) {
    Remove-Item $OutputFile -Force
}

# Dossiers à ignorer
$ExcludeDirs = @(
    ".git", ".vscode", ".idea", "node_modules", ".next", 
    "out", "build", "coverage", "public", "dist", ".vercel"
)

# Fichiers à ignorer — on ajoute aussi le chemin complet du fichier de sortie
$ExcludeFiles = @(
    "*.log", "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb",
    ".env*", "*.ico", "*.png", "*.jpg", "*.jpeg", "*.svg", "*.webp", 
    "*.pdf", "*.map", "*.ttf", "*.woff", "*.woff2", "*.eot", "*.mp4",
    $OutputFilename,
    "contexte_frontend",
    "contexte_admin"
)

# Fonction pour vérifier si un fichier est binaire
function Test-IsBinary {
    param ([string]$FilePath)
    try {
        $bytes = [System.IO.File]::ReadAllBytes($FilePath)
        $checkLength = [math]::Min(1024, $bytes.Length)
        for ($i = 0; $i -lt $checkLength; $i++) {
            if ($bytes[$i] -eq 0) { return $true }
        }
        return $false
    } catch {
        return $true
    }
}

$foundFiles = [System.Collections.Generic.List[string]]::new()

function Get-ValidFiles {
    param ([string]$CurrentDir)
    
    $items = Get-ChildItem -Path $CurrentDir -Force -ErrorAction SilentlyContinue
    
    foreach ($item in $items) {
        if ($item.PSIsContainer) {
            if ($ExcludeDirs -notcontains $item.Name) {
                Get-ValidFiles -CurrentDir $item.FullName
            }
        } else {
            # === SÉCURITÉ SUPPLÉMENTAIRE : ignorer si c'est le fichier de sortie ===
            if ($item.FullName -eq $OutputFile) { continue }

            $skip = $false
            foreach ($pattern in $ExcludeFiles) {
                if ($item.Name -like $pattern) {
                    $skip = $true
                    break
                }
            }
            if (-not $skip) {
                $foundFiles.Add($item.FullName)
            }
        }
    }
}

Write-Host "Recherche des fichiers en cours..." -ForegroundColor Cyan
Get-ValidFiles -CurrentDir $ResolvedPath
Write-Host "  -> $($foundFiles.Count) fichiers trouvés." -ForegroundColor Gray

# ==============================================================================
#  FIX PRINCIPAL : On utilise un StreamWriter unique pour tout le fichier
#  Au lieu de Add-Content qui ouvre/ferme le fichier à chaque appel
# ==============================================================================

$dateStr = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$header = @"
Next.js Project Context
Generated On: $dateStr
Root: $ResolvedPath
===============================================
"@

Write-Host "Génération du fichier de contexte en cours..." -ForegroundColor Cyan

# Ouvrir le fichier UNE SEULE FOIS avec StreamWriter
$stream = [System.IO.StreamWriter]::new($OutputFile, $false, [System.Text.Encoding]::UTF8)

try {
    # Écriture de l'en-tête
    $stream.WriteLine($header)

    $count = 0
    foreach ($file in $foundFiles) {
        $count++
        $relativePath = $file.Substring($ResolvedPath.Length).TrimStart('\')
        $relativePath = $relativePath -replace '\\', '/'

        # En-tête du fichier
        $stream.WriteLine("")
        $stream.WriteLine("// FILE: $relativePath")
        $stream.WriteLine("-----------------------------------------------")

        if (Test-IsBinary -FilePath $file) {
            $stream.WriteLine("[Fichier binaire ou asset omis]")
        } else {
            try {
                $content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
                if ($null -ne $content) {
                    $stream.Write($content)
                    # S'assurer qu'on termine par un saut de ligne
                    if (-not $content.EndsWith("`n")) {
                        $stream.WriteLine("")
                    }
                }
            } catch {
                $stream.WriteLine("[Erreur lors de la lecture du fichier]")
            }
        }

        $stream.WriteLine("")
        $stream.WriteLine("// END OF FILE: $relativePath")

        # Progression tous les 50 fichiers
        if ($count % 50 -eq 0) {
            Write-Host "  -> $count / $($foundFiles.Count) fichiers traités..." -ForegroundColor Gray
        }
    }
} finally {
    # Toujours fermer le stream, même en cas d'erreur
    $stream.Close()
    $stream.Dispose()
}

$sizeMB = [math]::Round((Get-Item $OutputFile).Length / 1MB, 2)
Write-Host ""
Write-Host "Succès ! Contexte Next.js prêt :" -ForegroundColor Green
Write-Host "  Fichier : $OutputFile" -ForegroundColor Green
Write-Host "  Fichiers inclus : $count" -ForegroundColor Green
Write-Host "  Taille : $sizeMB MB" -ForegroundColor Green