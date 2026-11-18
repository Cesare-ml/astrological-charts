import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installWebGLBufferLedger} from '../scripts/webgl-buffer-ledger.mjs';

function fakeBrowser() {
  let nextId = 0;
  const listeners = new Map();
  class WebGLRenderingContext {
    returnNull = false;
    failDelete = false;
    createBuffer() { return this.returnNull ? null : {id: ++nextId}; }
    deleteBuffer(_buffer) {
      if (this.failDelete) throw new Error('GPU rejected deletion');
    }
  }
  // Mirrors a WebGL2 implementation whose methods delegate to WebGL1 methods,
  // ensuring nested prototype wrappers never count a handle twice.
  class WebGL2RenderingContext extends WebGLRenderingContext {
    createBuffer() { return super.createBuffer(); }
    deleteBuffer(buffer) { return super.deleteBuffer(buffer); }
  }
  const target = {
    WebGLRenderingContext,
    WebGL2RenderingContext,
    document: {
      addEventListener(name, fn) { listeners.set(name, fn); },
    },
  };
  return {target, listeners, GL1: WebGLRenderingContext, GL2: WebGL2RenderingContext};
}

test('tracks unique WebGL1 and WebGL2 buffers without double wrapping inherited calls', () => {
  const {target, GL1, GL2} = fakeBrowser();
  const ledger = installWebGLBufferLedger(target);
  const gl1 = new GL1();
  const gl2 = new GL2();
  const a = gl1.createBuffer();
  const b = gl2.createBuffer();
  assert.deepEqual(ledger.snapshot(), {
    created: 2, deleted: 0, live: 2, contexts: 2, contextLost: 0,
    perContext: [
      {id: 1, created: 1, deleted: 0, live: 1},
      {id: 2, created: 1, deleted: 0, live: 1},
    ],
  });
  gl1.deleteBuffer(a);
  gl2.deleteBuffer(b);
  assert.equal(ledger.snapshot().live, 0);
  assert.equal(ledger.snapshot().deleted, 2);
});

test('null handles and duplicate deleteBuffer calls are not counted', () => {
  const {target, GL1} = fakeBrowser();
  const ledger = installWebGLBufferLedger(target);
  const gl = new GL1();
  gl.returnNull = true;
  assert.equal(gl.createBuffer(), null);
  assert.equal(ledger.snapshot().created, 0);
  gl.returnNull = false;
  const buffer = gl.createBuffer();
  gl.deleteBuffer(buffer);
  gl.deleteBuffer(buffer);
  gl.deleteBuffer(null);
  assert.deepEqual(
    {created: ledger.snapshot().created, deleted: ledger.snapshot().deleted, live: ledger.snapshot().live},
    {created: 1, deleted: 1, live: 0},
  );
});

test('deletion on the wrong context does not reduce the owners live counter', () => {
  const {target, GL1} = fakeBrowser();
  const ledger = installWebGLBufferLedger(target);
  const first = new GL1();
  const second = new GL1();
  const buffer = first.createBuffer();
  second.deleteBuffer(buffer);
  assert.equal(ledger.snapshot().live, 1);
  first.deleteBuffer(buffer);
  assert.equal(ledger.snapshot().live, 0);
});

test('failed native deletion is not reported as successfully disposed', () => {
  const {target, GL1} = fakeBrowser();
  const ledger = installWebGLBufferLedger(target);
  const gl = new GL1();
  const buffer = gl.createBuffer();
  gl.failDelete = true;
  assert.throws(() => gl.deleteBuffer(buffer), /GPU rejected deletion/);
  assert.equal(ledger.snapshot().live, 1);
  gl.failDelete = false;
  gl.deleteBuffer(buffer);
  assert.equal(ledger.snapshot().live, 0);
});

test('snapshots are detached, context-loss events are recorded, install is idempotent', () => {
  const {target, GL1, listeners} = fakeBrowser();
  const ledger = installWebGLBufferLedger(target);
  assert.equal(installWebGLBufferLedger(target), ledger);
  const gl = new GL1();
  gl.createBuffer();
  const snapshot = ledger.snapshot();
  snapshot.perContext[0].live = -999;
  listeners.get('webglcontextlost')();
  assert.equal(ledger.snapshot().live, 1);
  assert.equal(ledger.snapshot().contextLost, 1);
});

test('works when WebGL is unavailable without creating phantom contexts', () => {
  const ledger = installWebGLBufferLedger({document: {addEventListener() {}}});
  assert.deepEqual(ledger.snapshot(), {
    created: 0, deleted: 0, live: 0, contexts: 0, contextLost: 0, perContext: [],
  });
});
