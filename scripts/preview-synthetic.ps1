# Local asset-only preview. No source VirgoStars, AWS, user data or real artwork.
# The script seeds an original 78-PNG synthetic pack and opens a localhost-only server.
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    & node.exe --version
    if ($LASTEXITCODE -ne 0) { throw "Node.js 20+ is required." }

    $packDir = Join-Path $projectRoot ".local\synthetic-pack"
    $packRoot = Join-Path $packDir "public\assets"
    $manifest = Join-Path $packDir "manifests\approved-assets.json"

    if (!(Test-Path -LiteralPath $manifest -PathType Leaf)) {
        if (Test-Path -LiteralPath $packDir) {
            throw "Synthetic folder exists without a complete manifest. Inspect and delete the folder manually, then rerun."
        }
        & node.exe "scripts/generate-synthetic-pack.mjs" --out $packDir
        if ($LASTEXITCODE -ne 0) { throw "Synthetic asset generation failed." }
    }
    Write-Host "Preview: http://127.0.0.1:4177/__preview"
    Write-Host "Press Ctrl+C to stop the server."
    & node.exe "scripts/serve-local-assets.mjs" --root $packRoot --manifest $manifest
    if ($LASTEXITCODE -ne 0) { throw "Approved asset preview server exited with error." }
} finally {
    Pop-Location
}
