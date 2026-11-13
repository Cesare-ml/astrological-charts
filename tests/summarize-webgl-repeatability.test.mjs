import {test} from 'node:test';
import assert from 'node:assert/strict';
import {summarizeWebGLBufferRepeatability} from '../scripts/summarize-webgl-repeatability.mjs';

const ctx = (id, created, deleted) => ({id, created, deleted, live: created - deleted});
function point(phase, index, ...perContext) {
  return {
    phase, index, perContext, contexts: perContext.length, contextLost: 0,
    created: perContext.reduce((sum, row) => sum + row.created, 0),
    deleted: perContext.reduce((sum, row) => sum + row.deleted, 0),
    live: perContext.reduce((sum, row) => sum + row.live, 0),
  };
}
function report(sequence = 0) {
  const initial = point('initial', 0, ctx(1, 10, 6));
  const redraw = point('redraw', 10, ctx(1, 20 + sequence * 2, 16));
  const exported = point('export', 1,
    ctx(1, 20 + sequence * 2, 16),
    ctx(2, 5 + sequence * 3, 4 + sequence));
  return {
    browser: 'chromium', browserVersion: '157.0', chart: 'natal',
    viewport: {width: 1200, height: 1000}, redraws: 10, exports: 1,
    node: 'v22', platform: 'win32', architecture: 'x64',
    recordedAt: '2026-11-13T12:00:00.000Z',
    sourceRevision: 'a'.repeat(40), sourceDirty: false,
    assetManifestSha256: 'b'.repeat(64),
    checkpoints: [initial, redraw, exported], final: structuredClone(exported),
  };
}

test('summarizes range, span and actual per-run values for repeated browser workloads', () => {
  const summary = summarizeWebGLBufferRepeatability([report(0), report(1)]);
  assert.equal(summary.assessment, 'descriptive-only');
  assert.equal(summary.runCount, 2);
  assert.deepEqual(summary.config, {
    browser: 'chromium', browserVersion: '157.0', chart: 'natal',
    width: 1200, height: 1000, redraws: 10, exports: 1,
  });
  assert.deepEqual(summary.metrics.persistentRedrawLiveDelta,
    {min: 0, max: 2, span: 2, values: [0, 2]});
  assert.deepEqual(summary.metrics.exportContextLive,
    {min: 1, max: 3, span: 2, values: [1, 3]});
  assert.deepEqual(summary.metrics.newExportContexts,
    {min: 1, max: 1, span: 0, values: [1, 1]});
  assert.deepEqual(summary.metrics.finalLive,
    {min: 5, max: 9, span: 4, values: [5, 9]});
  assert.ok(summary.warnings.some(w => w.includes('not GPU bytes')));
  assert.ok(!summary.warnings.some(w => w.includes('provenance is incomplete')));
});

test('repeatability summaries never mutate input and work with negative live changes', () => {
  const a = report();
  const b = report();
  // Second run has more explicit buffer deletions after redraw.
  b.checkpoints[1] = point('redraw', 10, ctx(1, 20, 18));
  b.checkpoints[2] = point('export', 1, ctx(1, 20, 18), ctx(2, 5, 4));
  b.final = structuredClone(b.checkpoints[2]);
  const before = structuredClone([a, b]);
  const summary = summarizeWebGLBufferRepeatability([a, b]);
  assert.deepEqual([a, b], before);
  assert.deepEqual(summary.metrics.persistentRedrawLiveDelta.values, [0, -2]);
  assert.equal(summary.metrics.persistentRedrawLiveDelta.span, 2);
});

test('requires two to twenty saved reports', () => {
  assert.throws(() => summarizeWebGLBufferRepeatability([]), TypeError);
  assert.throws(() => summarizeWebGLBufferRepeatability([report()]), TypeError);
  assert.throws(() => summarizeWebGLBufferRepeatability(Array.from({length: 21}, report)), TypeError);
  assert.throws(() => summarizeWebGLBufferRepeatability('not reports'), TypeError);
});

test('rejects mixed browser/version/chart/viewports or workload sizes', () => {
  for (const change of [
    r => {r.browser = 'firefox';},
    r => {r.browserVersion = '156.0';},
    r => {r.chart = 'latitudes';},
    r => {r.viewport.width = 900;},
    r => {r.viewport.height = 700;},
    r => {r.redraws = 11; r.checkpoints[1].index = 11;},
    r => {r.exports = 2; r.checkpoints.push({...r.checkpoints[2], index: 2});},
  ]) {
    const a = report(), b = report();
    change(b);
    assert.throws(() => summarizeWebGLBufferRepeatability([a, b]), TypeError);
  }
});

test('rejects distinct source revisions/manifests even when one run omits metadata', () => {
  for (const key of ['sourceRevision', 'assetManifestSha256']) {
    const a = report(), b = report(), c = report();
    b[key] = null;
    c[key] = key === 'sourceRevision' ? 'c'.repeat(40) : 'd'.repeat(64);
    assert.throws(() => summarizeWebGLBufferRepeatability([a, b, c]), /different/);
  }
});

test('supports old reports but warns about unknown provenance and dirty checkout', () => {
  const a = report(), b = report();
  delete a.sourceRevision;
  delete a.assetManifestSha256;
  a.sourceDirty = true;
  delete b.sourceDirty;
  const summary = summarizeWebGLBufferRepeatability([a, b]);
  assert.ok(summary.warnings.some(w => w.includes('sourceRevision missing')));
  assert.ok(summary.warnings.some(w => w.includes('assetManifestSha256 missing')));
  assert.ok(summary.warnings.some(w => w.includes('Run 1 has tracked source changes')));
  assert.ok(summary.warnings.some(w => w.includes('Run 2 Git worktree status is unknown')));
});

test('missing, separated or invalid timestamps explicitly reduce comparability', () => {
  const a = report(), b = report();
  b.recordedAt = '2026-11-15T12:00:00.000Z';
  assert.ok(summarizeWebGLBufferRepeatability([a, b]).warnings
    .some(w => w.includes('more than 24 hours apart')));
  b.recordedAt = '2026-99-15T12:00:00.000Z';
  assert.ok(summarizeWebGLBufferRepeatability([a, b]).warnings
    .some(w => w.includes('no valid UTC')));
});

test('warns on runtime mismatches or context loss, not on valid control runs', () => {
  const a = report(), b = report();
  b.node = 'v24';
  b.platform = 'linux';
  b.architecture = 'arm64';
  b.final.contextLost = 1;
  const warnings = summarizeWebGLBufferRepeatability([a, b]).warnings;
  for (const term of ['node differs', 'platform differs', 'architecture differs',
    'context-loss']) {
    assert.ok(warnings.some(w => w.includes(term)), term);
  }
  assert.ok(!warnings.some(w => /is a leak|proves a leak/.test(w)));
});

test('rejects corrupt telemetry and malformed metadata before reporting metrics', () => {
  for (const change of [
    r => {r.checkpoints[2].live++;},
    r => {r.sourceRevision = 'abc';},
    r => {r.assetManifestSha256 = 'ABC';},
    r => {r.sourceDirty = 'false';},
    r => {r.viewport.width = 0;},
    r => {r.browserVersion = '';},
    r => {r.final.perContext[0].created = -1;},
  ]) {
    const a = report(), b = report();
    change(b);
    assert.throws(() => summarizeWebGLBufferRepeatability([a, b]), TypeError);
  }
});
