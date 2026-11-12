/**
 * Browser hook and pure checkpoint analysis for the local chart benchmark.
 * Texture API calls are NOT a measurement of physical GPU memory.
 * This hook is intentionally self-contained so Playwright can serialize it.
 */
export function installTextureCounters() {
  const stats = {created: 0, deleted: 0, contextLost: 0};
  globalThis.__benchmarkWebGL = stats;
  globalThis.document.addEventListener('webglcontextlost', () => { stats.contextLost++; }, true);
  for (const type of [globalThis.WebGLRenderingContext, globalThis.WebGL2RenderingContext]) {
    if (!type) continue;
    const proto = type.prototype;
    for (const [method, field] of [['createTexture', 'created'], ['deleteTexture', 'deleted']]) {
      // WebGL2 may inherit a method from WebGL1. Patching the inherited
      // method twice would double-count the very same API invocation.
      if (!Object.prototype.hasOwnProperty.call(proto, method)) continue;
      const original = proto[method];
      if (typeof original !== 'function') continue;
      proto[method] = function (...args) {
        stats[field]++;
        return original.apply(this, args);
      };
    }
  }
  return stats;
}

export function summarizeTextureCheckpoints(checkpoints) {
  if (!Array.isArray(checkpoints) || checkpoints.length < 2)
    throw new TypeError('At least a baseline and final checkpoint are required');
  const annotated = checkpoints.map((entry, index) => {
    if (!entry || !Number.isSafeInteger(entry.created) || !Number.isSafeInteger(entry.deleted)
      || entry.created < 0 || entry.deleted < 0 || entry.deleted > entry.created
      || !Number.isSafeInteger(entry.redraw) || entry.redraw < 0)
      throw new TypeError('Invalid texture checkpoint at index ' + index);
    return {...entry, outstanding: entry.created - entry.deleted};
  });
  if (annotated[0].redraw !== 0 || annotated.some((item, i) =>
    i > 0 && (item.redraw <= annotated[i - 1].redraw
      || item.created < annotated[i - 1].created
      || item.deleted < annotated[i - 1].deleted)))
    throw new TypeError('Texture checkpoints must have monotonic counters and redraw indices');
  const baseline = annotated[0].outstanding;
  const final = annotated.at(-1).outstanding;
  return {
    baselineOutstanding: baseline,
    finalOutstanding: final,
    netGrowth: final - baseline,
    peakCheckpointOutstanding: Math.max(...annotated.map(item => item.outstanding)),
    checkpoints: annotated,
  };
}
