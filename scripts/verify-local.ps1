# Run locally in a fresh checkout. Requires Node compatible with Angular 20.
# NEVER publishes, deploys or touches the VirgoStars production repository.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
    Get-Command node.exe -ErrorAction Stop | Out-Null
    Get-Command npm.cmd -ErrorAction Stop | Out-Null
    Write-Host 'Node:' -ForegroundColor Cyan
    & node.exe --version
    Write-Host 'npm:' -ForegroundColor Cyan
    & npm.cmd --version
    if (!(Test-Path -LiteralPath 'package-lock.json' -PathType Leaf)) {
        throw 'Missing package-lock.json: use a clean checkout with the tracked lockfile. Refusing an unpinned npm install.'
    }
    # One quality gate is the source of truth: avoid skipping newly added tests.
    # Browser/WebGL rendering remains an explicit separate step.
    $steps = @(
        ,@('ci'),
        ,@('run', 'preflight'),
        ,@('run', 'build:library'),
        ,@('run', 'build:demo')
    )
    foreach ($stepArgs in $steps) {
        Write-Host ('> npm ' + ($stepArgs -join ' ')) -ForegroundColor Cyan
        & npm.cmd @stepArgs
        if ($LASTEXITCODE -ne 0) {
            throw ('Verification stopped: npm ' + ($stepArgs -join ' ') + ' exited ' + $LASTEXITCODE)
        }
    }
    Write-Host 'Local preflight, library and demo builds passed.' -ForegroundColor Green
    Write-Host 'NOT validated: Chromium/Firefox PNG pixels, real asset fidelity, or Astrolabio hardware. To run the focused WebGL regression separately: npm run test:latitude:local' -ForegroundColor Yellow
} finally {
    Pop-Location
}
