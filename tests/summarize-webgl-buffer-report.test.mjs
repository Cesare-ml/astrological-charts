import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const script = fileURLToPath(new URL('../scripts/summarize-webgl-buffer-report.mjs', import.meta.url));
const ctx = (id, created, deleted) => ({id, created, deleted, live: created - deleted});
const point = (phase, index, ...perContext) => ({
  phase, index,
  created: perContext.reduce((sum, row) => sum + row.created, 0),
  deleted: perContext.reduce((sum, row) => sum + row.deleted, 0),
  live: perContext.reduce((sum, row) => sum + row.live, 0),
  contexts: perContext.length, contextLost: 0, perContext,
});
const fixture = () => {
  const initial = point('initial', 0, ctx(1, 2, 1));
  const redraw = point('redraw', 1, ctx(1, 3, 2));
  const exported = point('export', 1, ctx(1, 3, 2), ctx(2, 4, 3));
  return {redraws: 1, exports: 1, checkpoints: [initial, redraw, exported], final: exported};
};
const dir = mkdtempSync(join(tmpdir(), 'chart-webgl-report-'));
const run = (...args) => spawnSync(process.execPath, [script, ...args], {encoding: 'utf8'});
test('CLI reads an exported benchmark report without browser or network', () => {
  const file = join(dir, 'valid.json');
  writeFileSync(file, JSON.stringify(fixture()), 'utf8');
  const result = run(file);
  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.deepEqual(summary.exportsByContext, {
    newContextIds: [2], newContextLive: 1, existingContextLiveDelta: 0,
  });
  assert.equal(summary.phases.redraw.live, 0);
  assert.match(summary.interpretation, /not GPU bytes/);
});

test('CLI rejects malformed JSON and inconsistent accounting', () => {
  const invalidJson = join(dir, 'invalid.json');
  writeFileSync(invalidJson, '{oops', 'utf8');
  let result = run(invalidJson);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /analysis failed/);
  const malformed = fixture();
  malformed.final.live = 999;
  const inconsistent = join(dir, 'wrong-totals.json');
  writeFileSync(inconsistent, JSON.stringify(malformed), 'utf8');
  result = run(inconsistent);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /disagrees with contexts/);
});

test('CLI rejects omitted and extra arguments without reading other files', () => {
  const file = join(dir, 'valid.json');
  assert.equal(run().status, 2);
  assert.equal(run(file, file).status, 2);
});

test('CLI validates missing and oversized input without creating output files', () => {
  assert.equal(run(join(dir, 'missing.json')).status, 1);
  const oversized = join(dir, 'oversized.json');
  writeFileSync(oversized, ' '.repeat(5_000_001), 'utf8');
  const result = run(oversized);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /between 2 bytes and 5 MB/);
});

import {after} from 'node:test';
after(() => rmSync(dir, {recursive: true, force: true}));
