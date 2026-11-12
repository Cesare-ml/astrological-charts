# Repeatable LOCAL Windows verification; no GitHub Actions or production writes.
# Run from any working directory. Requires PowerShell 5.1+ and Angular-compatible Node.
param(
    [switch]$SkipInstall
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$steps = @(
    [pscustomobject]@{ command = 'npm ci'; status = 'NOT RUN'; exitCode = $null },
    [pscustomobject]@{ command = 'npm run verify:angular'; status = 'NOT RUN'; exitCode = $null }
)
$report = [ordered]@{
    schemaVersion = 1
    command = 'scripts/verify-local.ps1'
    revision = 'not available'
    nodeVersion = 'not available'
    npmVersion = 'not available'
    installSkipped = [bool]$SkipInstall
    steps = $steps
    browserChecks = 'NOT RUN'
    originalArtworkParity = 'NOT RUN'
    astrolabioIntegration = 'NOT RUN'
    status = 'FAIL'
    failure = $null
}

function Invoke-VerificationStep {
    param(
        [int]$Index,
        [string[]]$NpmArguments
    )
    Write-Host ('> npm ' + ($NpmArguments -join ' ')) -ForegroundColor Cyan
    & npm.cmd @NpmArguments
    $exitCode = $LASTEXITCODE
    $steps[$Index].exitCode = [int]$exitCode
    $steps[$Index].status = if ($exitCode -eq 0) { 'PASS' } else { 'FAIL' }
    if ($exitCode -ne 0) {
        throw ('npm ' + ($NpmArguments -join ' ') + ' exited with code ' + $exitCode)
    }
}

$failure = $null
Push-Location $root
try {
    Get-Command node.exe -ErrorAction Stop | Out-Null
    Get-Command npm.cmd -ErrorAction Stop | Out-Null

    $report.nodeVersion = (& node.exe --version | Select-Object -First 1)
    if ($LASTEXITCODE -ne 0) { throw 'node --version failed' }
    $report.npmVersion = (& npm.cmd --version | Select-Object -First 1)
    if ($LASTEXITCODE -ne 0) { throw 'npm --version failed' }
    $gitCommand = Get-Command git.exe -ErrorAction SilentlyContinue
    # A disposable Windows test sandbox is deliberately NOT a Git checkout.
    # Skip rev-parse there: under ErrorActionPreference=Stop, Git's stderr
    # outside a repository can otherwise abort verification before npm runs.
    if ($gitCommand -and (Test-Path -LiteralPath '.git')) {
        $sha = & git.exe rev-parse --verify HEAD 2>$null
        if ($LASTEXITCODE -eq 0) { $report.revision = ($sha | Select-Object -First 1) }
    }

    if (!(Test-Path -LiteralPath 'package-lock.json' -PathType Leaf)) {
        throw 'Missing package-lock.json: reproducible verification requires a committed lockfile'
    }

    if ($SkipInstall) {
        if (!(Test-Path -LiteralPath 'node_modules' -PathType Container)) {
            throw '-SkipInstall requires an existing node_modules directory'
        }
        $steps[0].status = 'SKIPPED'
    } else {
        Invoke-VerificationStep -Index 0 -NpmArguments @('ci')
    }
    # This is the canonical repository gate: it runs preflight, the library
    # build and the Angular demo build in that order. Do not substitute
    # the older, incomplete check:types + build sequence.
    Invoke-VerificationStep -Index 1 -NpmArguments @('run','verify:angular')
    $report.status = 'PASS'
    Write-Host 'Node, preflight and both Angular builds passed.' -ForegroundColor Green
} catch {
    $failure = $_.Exception.Message
    $report.failure = $failure
    Write-Host ('Verification failed: ' + $failure) -ForegroundColor Red
} finally {
    try {
        if (!(Test-Path -LiteralPath '.local' -PathType Container)) {
            New-Item -ItemType Directory -Path '.local' -Force | Out-Null
        }
        $reportFile = Join-Path '.local' 'verify-local-report.json'
        $report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $reportFile -Encoding UTF8
        Write-Host ('Local result: ' + $report.status + ' (report: ' + $reportFile + ')')
        Write-Host 'Browser/WebGL, original-artwork parity and Astrolabio: NOT RUN.'
    } finally {
        Pop-Location
    }
}
if ($failure) { throw $failure }
