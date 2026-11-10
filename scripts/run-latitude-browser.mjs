#!/usr/bin/env node
// Opt-in localhost runner for the focused latitude PNG regression.
// No network calls beyond localhost, production assets, deploys or CI.
import { spawn, execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { portInUse, reachable, browserModes } from './latitude-local-readiness.mjs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npmCli = process.env.npm_execpath;
const packDir = join(root, '.local', 'demo-pack');
const packManifest = join(packDir, 'manifests', 'approved-assets.json');
const started = [];
let activeTest = null;
let interrupted = false;

function npmProcess(script, extraEnv = {}) {
  // npm_execpath comes from the invoking `npm run` and avoids shell quoting
  // pitfalls on Windows (npm.cmd, parentheses and project paths with spaces).
  if (!npmCli || !existsSync(npmCli)) throw new Error('Run this through npm run test:latitude:local (npm_execpath is missing).');
  return spawn(process.execPath, [npmCli, 'run', script], {
    cwd: root,
    env: {...process.env, ...extraEnv},
    stdio: 'inherit',
    detached: process.platform !== 'win32',
    windowsHide: true,
  });
}

function runScript(script, extraEnv = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = npmProcess(script, extraEnv);
    activeTest = child;
    child.once('error', rejectRun);
    child.once('close', (code, signal) => {
      if (activeTest === child) activeTest = null;
      if (code === 0) resolveRun();
      else rejectRun(new Error(`npm run ${script} failed (exit ${code ?? 'none'}, signal ${signal ?? 'none'})`));
    });
  });
}

async function waitForReady(url, child, seconds, expectedMarker) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    if (interrupted) throw new Error('Validation interrupted.');
    if (child.exitCode !== null || child.signalCode !== null)
      throw new Error(`Local server exited before becoming ready: ${url}`);
    if (await reachable(url, expectedMarker)) return;
    await new Promise(resolveWait => setTimeout(resolveWait, 400));
  }
  throw new Error(`Local server did not become ready: ${url}`);
}

function terminate(child) {
  if (!child || !child.pid || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32') {
    const killer = execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'], {windowsHide: true}, () => {});
    killer.on('error', () => {});
  } else {
    // Detached npm processes own a process group, including `ng serve`.
    try { process.kill(-child.pid, 'SIGTERM'); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    interrupted = true;
    process.exitCode = signal === 'SIGINT' ? 130 : 143;
    terminate(activeTest);
    for (const child of started) terminate(child);
  });
}

try {
  const browsers = browserModes(process.argv.slice(2), process.env);
  if (!existsSync(join(root, 'node_modules')))
    throw new Error('Dependencies missing: run npm ci first.');
  for (const port of [4177, 4200]) {
    if (await portInUse(port))
      throw new Error(`Port ${port} already in use. Stop the existing server; this runner will not manage other processes.`);
  }
  if (!existsSync(packManifest)) {
    if (existsSync(packDir))
      throw new Error('Incomplete .local/demo-pack exists. Inspect it manually; this runner will not overwrite it.');
    console.log('Generating an original synthetic asset pack...');
    await runScript('demo:pack');
  }
  for (const [script, url, seconds, expectedMarker] of [
    ['demo:assets', 'http://127.0.0.1:4177/__preview', 60, 'approved asset preview'],
    ['demo', 'http://127.0.0.1:4200/', 120, 'Astrological Charts demo'],
  ]) {
    console.log(`Starting ${script} on localhost...`);
    const child = npmProcess(script);
    started.push(child);
    child.on('error', error => console.error(`${script} could not start: ${error.message}`));
    await waitForReady(url, child, seconds, expectedMarker);
  }
  // Keep both servers alive between browser runs. Fail immediately if either
  // browser fails; both must pass before this mode can report success.
  for (const browser of browsers) {
    console.log(`Running latitude PNG regression in ${browser}...`);
    await runScript('test:latitude-browser', {CHART_TEST_BROWSER:browser});
  }
  console.log(`Latitude PNG regression passed in: ${browsers.join(', ')}.`);
} catch (error) {
  console.error(`Latitude local validation failed: ${error.message}`);
  if (!interrupted) process.exitCode = 1;
} finally {
  terminate(activeTest);
  for (const child of started.toReversed()) terminate(child);
}
