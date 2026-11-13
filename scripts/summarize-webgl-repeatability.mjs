/**
 * Describe repeatability of multiple saved runs of the same local synthetic
 * WebGL buffer benchmark. Deliberately not a GPU memory or leak detector.
 */
import {analyzeWebGLBufferReport} from './analyze-webgl-buffer-report.mjs';

const SHA1 = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const MAX_RUNS = 20;

function nonempty(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${label} must be a nonempty string`);
  }
  return value;
}
function positive(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive safe integer`);
  }
  return value;
}
function digest(value, pattern, label) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new TypeError(`${label} must be a lowercase hex digest or null`);
  }
  return value;
}
function dirty(value, label) {
  if (value == null) return null;
  if (typeof value !== 'boolean') throw new TypeError(`${label} must be boolean or null`);
  return value;
}
function timestamp(value) {
  if (typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return null;
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) && new Date(epoch).toISOString() === value ? epoch : null;
}
function sumSafe(values, label) {
  let total = 0;
  for (const value of values) {
    total += value;
    if (!Number.isSafeInteger(total)) throw new TypeError(`${label} exceeds safe integer range`);
  }
  return total;
}
function normalized(raw, index) {
  const label = `reports[${index}]`;
  const analysis = analyzeWebGLBufferReport(raw);
  const browser = nonempty(raw.browser, `${label}.browser`);
  if (!['chromium', 'firefox'].includes(browser)) {
    throw new TypeError(`${label}.browser must be chromium or firefox`);
  }
  const browserVersion = nonempty(raw.browserVersion, `${label}.browserVersion`);
  const chart = nonempty(raw.chart, `${label}.chart`);
  const viewport = raw.viewport;
  if (!viewport || typeof viewport !== 'object' || Array.isArray(viewport)) {
    throw new TypeError(`${label}.viewport must be an object`);
  }
  const width = positive(viewport.width, `${label}.viewport.width`);
  const height = positive(viewport.height, `${label}.viewport.height`);
  const provenance = {
    sourceRevision: digest(raw.sourceRevision, SHA1, `${label}.sourceRevision`),
    assetManifestSha256: digest(raw.assetManifestSha256, SHA256, `${label}.assetManifestSha256`),
    sourceDirty: dirty(raw.sourceDirty, `${label}.sourceDirty`),
  };
  const persistentLiveDelta = sumSafe(
    analysis.persistentDuringRedraw.map(context => context.liveDelta),
    `${label}.persistentLiveDelta`,
  );
  return {
    config: {
      browser, browserVersion, chart, width, height,
      redraws: analysis.redraws, exports: analysis.exports,
    },
    recordedAt: typeof raw.recordedAt === 'string' ? raw.recordedAt : null,
    timestampMs: timestamp(raw.recordedAt),
    runtime: {
      node: raw.node, platform: raw.platform, architecture: raw.architecture,
    },
    provenance,
    metrics: {
      persistentRedrawLiveDelta: persistentLiveDelta,
      exportContextLive: analysis.exportsByContext.newContextLive,
      newExportContexts: analysis.exportsByContext.newContextIds.length,
      finalLive: analysis.totals.finalLive,
    },
    contextLost: analysis.contextLost,
  };
}

function metricSummary(runs, key) {
  const values = runs.map(run => run.metrics[key]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  if (!Number.isSafeInteger(span)) throw new TypeError(`${key} range exceeds safe integer bounds`);
  return {min, max, span, values};
}

export function summarizeWebGLBufferRepeatability(reports) {
  if (!Array.isArray(reports) || reports.length < 2 || reports.length > MAX_RUNS) {
    throw new TypeError(`Expected 2 to ${MAX_RUNS} saved WebGL benchmark reports`);
  }
  const runs = reports.map(normalized);
  const baseline = runs[0];
  for (const [index, item] of runs.entries()) {
    for (const [key, value] of Object.entries(baseline.config)) {
      if (item.config[key] !== value) {
        throw new TypeError(`reports[${index}]: incompatible ${key} (${item.config[key]} vs ${value})`);
      }
    }
    for (const key of ['sourceRevision', 'assetManifestSha256']) {
      const a = baseline.provenance[key];
      const b = item.provenance[key];
      if (a !== null && b !== null && a !== b) {
        throw new TypeError(`reports[${index}]: different ${key} values`);
      }
    }
  }

  const warnings = [
    'Counts are WebGL API buffer handles, not GPU bytes, proven leaks or performance rankings.',
    'Matching metadata cannot verify that the dev server served the same Angular bundle or asset bytes.',
  ];
  for (const key of ['sourceRevision', 'assetManifestSha256']) {
    const present = new Set(runs.map(run => run.provenance[key]).filter(Boolean));
    if (present.size > 1) {
      throw new TypeError(`Reports contain different ${key} values`);
    }
    if (runs.some(run => run.provenance[key] === null)) {
      warnings.push(`${key} missing in at least one report; provenance is incomplete`);
    }
  }
  for (const [index, run] of runs.entries()) {
    if (run.provenance.sourceDirty === true) {
      warnings.push(`Run ${index + 1} has tracked source changes; HEAD is not sufficient to identify code`);
    } else if (run.provenance.sourceDirty === null) {
      warnings.push(`Run ${index + 1} Git worktree status is unknown`);
    }
    if (run.contextLost > 0) {
      warnings.push(`Run ${index + 1} observed ${run.contextLost} WebGL context-loss event(s)`);
    }
  }
  for (const key of ['node', 'platform', 'architecture']) {
    const known = new Set(runs.map(run => run.runtime[key]).filter(value => typeof value === 'string' && value.length));
    if (known.size > 1) {
      warnings.push(`Runtime ${key} differs across runs`);
    } else if (runs.some(run => !run.runtime[key])) {
      warnings.push(`Runtime ${key} missing from at least one run`);
    }
  }
  const times = runs.map(run => run.timestampMs);
  if (times.some(value => value === null)) {
    warnings.push('At least one run has no valid UTC recordedAt timestamp');
  } else if (Math.max(...times) - Math.min(...times) > 24 * 60 * 60 * 1000) {
    warnings.push('Runs were recorded more than 24 hours apart');
  }

  return {
    schemaVersion: 1,
    assessment: 'descriptive-only',
    config: {...baseline.config},
    runCount: runs.length,
    metrics: {
      persistentRedrawLiveDelta: metricSummary(runs, 'persistentRedrawLiveDelta'),
      exportContextLive: metricSummary(runs, 'exportContextLive'),
      newExportContexts: metricSummary(runs, 'newExportContexts'),
      finalLive: metricSummary(runs, 'finalLive'),
    },
    runs: runs.map(({recordedAt, provenance, contextLost}) =>
      ({recordedAt, provenance, contextLost})),
    warnings,
  };
}
