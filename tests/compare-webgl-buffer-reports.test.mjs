import assert from 'node:assert/strict';
import {test} from 'node:test';
import {compareWebGLBufferReports} from '../scripts/compare-webgl-buffer-reports.mjs';

const ctx = (id, created, deleted) => ({id, created, deleted, live: created - deleted});
function snapshot(phase, index, ...perContext) {
  return {
    phase, index,
    created: perContext.reduce((sum, x) => sum + x.created, 0),
    deleted: perContext.reduce((sum, x) => sum + x.deleted, 0),
    live: perContext.reduce((sum, x) => sum + x.live, 0),
    contexts: perContext.length, contextLost: 0, perContext,
  };
}

function report(browser) {
  const chromium = browser === 'chromium';
  const initial = snapshot('initial', 0, chromium ? ctx(1, 10, 6) : ctx(1, 12, 8));
  const redraw = snapshot('redraw', 10, chromium ? ctx(1, 20, 16) : ctx(1, 24, 19));
  const exported = snapshot('export', 1,
    chromium ? ctx(1, 20, 16) : ctx(1, 24, 19),
    chromium ? ctx(2, 5, 4) : ctx(2, 8, 5));
  return {
    browser, browserVersion: chromium ? '157.0' : '142.0', node: 'v22.16.0',
    platform: 'win32', architecture: 'x64',
    chart: 'natal', viewport: {width: 1200, height: 1000},
    redraws: 10, exports: 1,
    checkpoints: [initial, redraw, exported], final: structuredClone(exported),
  };
}

test('compares only matched browser configurations, preserving phase deltas', () => {
  const comparison = compareWebGLBufferReports(report('chromium'), report('firefox'));
  assert.equal(comparison.comparison, 'descriptive-only');
  assert.deepEqual(comparison.config, {
    chart: 'natal', viewport: {width: 1200, height: 1000}, redraws: 10, exports: 1,
  });
  assert.deepEqual(comparison.firefoxMinusChromium.redraw, {created: 2, deleted: 1, live: 1});
  assert.deepEqual(comparison.firefoxMinusChromium.exports, {created: 3, deleted: 1, live: 2});
  assert.equal(comparison.firefoxMinusChromium.persistentLiveDelta, 1);
  assert.equal(comparison.firefoxMinusChromium.newExportContextLive, 2);
  assert.equal(comparison.browsers.firefox.metrics.finalLive, 8);
  assert.ok(comparison.warnings.some(w => w.includes('not GPU bytes')));
});

test('browser input order does not affect normalized comparison', () => {
  assert.deepEqual(
    compareWebGLBufferReports(report('chromium'), report('firefox')),
    compareWebGLBufferReports(report('firefox'), report('chromium')),
  );
});

test('never mutates the original benchmark reports', () => {
  const a = report('chromium');
  const b = report('firefox');
  const before = structuredClone([a, b]);
  compareWebGLBufferReports(a, b);
  assert.deepEqual([a, b], before);
});

test('rejects two reports from one browser or unsupported browser names', () => {
  assert.throws(() => compareWebGLBufferReports(report('chromium'), report('chromium')), TypeError);
  const invalid = report('firefox');
  invalid.browser = 'webkit';
  assert.throws(() => compareWebGLBufferReports(report('chromium'), invalid), TypeError);
});

test('rejects configuration mismatches rather than claiming comparability', () => {
  for (const mutate of [
    r => { r.chart = 'latitudes'; },
    r => { r.redraws = 11; r.checkpoints[1].index = 11; },
    r => { r.exports = 2; r.checkpoints.push({...r.checkpoints[2], index: 2}); },
    r => { r.viewport.width = 800; },
    r => { r.viewport.height = 500; },
  ]) {
    const chrome = report('chromium'), firefox = report('firefox');
    mutate(firefox);
    assert.throws(() => compareWebGLBufferReports(chrome, firefox), TypeError);
  }
});

test('validates incomplete or corrupt reports before producing a comparison', () => {
  for (const mutate of [
    r => { r.viewport.width = 0; },
    r => { r.viewport.height = NaN; },
    r => { r.viewport = null; },
    r => { r.browser = ''; },
    r => { r.chart = ''; },
    r => { r.browserVersion = ''; },
    r => { r.final.live += 5; },
    r => { r.checkpoints[1].perContext[0].deleted = 999; },
  ]) {
    const chrome = report('chromium'), firefox = report('firefox');
    mutate(chrome);
    assert.throws(() => compareWebGLBufferReports(chrome, firefox), TypeError);
  }
});

test('warns when runtime environments differ without mislabeling a leak', () => {
  const firefox = report('firefox');
  firefox.platform = 'linux';
  firefox.node = 'v24.0.0';
  firefox.architecture = 'arm64';
  firefox.final.contextLost = 1;
  const compared = compareWebGLBufferReports(report('chromium'), firefox);
  assert.ok(compared.warnings.some(w => w.includes('platform differs')));
  assert.ok(compared.warnings.some(w => w.includes('architecture differs')));
  assert.ok(compared.warnings.some(w => w.includes('node differs')));
  assert.ok(compared.warnings.some(w => w.includes('context losses')));
  assert.ok(compared.warnings.some(w => w.includes('positive API-live')));
  assert.ok(!compared.warnings.some(w => /is a leak|proves a leak/.test(w)));
});

test('missing environment metadata remains an explicit limitation', () => {
  const firefox = report('firefox');
  delete firefox.platform;
  const comparison = compareWebGLBufferReports(report('chromium'), firefox);
  assert.ok(comparison.warnings.some(w => w.includes('platform metadata missing')));
  assert.ok(comparison.warnings.some(w => w.includes('asset packs')));
});

