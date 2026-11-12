import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installTextureCounters, summarizeTextureCheckpoints } from '../scripts/texture-benchmark-core.mjs';

test('inherited WebGL2 methods are instrumented only once', () => {
  const before = ['WebGLRenderingContext', 'WebGL2RenderingContext', 'document', '__benchmarkWebGL']
    .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  try {
    class GL1 {
      createTexture() { return {id: 1}; }
      deleteTexture() { return undefined; }
    }
    class GL2 extends GL1 {}
    const listeners = [];
    globalThis.WebGLRenderingContext = GL1;
    globalThis.WebGL2RenderingContext = GL2;
    globalThis.document = {addEventListener: (...args) => listeners.push(args)};
    const stats = installTextureCounters();
    const gl2 = new GL2();
    const texture = gl2.createTexture();
    gl2.deleteTexture(texture);
    assert.deepEqual(stats, {created: 1, deleted: 1, contextLost: 0});
    assert.equal(listeners.length, 1);
    assert.equal(listeners[0][0], 'webglcontextlost');
    listeners[0][1]();
    assert.equal(stats.contextLost, 1);
  } finally {
    for (const [key, descriptor] of before) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

test('independent WebGL2 implementations are counted', () => {
  const keys = ['WebGLRenderingContext', 'WebGL2RenderingContext', 'document', '__benchmarkWebGL'];
  const before = keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  try {
    class GL1 {createTexture() {return {}; } deleteTexture() {}}
    class GL2 {createTexture() {return {}; } deleteTexture() {}}
    globalThis.WebGLRenderingContext = GL1;
    globalThis.WebGL2RenderingContext = GL2;
    globalThis.document = {addEventListener() {}};
    const stats = installTextureCounters();
    const gl1 = new GL1();
    const gl2 = new GL2();
    gl1.createTexture();
    const texture = gl2.createTexture();
    gl2.deleteTexture(texture);
    assert.deepEqual(stats, {created: 2, deleted: 1, contextLost: 0});
  } finally {
    for (const [key, descriptor] of before) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

test('null creations, repeated deletes, and foreign-context deletes never skew live handles', () => {
  const keys = ['WebGLRenderingContext', 'WebGL2RenderingContext', 'document', '__benchmarkWebGL'];
  const before = keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  try {
    class GL1 {
      createTexture() { return this.fail ? null : {id: 1}; }
      deleteTexture() { return undefined; }
    }
    globalThis.WebGLRenderingContext = GL1;
    globalThis.WebGL2RenderingContext = undefined;
    globalThis.document = {addEventListener() {}};
    const stats = installTextureCounters();
    const first = new GL1();
    const other = new GL1();
    first.fail = true;
    assert.equal(first.createTexture(), null);
    assert.equal(stats.created, 0, 'null is not a successful texture allocation');
    first.fail = false;
    const tex = first.createTexture();
    assert.deepEqual(stats, {created: 1, deleted: 0, contextLost: 0});
    other.deleteTexture(tex);
    first.deleteTexture({id: 1});
    first.deleteTexture(null);
    assert.equal(stats.deleted, 0, 'unknown/foreign/null requests do not release a tracked handle');
    first.deleteTexture(tex);
    first.deleteTexture(tex);
    assert.deepEqual(stats, {created: 1, deleted: 1, contextLost: 0},
      'releasing the same texture twice must count only once');
  } finally {
    for (const [key, descriptor] of before) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

test('creation/deletion failures do not change counters', () => {
  const keys = ['WebGLRenderingContext', 'WebGL2RenderingContext', 'document', '__benchmarkWebGL'];
  const before = keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  try {
    class GL1 {
      createTexture() {
        if (this.throwCreate) throw new Error('create failed');
        return {};
      }
      deleteTexture() {if (this.throwDelete) throw new Error('delete failed');}
    }
    globalThis.WebGLRenderingContext = GL1;
    globalThis.WebGL2RenderingContext = undefined;
    globalThis.document = {addEventListener() {}};
    const stats = installTextureCounters();
    const gl = new GL1();
    gl.throwCreate = true;
    assert.throws(() => gl.createTexture(), /create failed/);
    assert.deepEqual(stats, {created: 0, deleted: 0, contextLost: 0});
    gl.throwCreate = false;
    const texture = gl.createTexture();
    gl.throwDelete = true;
    assert.throws(() => gl.deleteTexture(texture), /delete failed/);
    assert.deepEqual(stats, {created: 1, deleted: 0, contextLost: 0});
    gl.throwDelete = false;
    gl.deleteTexture(texture);
    assert.deepEqual(stats, {created: 1, deleted: 1, contextLost: 0});
  } finally {
    for (const [key, descriptor] of before) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

test('checkpoint analysis tracks outstanding handles rather than raw creation counts', () => {
  assert.deepEqual(summarizeTextureCheckpoints([
    {redraw: 0, created: 5, deleted: 1},
    {redraw: 10, created: 45, deleted: 40},
    {redraw: 20, created: 85, deleted: 79},
  ]), {
    baselineOutstanding: 4, finalOutstanding: 6, netGrowth: 2,
    peakCheckpointOutstanding: 6,
    checkpoints: [
      {redraw: 0, created: 5, deleted: 1, outstanding: 4},
      {redraw: 10, created: 45, deleted: 40, outstanding: 5},
      {redraw: 20, created: 85, deleted: 79, outstanding: 6},
    ],
  });
});

test('checkpoint analysis accepts stable and decreasing outstanding handles', () => {
  assert.equal(summarizeTextureCheckpoints([
    {redraw: 0, created: 4, deleted: 0},
    {redraw: 1, created: 8, deleted: 8},
  ]).netGrowth, -4);
});

test('checkpoint analysis rejects malformed, reordered or impossible counters', () => {
  for (const value of [
    [],
    [{redraw: 0, created: 1, deleted: 0}],
    [{redraw: 1, created: 1, deleted: 0}, {redraw: 2, created: 2, deleted: 1}],
    [{redraw: 0, created: 1, deleted: 2}, {redraw: 1, created: 2, deleted: 2}],
    [{redraw: 0, created: 1, deleted: 0}, {redraw: 1, created: 0, deleted: 0}],
    [{redraw: 0, created: 1, deleted: 0}, {redraw: 0, created: 2, deleted: 1}],
  ]) assert.throws(() => summarizeTextureCheckpoints(value), TypeError);
});
