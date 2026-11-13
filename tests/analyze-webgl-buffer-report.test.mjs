import assert from 'node:assert/strict';
import {test} from 'node:test';
import {analyzeWebGLBufferReport} from '../scripts/analyze-webgl-buffer-report.mjs';

const ctx = (id, created, deleted) => ({id, created, deleted, live: created - deleted});
const point = (phase, index, ...perContext) => ({
  phase, index,
  created: perContext.reduce((n, x) => n + x.created, 0),
  deleted: perContext.reduce((n, x) => n + x.deleted, 0),
  live: perContext.reduce((n, x) => n + x.live, 0),
  contexts: perContext.length,
  contextLost: 0,
  perContext,
});
function fixture() {
  const initial = point('initial', 0, ctx(1, 10, 6));
  const redraw10 = point('redraw', 10, ctx(1, 20, 16));
  const redraw20 = point('redraw', 20, ctx(1, 30, 24));
  const export1 = point('export', 1, ctx(1, 30, 24), ctx(2, 5, 4));
  const export2 = point('export', 2, ctx(1, 30, 24), ctx(2, 5, 4), ctx(3, 6, 5));
  return {
    browser: 'chromium', browserVersion: '157.0', redraws: 20, exports: 2,
    checkpoints: [initial, redraw10, redraw20, export1, export2],
    final: structuredClone(export2),
  };
}

test('separates persistent redraw growth from new offscreen export contexts', () => {
  const summary = analyzeWebGLBufferReport(fixture());
  assert.deepEqual(summary.phases.redraw, {created: 20, deleted: 18, live: 2});
  assert.deepEqual(summary.phases.exports, {created: 11, deleted: 9, live: 2});
  assert.deepEqual(summary.totals, {initialLive: 4, afterRedrawLive: 6, finalLive: 8});
  assert.deepEqual(summary.persistentDuringRedraw, [
    {id: 1, initialLive: 4, afterRedrawLive: 6, liveDelta: 2},
  ]);
  assert.deepEqual(summary.exportsByContext, {
    newContextIds: [2, 3], newContextLive: 2, existingContextLiveDelta: 0,
  });
  assert.match(summary.interpretation, /not GPU bytes/);
  assert.equal(summary.notices.length, 2);
});

test('does not mutate input and handles a change in existing context during exports', () => {
  const report = fixture();
  report.checkpoints[3] = point('export', 1, ctx(1, 31, 24), ctx(2, 5, 4));
  report.checkpoints[4] = point('export', 2, ctx(1, 32, 24), ctx(2, 5, 4), ctx(3, 6, 5));
  report.final = structuredClone(report.checkpoints[4]);
  const original = structuredClone(report);
  const result = analyzeWebGLBufferReport(report);
  assert.deepEqual(report, original);
  assert.equal(result.exportsByContext.existingContextLiveDelta, 2);
  assert.equal(result.exportsByContext.newContextLive, 2);
});

test('reports context loss as an observation, not an inferred GPU leak', () => {
  const report = fixture();
  report.final.contextLost = 1;
  const result = analyzeWebGLBufferReport(report);
  assert.equal(result.contextLost, 1);
  assert.ok(result.notices.some(text => text.includes('context-loss')));
});

test('rejects negative, non-integer and internally inconsistent counters', () => {
  for (const tamper of [
    r => { r.final.live = -1; },
    r => { r.final.created = 1.5; },
    r => { r.final.created = Number.MAX_SAFE_INTEGER + 1; },
    r => { r.final.perContext[2].live++; },
    r => { r.final.contexts++; },
    r => { r.final.perContext[2].id = 2; },
    r => { r.final.perContext[0].id = 0; },
  ]) {
    const r = fixture();
    tamper(r);
    assert.throws(() => analyzeWebGLBufferReport(r), TypeError);
  }
});

test('rejects decreasing global or per-context counters and missing contexts', () => {
  for (const tamper of [
    r => { r.final.deleted = r.checkpoints[4].deleted - 1; },
    r => { r.final.perContext[0].deleted--; r.final.deleted--; r.final.live++; r.final.perContext[0].live++; },
    r => { r.final.perContext = [r.final.perContext[0], r.final.perContext[2]]; r.final.contexts = 2;
      r.final.created -= 5; r.final.deleted -= 4; r.final.live -= 1; },
  ]) {
    const r = fixture();
    tamper(r);
    assert.throws(() => analyzeWebGLBufferReport(r), TypeError);
  }
});

test('rejects phase order, repeated indices and missing declared checkpoints', () => {
  for (const tamper of [
    r => { r.checkpoints[0].phase = 'redraw'; },
    r => { r.checkpoints[1].index = 0; },
    r => { r.checkpoints[2].index = 10; },
    r => { r.checkpoints[3].phase = 'redraw'; },
    r => { r.checkpoints[4].index = 1; },
    r => { r.redraws = 30; },
    r => { r.exports = 3; },
    r => { r.checkpoints.splice(2, 1); },
    r => { r.checkpoints = [r.checkpoints[0]]; },
  ]) {
    const r = fixture();
    tamper(r);
    assert.throws(() => analyzeWebGLBufferReport(r), TypeError);
  }
});

test('correctly reports exports that reuse existing contexts', () => {
  const r = fixture();
  r.exports = 1;
  const before = r.checkpoints[2];
  const last = point('export', 1, ctx(1, 34, 28));
  r.checkpoints = [r.checkpoints[0], r.checkpoints[1], before, last];
  r.final = structuredClone(last);
  const summary = analyzeWebGLBufferReport(r);
  assert.deepEqual(summary.exportsByContext, {
    newContextIds: [], newContextLive: 0, existingContextLiveDelta: 0,
  });
  assert.ok(!summary.notices.some(text => text.includes('new WebGL context')));
});

test('permits final telemetry after the last checkpoint when counters advance', () => {
  const r = fixture();
  r.final = point('final', 0, ctx(1, 30, 26), ctx(2, 5, 5), ctx(3, 6, 6));
  const summary = analyzeWebGLBufferReport(r);
  assert.equal(summary.totals.finalLive, 4);
  assert.equal(summary.phases.exports.live, -2);
});
