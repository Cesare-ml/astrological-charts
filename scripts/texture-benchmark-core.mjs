/**
 * Browser hook and pure checkpoint analysis for the local chart benchmark.
 * Observed handle lifecycle is NOT a measurement of physical GPU memory.
 * This hook is intentionally self-contained so Playwright can serialize it.
 */
export function installTextureCounters() {
  // Count successfully obtained texture handles and only the first release
  // request from their owning context. Repeated deleteTexture calls, null
  // creations, and deletions of foreign handles are not live-handle changes.
  // Weak references avoid retaining textures just to monitor their lifetime.
  const stats = {created: 0, deleted: 0, contextLost: 0};
  const owners = new WeakMap();
  const live = new WeakSet();
  const isHandle = value => value !== null &&
    (typeof value === 'object' || typeof value === 'function');
  globalThis.__benchmarkWebGL = stats;
  globalThis.document.addEventListener('webglcontextlost', () => { stats.contextLost++; }, true);
  for (const type of [globalThis.WebGLRenderingContext, globalThis.WebGL2RenderingContext]) {
    if (!type) continue;
    const proto = type.prototype;
    for (const method of ['createTexture', 'deleteTexture']) {
      // WebGL2 can inherit the WebGL1 implementation. Instrument each real
      // method only once, not again via the inherited prototype.
      if (!Object.prototype.hasOwnProperty.call(proto, method)) continue;
      const original = proto[method];
      if (typeof original !== 'function') continue;
      if (method === 'createTexture') {
        proto[method] = function (...args) {
          const texture = original.apply(this, args);
          if (isHandle(texture) && !live.has(texture)) {
            owners.set(texture, this);
            live.add(texture);
            stats.created++;
          }
          return texture;
        };
      } else {
        proto[method] = function (...args) {
          const texture = args[0];
          const known = isHandle(texture) &&
            live.has(texture) && owners.get(texture) === this;
          const result = original.apply(this, args);
          if (known) {
            live.delete(texture);
            stats.deleted++;
          }
          return result;
        };
      }
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