test('valid nearby UTC timestamps avoid a session-proximity warning', () => {
  const chrome = report('chromium');
  const firefox = report('firefox');
  chrome.recordedAt = '2026-11-13T12:00:00.000Z';
  firefox.recordedAt = '2026-11-13T13:00:00.000Z';
  const result = compareWebGLBufferReports(chrome, firefox);
  assert.ok(!result.warnings.some(w => w.includes('Recorded-at UTC timestamp')));
  assert.ok(!result.warnings.some(w => w.includes('more than 24 hours apart')));
  assert.equal(result.browsers.chromium.recordedAt, chrome.recordedAt);
  assert.equal(result.browsers.firefox.recordedAt, firefox.recordedAt);
});

test('missing or malformed timestamps explicitly warn instead of being silently comparable', () => {
  for (const recordedAt of [
    undefined, '', 'yesterday', '2026-13-40T12:00:00.000Z',
    '2026-11-13T12:00:00Z', 1470000000,
  ]) {
    const chrome = report('chromium');
    const firefox = report('firefox');
    chrome.recordedAt = '2026-11-13T12:00:00.000Z';
    firefox.recordedAt = recordedAt;
    const result = compareWebGLBufferReports(chrome, firefox);
    assert.ok(result.warnings.some(w => w.includes('Recorded-at UTC timestamp')), String(recordedAt));
  }
});

test('reports over 24 hours apart warn without asserting a resource leak', () => {
  const chrome = report('chromium');
  const firefox = report('firefox');
  chrome.recordedAt = '2026-11-10T10:00:00.000Z';
  firefox.recordedAt = '2026-11-13T12:00:00.000Z';
  const result = compareWebGLBufferReports(chrome, firefox);
  assert.ok(result.warnings.some(w => w.includes('more than 24 hours apart')));
  assert.equal(result.comparison, 'descriptive-only');
  assert.ok(!result.warnings.some(w => /is a leak|proves a leak/.test(w)));
});

test('matching revision and manifest digest are retained in compared provenance', () => {
  const chrome = report('chromium');
  const firefox = report('firefox');
  for (const item of [chrome, firefox]) {
    item.sourceRevision = 'a'.repeat(40);
    item.sourceDirty = false;
    item.assetManifestSha256 = 'b'.repeat(64);
  }
  const result = compareWebGLBufferReports(chrome, firefox);
  assert.deepEqual(result.browsers.chromium.provenance, {
    sourceRevision: 'a'.repeat(40),
    sourceDirty: false,
    assetManifestSha256: 'b'.repeat(64),
  });
  assert.deepEqual(result.browsers.firefox.provenance, result.browsers.chromium.provenance);
  assert.ok(!result.warnings.some(w => w.includes('source/asset comparability')));
});

test('different source commit rejects an otherwise compatible comparison', () => {
  const chrome = report('chromium');
  const firefox = report('firefox');
  chrome.sourceRevision = 'a'.repeat(40);
  firefox.sourceRevision = 'b'.repeat(40);
  assert.throws(() => compareWebGLBufferReports(chrome, firefox),
    /different sourceRevision/);
});

test('different asset manifest digest rejects an otherwise compatible comparison', () => {
  const chrome = report('chromium');
  const firefox = report('firefox');
  chrome.assetManifestSha256 = 'a'.repeat(64);
  firefox.assetManifestSha256 = 'b'.repeat(64);
  assert.throws(() => compareWebGLBufferReports(chrome, firefox),
    /different assetManifestSha256/);
});

test('one-sided missing provenance warns and preserves legacy report support', () => {
  const chrome = report('chromium');
  const firefox = report('firefox');
  chrome.sourceRevision = 'a'.repeat(40);
  chrome.assetManifestSha256 = 'b'.repeat(64);
  chrome.sourceDirty = false;
  const result = compareWebGLBufferReports(chrome, firefox);
  assert.ok(result.warnings.some(w => w.includes('sourceRevision missing')));
  assert.ok(result.warnings.some(w => w.includes('assetManifestSha256 missing')));
  assert.ok(result.warnings.some(w => w.includes('working-tree status unavailable')));
  assert.equal(result.browsers.firefox.provenance.sourceRevision, null);
});

test('malformed digest metadata and nonboolean dirty flags fail closed', () => {
  for (const mutate of [
    r => { r.sourceRevision = 'ABC'.repeat(13) + 'a'; },
    r => { r.sourceRevision = '0'.repeat(39); },
    r => { r.sourceRevision = 123; },
    r => { r.assetManifestSha256 = 'g'.repeat(64); },
    r => { r.assetManifestSha256 = 'f'.repeat(65); },
    r => { r.sourceDirty = 'false'; },
  ]) {
    const chrome = report('chromium');
    mutate(chrome);
    assert.throws(() => compareWebGLBufferReports(chrome, report('firefox')), TypeError);
  }
});

test('dirty worktrees are never silently treated as clean matching revisions', () => {
  const chrome = report('chromium');
  const firefox = report('firefox');
  chrome.sourceRevision = firefox.sourceRevision = 'a'.repeat(40);
  chrome.sourceDirty = true;
  firefox.sourceDirty = false;
  const compared = compareWebGLBufferReports(chrome, firefox);
  assert.ok(compared.warnings.some(w => w.includes('chromium: working tree has tracked changes')));
  assert.ok(!compared.warnings.some(w => w.includes('firefox: working tree has tracked changes')));
});
