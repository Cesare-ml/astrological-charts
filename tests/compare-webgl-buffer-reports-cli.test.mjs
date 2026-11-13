import assert from 'node:assert/strict';
import {after, test} from 'node:test';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const script = fileURLToPath(new URL('../scripts/compare-webgl-buffer-reports-cli.mjs', import.meta.url));
const root = mkdtempSync(join(tmpdir(), 'virgostars-webgl-compare-'));
after(() => rmSync(root, {recursive: true, force: true}));
const run = (...args) => spawnSync(process.execPath, [script, ...args], {encoding: 'utf8'});
const ctx = (id, created, deleted) => ({id, created, deleted, live: created - deleted});
const point = (phase, index, ...rows) => ({
  phase, index,
  created: rows.reduce((sum, x) => sum + x.created, 0),
  deleted: rows.reduce((sum, x) => sum + x.deleted, 0),
  live: rows.reduce((sum, x) => sum + x.live, 0),
  contexts: rows.length, contextLost: 0, perContext: rows,
});

function report(browser) {
  const initial = point('initial', 0, ctx(1, 2, 1));
  const redraw = point('redraw', 1,
    browser === 'chromium' ? ctx(1, 3, 2) : ctx(1, 4, 2));
  const export1 = point('export', 1,
    browser === 'chromium' ? ctx(1, 3, 2) : ctx(1, 4, 2),
    browser === 'chromium' ? ctx(2, 4, 3) : ctx(2, 5, 3));
  return {
    browser, browserVersion: 'test', chart: 'natal', viewport: {width: 1200, height: 1000},
    platform: 'linux', architecture: 'x64', node: 'v22',
    redraws: 1, exports: 1,
    checkpoints: [initial, redraw, export1], final: export1,
  };
}

function files() {
  const chrome = join(root, 'chromium.json');
  const firefox = join(root, 'firefox.json');
  writeFileSync(chrome, JSON.stringify(report('chromium')));
  writeFileSync(firefox, JSON.stringify(report('firefox')));
  return {chrome, firefox};
}

test('CLI compares two saved reports without launching a browser', () => {
  const {chrome, firefox} = files();
  const result = run(chrome, firefox);
  assert.equal(result.status, 0, result.stderr);
  const comparison = JSON.parse(result.stdout);
  assert.equal(comparison.config.chart, 'natal');
  assert.equal(comparison.firefoxMinusChromium.redraw.live, 1);
  assert.equal(comparison.firefoxMinusChromium.exports.live, 1);
  assert.equal(comparison.comparison, 'descriptive-only');
  const reversed = run(firefox, chrome);
  assert.equal(reversed.status, 0, reversed.stderr);
  assert.deepEqual(JSON.parse(reversed.stdout), comparison);
});

test('CLI rejects incompatible charts with exit 1 and no comparison', () => {
  const {chrome, firefox} = files();
  const mismatch = report('firefox');
  mismatch.viewport.width = 800;
  writeFileSync(firefox, JSON.stringify(mismatch));
  const result = run(chrome, firefox);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /different viewport.width/);
});

test('CLI rejects invalid JSON, missing paths and oversized input', () => {
  const {chrome, firefox} = files();
  writeFileSync(firefox, '{bad JSON');
  assert.equal(run(chrome, firefox).status, 1);
  assert.equal(run(chrome, join(root, 'missing.json')).status, 1);
  const big = join(root, 'big.json');
  writeFileSync(big, ' '.repeat(5_000_001));
  const result = run(chrome, big);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /between 2 bytes and 5 MB/);
});

test('CLI rejects omitted or extra arguments with exit 2', () => {
  const {chrome, firefox} = files();
  assert.equal(run().status, 2);
  assert.equal(run(chrome).status, 2);
  assert.equal(run(chrome, firefox, firefox).status, 2);
});
