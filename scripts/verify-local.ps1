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
    $steps = @()
    if (Test-Path 'package-lock.json') {
        $steps += ,@('ci')
    } else {
        $steps += ,@('install')
        Write-Warning 'No package-lock.json. This run will generate a local lockfile; commit it only after reviewing the dependency tree.'
    }
    $steps += ,@('run', 'check:extraction')
    $steps += ,@('run', 'check:assets')
    $steps += ,@('run', 'check:types')
    $steps += ,@('run', 'build')
    foreach ($args in $steps) {
        Write-Host ('> npm ' + ($args -join ' ')) -ForegroundColor Cyan
        & npm.cmd @args
        if ($LASTEXITCODE -ne 0) {
            throw ('Verification stopped: npm ' + ($args -join ' ') + ' exited ' + $LASTEXITCODE)
        }
    }
    Write-Host 'Local build/preflight completed. Visual output, actual asset loading, browser and Astrolabio compatibility are NOT validated.' -ForegroundColor Green
} finally {
    Pop-Location
}
