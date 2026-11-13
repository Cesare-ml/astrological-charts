/**
 * Descriptive Chromium/Firefox comparison of the *same* synthetic chart
 * buffer benchmark. No GPU byte estimates or leak verdicts are inferred.
 */
import {analyzeWebGLBufferReport} from './analyze-webgl-buffer-report.mjs';

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive safe integer`);
  }
  return value;
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function nonEmpty(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function normalized(report, label) {
  object(report, label);
  // The report analyzer checks every checkpoint, ordering, totals, and
  // per-context monotonic create/delete counters before comparison.
  const analysis = analyzeWebGLBufferReport(report);
  const browser = nonEmpty(report.browser, `${label}.browser`);
  if (browser !== 'chromium' && browser !== 'firefox') {
    throw new TypeError(`${label}.browser must be chromium or firefox`);
  }
  nonEmpty(report.chart, `${label}.chart`);
  nonEmpty(report.browserVersion, `${label}.browserVersion`);
  const viewport = object(report.viewport, `${label}.viewport`);
  positiveInteger(viewport.width, `${label}.viewport.width`);
  positiveInteger(viewport.height, `${label}.viewport.height`);

  const persistentLiveDelta = analysis.persistentDuringRedraw.reduce(
    (sum, context) => sum + context.liveDelta, 0,
  );
  if (!Number.isSafeInteger(persistentLiveDelta)) {
    throw new TypeError(`${label} persistent buffer count overflow`);
  }
  const result = {
    initialLive: analysis.totals.initialLive,
    afterRedrawLive: analysis.totals.afterRedrawLive,
    finalLive: analysis.totals.finalLive,
    redraw: analysis.phases.redraw,
    exports: analysis.phases.exports,
    persistentLiveDelta,
    newExportContextCount: analysis.exportsByContext.newContextIds.length,
    newExportContextLive: analysis.exportsByContext.newContextLive,
    existingContextExportLiveDelta: analysis.exportsByContext.existingContextLiveDelta,
    contextLost: analysis.contextLost,
  };
  return {browser, report, analysis, result};
}

function safeDifference(firefoxValue, chromiumValue, label) {
  const difference = firefoxValue - chromiumValue;
  if (!Number.isSafeInteger(difference)) {
    throw new TypeError(`difference for ${label} exceeds safe integer range`);
  }
  return difference;
}

export function compareWebGLBufferReports(first, second) {
  const a = normalized(first, 'first');
  const b = normalized(second, 'second');
  if (a.browser === b.browser) {
    throw new TypeError('Expected one chromium and one firefox report');
  }
  const byBrowser = {[a.browser]: a, [b.browser]: b};
  const chromium = byBrowser.chromium;
  const firefox = byBrowser.firefox;
  const comparisonFields = [
    ['chart', chromium.report.chart, firefox.report.chart],
    ['redraws', chromium.analysis.redraws, firefox.analysis.redraws],
    ['exports', chromium.analysis.exports, firefox.analysis.exports],
    ['viewport.width', chromium.report.viewport.width, firefox.report.viewport.width],
    ['viewport.height', chromium.report.viewport.height, firefox.report.viewport.height],
  ];
  for (const [field, left, right] of comparisonFields) {
    if (left !== right) {
      throw new TypeError(`Cannot compare different ${field} values: ${left} vs ${right}`);
    }
  }

  const differences = {};
  for (const key of ['initialLive', 'afterRedrawLive', 'finalLive',
    'persistentLiveDelta', 'newExportContextCount', 'newExportContextLive',
    'existingContextExportLiveDelta', 'contextLost']) {
    differences[key] = safeDifference(firefox.result[key], chromium.result[key], key);
  }
  for (const phase of ['redraw', 'exports']) {
    differences[phase] = {};
    for (const key of ['created', 'deleted', 'live']) {
      differences[phase][key] = safeDifference(
        firefox.result[phase][key], chromium.result[phase][key], `${phase}.${key}`,
      );
    }
  }

  const warnings = [
    'WebGL API buffer handles are not GPU bytes, proof of a leak, or a performance ranking.',
    'The reports do not cryptographically establish matching asset packs, code revisions, graphics drivers, or hardware.',
  ];
  // The probe emits an ISO UTC timestamp. Do not silently treat reports from
  // widely separated sessions as equivalent controlled measurements.
  const timestamp = (value) => {
    if (typeof value !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return null;
    const time = Date.parse(value);
    return Number.isFinite(time) && new Date(time).toISOString() === value ? time : null;
  };
  const chromiumTime = timestamp(chromium.report.recordedAt);
  const firefoxTime = timestamp(firefox.report.recordedAt);
  if (chromiumTime === null || firefoxTime === null) {
    warnings.push('Recorded-at UTC timestamp missing or invalid in at least one report; session proximity cannot be checked');
  } else if (Math.abs(chromiumTime - firefoxTime) > 24 * 60 * 60 * 1000) {
    warnings.push('Reports were recorded more than 24 hours apart; confirm matching assets, source revision and host environment');
  }
  for (const label of ['node', 'platform', 'architecture']) {
    const left = chromium.report[label];
    const right = firefox.report[label];
    if (typeof left !== 'string' || typeof right !== 'string' || !left || !right) {
      warnings.push(`${label} metadata missing in at least one report`);
    } else if (left !== right) {
      warnings.push(`${label} differs (${left} / ${right}); hardware/runtime comparisons are less controlled`);
    }
  }
  for (const item of [chromium, firefox]) {
    if (item.result.persistentLiveDelta > 0) {
      warnings.push(`${item.browser}: persistent contexts have positive API-live buffer growth after redraws; investigate, do not infer a leak`);
    }
    if (item.result.contextLost) {
      warnings.push(`${item.browser}: WebGL context losses were observed`);
    }
  }

  return {
    schemaVersion: 1,
    comparison: 'descriptive-only',
    config: {
      chart: chromium.report.chart,
      viewport: {
        width: chromium.report.viewport.width,
        height: chromium.report.viewport.height,
      },
      redraws: chromium.analysis.redraws,
      exports: chromium.analysis.exports,
    },
    browsers: {
      chromium: {
        browserVersion: chromium.analysis.source.browserVersion,
        recordedAt: chromium.analysis.source.recordedAt,
        metrics: chromium.result,
      },
      firefox: {
        browserVersion: firefox.analysis.source.browserVersion,
        recordedAt: firefox.analysis.source.recordedAt,
        metrics: firefox.result,
      },
    },
    firefoxMinusChromium: differences,
    warnings,
  };
}
