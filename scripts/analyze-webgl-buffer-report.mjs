/**
 * Review a saved WebGL buffer benchmark without mistaking cumulative API handle
 * counts for allocated GPU bytes. Deliberately dependency-free and read-only.
 */
function natural(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function snapshot(value, label) {
  const entry = object(value, label);
  for (const field of ['created', 'deleted', 'live', 'contexts', 'contextLost']) {
    natural(entry[field], `${label}.${field}`);
  }
  if (!Array.isArray(entry.perContext) || entry.perContext.length !== entry.contexts) {
    throw new TypeError(`${label}.perContext must match the context count`);
  }
  const seen = new Set();
  const sums = {created: 0, deleted: 0, live: 0};
  for (const [index, raw] of entry.perContext.entries()) {
    const row = object(raw, `${label}.perContext[${index}]`);
    natural(row.id, `${label}.perContext[${index}].id`);
    if (row.id < 1 || seen.has(row.id)) throw new TypeError(`${label}: duplicate or invalid context ID`);
    seen.add(row.id);
    for (const field of ['created', 'deleted', 'live']) {
      natural(row[field], `${label}.perContext[${index}].${field}`);
      sums[field] += row[field];
      if (!Number.isSafeInteger(sums[field])) throw new TypeError(`${label}: counter sum overflow`);
    }
    if (row.created - row.deleted !== row.live) {
      throw new TypeError(`${label}: inconsistent live count for context ${row.id}`);
    }
  }
  for (const field of ['created', 'deleted', 'live']) {
    if (entry[field] !== sums[field]) throw new TypeError(`${label}: total ${field} disagrees with contexts`);
  }
  return entry;
}

function assertMonotone(previous, current, label) {
  for (const field of ['created', 'deleted', 'contexts', 'contextLost']) {
    if (current[field] < previous[field]) throw new TypeError(`${label}: ${field} counter decreased`);
  }
  const later = new Map(current.perContext.map(row => [row.id, row]));
  for (const old of previous.perContext) {
    const next = later.get(old.id);
    if (!next) throw new TypeError(`${label}: context ${old.id} disappeared`);
    if (next.created < old.created || next.deleted < old.deleted) {
      throw new TypeError(`${label}: context ${old.id} counters decreased`);
    }
  }
}

const delta = (last, first) => ({
  created: last.created - first.created,
  deleted: last.deleted - first.deleted,
  live: last.live - first.live,
});

export function analyzeWebGLBufferReport(data) {
  const report = object(data, 'report');
  const redraws = natural(report.redraws, 'report.redraws');
  const exportsCount = natural(report.exports, 'report.exports');
  if (!Array.isArray(report.checkpoints) || report.checkpoints.length < 3) {
    throw new TypeError('report.checkpoints must include initial, redraw and export snapshots');
  }

  const initial = snapshot(report.checkpoints[0], 'checkpoints[0]');
  if (initial.phase !== 'initial' || initial.index !== 0) {
    throw new TypeError('first checkpoint must be initial at index 0');
  }

  let stage = 0;
  let lastRedrawIndex = 0;
  let lastExportIndex = 0;
  let lastRedraw = null;
  let lastExport = null;
  let previous = initial;
  for (let i = 1; i < report.checkpoints.length; i++) {
    const point = snapshot(report.checkpoints[i], `checkpoints[${i}]`);
    natural(point.index, `checkpoints[${i}].index`);
    if (point.phase === 'redraw' && stage === 0) {
      if (point.index <= lastRedrawIndex || point.index > redraws) {
        throw new TypeError(`checkpoints[${i}]: invalid redraw index`);
      }
      lastRedrawIndex = point.index;
      lastRedraw = point;
    } else if (point.phase === 'export') {
      stage = 1;
      if (!lastRedraw || point.index !== lastExportIndex + 1 || point.index > exportsCount) {
        throw new TypeError(`checkpoints[${i}]: invalid export order`);
      }
      lastExportIndex = point.index;
      lastExport = point;
    } else {
      throw new TypeError(`checkpoints[${i}]: unexpected phase or order`);
    }
    assertMonotone(previous, point, `checkpoints[${i}]`);
    previous = point;
  }
  if (!lastRedraw || !lastExport || lastRedrawIndex !== redraws || lastExportIndex !== exportsCount) {
    throw new TypeError('checkpoint indices must reach the declared redraw/export totals');
  }

  const final = snapshot(report.final, 'final');
  assertMonotone(previous, final, 'final');
  const initialContexts = new Map(initial.perContext.map(row => [row.id, row]));
  const beforeExport = new Map(lastRedraw.perContext.map(row => [row.id, row]));
  const finalContexts = new Map(final.perContext.map(row => [row.id, row]));

  const persistentDuringRedraw = lastRedraw.perContext
    .filter(row => initialContexts.has(row.id))
    .map(row => ({
      id: row.id,
      initialLive: initialContexts.get(row.id).live,
      afterRedrawLive: row.live,
      liveDelta: row.live - initialContexts.get(row.id).live,
    }));
  const newExportContexts = final.perContext.filter(row => !beforeExport.has(row.id));
  const existingContextLiveDeltaDuringExports = lastRedraw.perContext.reduce(
    (total, row) => total + finalContexts.get(row.id).live - row.live, 0,
  );
  const notices = [];
  for (const row of persistentDuringRedraw) {
    if (row.liveDelta > 0) {
      notices.push(`Context ${row.id}: ${row.liveDelta} additional API-live buffers after redraws; investigate with real GPU profiling.`);
    }
  }
  if (newExportContexts.length) {
    notices.push(`${newExportContexts.length} new WebGL context(s) first observed after PNG exports; their cumulative API-live handles are not a GPU memory measurement.`);
  }
  if (final.contextLost > 0) notices.push(`Observed ${final.contextLost} WebGL context-loss events.`);

  return {
    schemaVersion: 1,
    source: {
      browser: typeof report.browser === 'string' ? report.browser : null,
      browserVersion: typeof report.browserVersion === 'string' ? report.browserVersion : null,
      recordedAt: typeof report.recordedAt === 'string' ? report.recordedAt : null,
    },
    redraws,
    exports: exportsCount,
    checkpointCount: report.checkpoints.length,
    phases: {
      redraw: delta(lastRedraw, initial),
      exports: delta(final, lastRedraw),
    },
    totals: {initialLive: initial.live, afterRedrawLive: lastRedraw.live, finalLive: final.live},
    persistentDuringRedraw,
    exportsByContext: {
      newContextIds: newExportContexts.map(row => row.id),
      newContextLive: newExportContexts.reduce((total, row) => total + row.live, 0),
      existingContextLiveDelta: existingContextLiveDeltaDuringExports,
    },
    contextLost: final.contextLost,
    notices,
    interpretation: 'These are WebGL API buffer handle counts, not GPU bytes, a leak verdict, or production hardware validation.',
  };
}
