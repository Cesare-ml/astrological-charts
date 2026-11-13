import assert from 'node:assert/strict';
import {after, test} from 'node:test';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const script = fileURLToPath(new URL('../scripts/summarize-webgl-repeatability-cli.mjs', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'virgostars-webgl-repeat-'));
after(() => rmSync(dir, {recursive: true, force: true}));
const run = (...args) => spawnSync(process.execPath, [script, ...args], {encoding: 'utf8'});
const ctx = (id, created, deleted) => ({id, created, deleted, live: created - deleted});
const point = (phase, index, ...rows) => ({
  phase, index, perContext: rows, contexts: rows.length, contextLost: 0,
  created: rows.reduce((s, x) => s + x.created, 0),
  deleted: rows.reduce((s, x) => s + x.deleted, 0),
  live: rows.reduce((s, x) => s + x.live, 0),
});
function fixture(extra = 0) {
  const initial = point('initial', 0, ctx(1, 10, 6));
  const redraw = point('redraw', 1, ctx(1, 20 + extra, 16));
  const exported = point('export', 1, ctx(1, 20 + extra, 16), ctx(2, 4, 3));
  return {
    browser: 'chromium', browserVersion: 'test', chart: 'natal',
    viewport: {width: 1200, height: 1000}, redraws: 1, exports: 1,
    node: 'v22', platform: 'win32', architecture: 'x64',
    sourceRevision: 'a'.repeat(40), sourceDirty: false,
    assetManifestSha256: 'b'.repeat(64),
    recordedAt: '2026-11-13T12:00:00.000Z',
    checkpoints: [initial, redraw, exported], final: exported,
  };
}
function files() {
  const first = join(dir, 'one.json');
  const second = join(dir, 'two.json');
  writeFileSync(first, JSON.stringify(fixture(0)));
  writeFileSync(second, JSON.stringify(fixture(2)));
  return {first, second};
}

test('CLI summarizes two saved runs in original file order', () => {
  const {first, second} = files();
  const result = run(first, second);
  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.runCount, 2);
  assert.equal(summary.assessment, 'descriptive-only');
  assert.deepEqual(summary.metrics.persistentRedrawLiveDelta,
    {min: 0, max: 2, span: 2, values: [0, 2]});
  const reverse = run(second, first);
  assert.equal(reverse.status, 0, reverse.stderr);
  assert.deepEqual(JSON.parse(reverse.stdout).metrics.persistentRedrawLiveDelta.values, [2, 0]);
});

test('CLI fails closed for mismatched browser workloads', () => {
  const {first, second} = files();
  const other = fixture(2);
  other.browser = 'firefox';
  writeFileSync(second, JSON.stringify(other));
  const result = run(first, second);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /incompatible browser/);
});

test('CLI rejects missing, malformed and oversized input', () => {
  const {first, second} = files();
  writeFileSync(second, '{bad json');
  assert.equal(run(first, second).status, 1);
  assert.equal(run(first, join(dir, 'missing.json')).status, 1);
  const oversized = join(dir, 'oversized.json');
  writeFileSync(oversized, ' '.repeat(5_000_001));
  const result = run(first, oversized);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /between 2 bytes and 5 MB/);
});

test('CLI returns usage exit 2 for fewer than two or more than twenty paths', () => {
  const {first, second} = files();
  assert.equal(run().status, 2);
  assert.equal(run(first).status, 2);
  assert.equal(run(...Array.from({length: 21}, (_, i) => i % 2 ? second : first)).status, 2);
});
