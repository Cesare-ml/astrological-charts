import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Real Windows PowerShell 5.1 execution, but with a disposable project root
// and fake npm.cmd. No npm install, network, production code or Actions.
const windows = process.platform === 'win32';
const runner = readFileSync(new URL('../scripts/verify-local.ps1', import.meta.url), 'utf8');
const cmdStub = [
  '@echo off',
  'echo %*>>"%QA_CALL_LOG%"',
  'if /I "%1"=="ci" (',
  '  if /I "%QA_FAIL_STEP%"=="ci" exit /b 17',
  '  exit /b 0',
  ')',
  'if /I "%1"=="run" if /I "%2"=="verify:angular" (',
  '  if /I "%QA_FAIL_STEP%"=="verify" exit /b 23',
  '  exit /b 0',
  ')',
  'exit /b 98',
  '',
].join('\r\n');

function runSandbox({ lockfile = true, modules = false, failure = '', skipInstall = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'charts qa sandbox '));
  const scripts = join(root, 'scripts');
  const mocks = join(root, 'mock-binaries');
  const log = join(root, 'calls.txt');
  mkdirSync(scripts, { recursive: true });
  mkdirSync(mocks, { recursive: true });
  try {
    writeFileSync(join(scripts, 'verify-local.ps1'), runner);
    writeFileSync(join(mocks, 'npm.cmd'), cmdStub);
    if (lockfile) writeFileSync(join(root, 'package-lock.json'), '{}\n');
    if (modules) mkdirSync(join(root, 'node_modules'));
    const pathName = Object.keys(process.env).find(name => name.toLowerCase() === 'path') ?? 'PATH';
    const env = {
      ...process.env,
      [pathName]: mocks + ';' + (process.env[pathName] ?? ''),
      QA_CALL_LOG: log,
      QA_FAIL_STEP: failure,
    };
    const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', join(scripts, 'verify-local.ps1')];
    if (skipInstall) args.push('-SkipInstall');
    const result = spawnSync('powershell.exe', args, {
      cwd: root, env, encoding: 'utf8', timeout: 60000, windowsHide: true
    });
    assert.ifError(result.error);
    const reportFile = join(root, '.local', 'verify-local-report.json');
    assert.ok(existsSync(reportFile),
      'PowerShell must save a report even for a handled failure: ' + result.stderr);
    // Windows PowerShell 5.1 Set-Content -Encoding UTF8 writes a BOM.
    const report = JSON.parse(readFileSync(reportFile, 'utf8').replace(/^\uFEFF/, ''));
    const calls = existsSync(log) ? readFileSync(log, 'utf8').split(/\r?\n/).filter(Boolean) : [];
    return { status: result.status, report, calls, stdout: result.stdout, stderr: result.stderr };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('real PowerShell runner records two successful mocked npm steps', { skip: !windows }, () => {
  const result = runSandbox();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.report.status, 'PASS');
  assert.deepEqual(result.report.steps.map(step => [step.status, step.exitCode]),
    [['PASS', 0], ['PASS', 0]]);
  assert.deepEqual(result.calls, ['ci', 'run verify:angular']);
  for (const field of ['browserChecks', 'originalArtworkParity', 'astrolabioIntegration'])
    assert.equal(result.report[field], 'NOT RUN');
  assert.match(result.report.nodeVersion, /^v\d+/);
  assert.equal(result.report.installSkipped, false);
});

test('real PowerShell runner stops on mocked npm ci failure', { skip: !windows }, () => {
  const result = runSandbox({ failure: 'ci' });
  assert.notEqual(result.status, 0);
  assert.equal(result.report.status, 'FAIL');
  assert.deepEqual(result.report.steps.map(step => [step.status, step.exitCode]),
    [['FAIL', 17], ['NOT RUN', null]]);
  assert.deepEqual(result.calls, ['ci']);
  assert.match(result.report.failure, /npm ci exited with code 17/);
});

test('real PowerShell runner reports Angular gate failure after successful npm ci', { skip: !windows }, () => {
  const result = runSandbox({ failure: 'verify' });
  assert.notEqual(result.status, 0);
  assert.equal(result.report.status, 'FAIL');
  assert.deepEqual(result.report.steps.map(step => [step.status, step.exitCode]),
    [['PASS', 0], ['FAIL', 23]]);
  assert.deepEqual(result.calls, ['ci', 'run verify:angular']);
  assert.match(result.report.failure, /verify:angular.*23/);
});

test('missing lockfile fails closed without invoking any npm command', { skip: !windows }, () => {
  const result = runSandbox({ lockfile: false });
  assert.notEqual(result.status, 0);
  assert.equal(result.report.status, 'FAIL');
  assert.deepEqual(result.calls, []);
  assert.deepEqual(result.report.steps.map(step => step.status), ['NOT RUN', 'NOT RUN']);
  assert.match(result.report.failure, /Missing package-lock\.json/);
});

test('-SkipInstall is explicit and requires an existing node_modules directory', { skip: !windows }, () => {
  const absent = runSandbox({ skipInstall: true });
  assert.notEqual(absent.status, 0);
  assert.equal(absent.report.status, 'FAIL');
  assert.deepEqual(absent.calls, []);
  assert.match(absent.report.failure, /-SkipInstall requires/);
  const valid = runSandbox({ skipInstall: true, modules: true });
  assert.equal(valid.status, 0, valid.stderr);
  assert.equal(valid.report.status, 'PASS');
  assert.equal(valid.report.installSkipped, true);
  assert.deepEqual(valid.report.steps.map(step => [step.status, step.exitCode]),
    [['SKIPPED', null], ['PASS', 0]]);
  assert.deepEqual(valid.calls, ['run verify:angular']);
});
