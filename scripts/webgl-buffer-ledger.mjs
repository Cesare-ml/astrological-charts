/**
 * Instrument WebGL buffer handles without retaining WebGL contexts or buffers
 * in a strong collection. Call during page initialization before Three.js.
 *
 * Counters describe explicit API create/delete calls, NOT retained GPU bytes.
 * A garbage-collected context can release resources without calling deleteBuffer.
 */
export function installWebGLBufferLedger(target = globalThis) {
  if (target.__virgoWebGLBufferLedger) return target.__virgoWebGLBufferLedger;

  const contexts = new WeakMap();
  const handles = new WeakMap();
  const states = [];
  let contextLost = 0;

  function stateFor(context) {
    let state = contexts.get(context);
    if (!state) {
      state = {id: states.length + 1, created: 0, deleted: 0, live: 0};
      contexts.set(context, state);
      states.push(state);
    }
    return state;
  }

  function patch(proto, method) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, method);
    // WebGL2 may inherit the same implementation; do not wrap twice.
    if (!descriptor || typeof descriptor.value !== 'function') return;
    const original = descriptor.value;
    Object.defineProperty(proto, method, {
      ...descriptor,
      value: function (...args) {
        if (method === 'createBuffer') {
          const buffer = original.apply(this, args);
          if (buffer && typeof buffer === 'object' && !handles.has(buffer)) {
            const state = stateFor(this);
            state.created++;
            state.live++;
            handles.set(buffer, {state, active: true});
          }
          return buffer;
        }

        // A failed native call must not appear as a successful deletion.
        const result = original.apply(this, args);
        const buffer = args[0];
        if (buffer && typeof buffer === 'object') {
          const record = handles.get(buffer);
          if (record?.active && record.state === stateFor(this)) {
            record.active = false;
            record.state.deleted++;
            record.state.live--;
          }
        }
        return result;
      },
    });
  }

  for (const ctor of [target.WebGLRenderingContext, target.WebGL2RenderingContext]) {
    if (!ctor?.prototype) continue;
    patch(ctor.prototype, 'createBuffer');
    patch(ctor.prototype, 'deleteBuffer');
  }

  target.document?.addEventListener?.('webglcontextlost', () => { contextLost++; }, true);
  const ledger = {
    snapshot() {
      const perContext = states.map(({id, created, deleted, live}) =>
        ({id, created, deleted, live}));
      return {
        created: perContext.reduce((sum, row) => sum + row.created, 0),
        deleted: perContext.reduce((sum, row) => sum + row.deleted, 0),
        live: perContext.reduce((sum, row) => sum + row.live, 0),
        contexts: perContext.length,
        contextLost,
        perContext,
      };
    },
  };
  target.__virgoWebGLBufferLedger = ledger;
  return ledger;
}
