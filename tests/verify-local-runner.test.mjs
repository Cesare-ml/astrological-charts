import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const runner = readFileSync(new URL('../scripts/verify-local.ps1', import.meta.url), 'utf8');
const guide = readFileSync(new URL('../docs/CONTRIBUTOR_QUICKSTART.md', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('Windows verification uses committed lockfile and canonical full Angular gate', () => {
  assert.match(runner, /Test-Path -LiteralPath 'package-lock\.json' -PathType Leaf/);
  assert.match(runner, /Invoke-VerificationStep -Index 0 -NpmArguments @\('ci'\)/);
  assert.match(runner, /Invoke-VerificationStep -Index 1 -NpmArguments @\('run','verify:angular'\)/);
  assert.doesNotMatch(runner, /@\('install'\)|npm install/);
  assert.equal(pkg.scripts['verify:angular'],
    'npm run preflight && npm run build:library && npm run build:demo');
  assert.match(guide, /npm run verify:angular/);
});

test('every recorded npm step captures exit status and a failed step aborts', () => {
  assert.match(runner, /\$steps\[\$Index\]\.exitCode = \[int\]\$exitCode/);
  assert.match(runner, /\$steps\[\$Index\]\.status = if \(\$exitCode -eq 0\) \{ 'PASS' \} else \{ 'FAIL' \}/);
  assert.match(runner, /if \(\$exitCode -ne 0\) \{/);
  assert.match(runner, /throw \('npm ' \+/);
  assert.match(runner, /if \(\$failure\) \{ throw \$failure \}/);
});

test('local JSON results state unexecuted browser and hardware gates', () => {
  assert.match(runner, /Join-Path '\.local' 'verify-local-report\.json'/);
  assert.match(runner, /ConvertTo-Json -Depth 5/);
  for (const name of ['browserChecks', 'originalArtworkParity', 'astrolabioIntegration']) {
    assert.match(runner, new RegExp(name + " = 'NOT RUN'"));
  }
  assert.match(runner, /\$report\.status = 'PASS'/);
  assert.match(runner, /\$report\.failure = \$failure/);
  assert.match(guide, /verify-local-report\.json/);
});

test('offline runner does not deploy, publish or invoke GitHub Actions', () => {
  assert.doesNotMatch(runner, /npm\s+publish|gh\s+workflow|git\s+push|aws\s+(?:s3|cloudformation|deploy)/i);
  assert.doesNotMatch(runner, /Start-Process|Invoke-WebRequest|Invoke-RestMethod/);
  assert.match(runner, /param\(\s*\[switch\]\$SkipInstall/);
  assert.match(runner, /-SkipInstall requires an existing node_modules directory/);
});

test('Windows sandbox reaches npm execution without a Git checkout or fake-version failure', () => {
  const integration = readFileSync(new URL('./verify-local-windows.integration.test.mjs', import.meta.url), 'utf8');
  assert.match(runner, /if \(\$gitCommand -and \(Test-Path -LiteralPath '\.git'\)\) \{/);
  assert.match(integration, /'if \/I "%1"=="--version" \('/);
  assert.match(integration, /'  echo 10\.9\.2'/);
  assert.match(integration, /assert\.equal\(result\.report\.npmVersion, '10\.9\.2'/);
  assert.match(integration, /assert\.equal\(result\.report\.revision, 'not available'/);
  assert.match(integration, /if \(skipInstall\) args\.push\('-SkipInstall'\)/);
});
