import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

// Exercise the actual TypeScript class without a browser, WebGL or real natal data.
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/lib/renderers/@gestore-eventi-mouse.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

class FakeEvents {
  listeners = new Map();

  addEventListener(name, callback) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(callback);
  }

  removeEventListener(name, callback) {
    this.listeners.get(name)?.delete(callback);
  }

  emit(name, event = {}) {
    for (const callback of [...(this.listeners.get(name) ?? [])]) callback(event);
  }

  listenerCount(name) {
    return this.listeners.get(name)?.size ?? 0;
  }
}

function harness(onLeave = null, onEnter = null, sharedWindow = null) {
  const fakeWindow = sharedWindow ?? new FakeEvents();
  const canvas = new FakeEvents();
  let rect = { left: 0, top: 0, width: 300, height: 300 };
  canvas.getBoundingClientRect = () => rect;
  const scene = { children: [], hits: [] };
  const camera = { zoom: 1, position: { z: 3 } };
  class Raycaster {
    setFromCamera() {}
    intersectObjects() { return scene.hits.map(object => ({ object })); }
  }
  class Vector2 { x = 0; y = 0; set(x, y) { this.x = x; this.y = y; return this; } }
  const exports = {};
  runInNewContext(compiled, {
    exports,
    module: { exports },
    window: fakeWindow,
    require(id) {
      assert.equal(id, 'three');
      return { Raycaster, Vector2 };
    }
  }, { filename: '@gestore-eventi-mouse.ts' });

  const events = [];
  const manager = new exports.GestoreEventiMouse(canvas, camera, scene, {
    onHoverEnter: object => {
      events.push(['enter', object]);
      onEnter?.(canvas);
    },
    onHoverLeave: object => {
      events.push(['leave', object]);
      onLeave?.(canvas);
    },
    onClick: object => events.push(['click', object])
  });

  const move = () => canvas.emit('mousemove', { clientX: 150, clientY: 150 });
  return { manager, canvas, fakeWindow, scene, camera, events, move, setRect(next) { rect = next; } };
}

test('mouseleave clears highlighted glyph and permits entering it again', () => {
  const ctx = harness();
  const glyph = { name: 'Sun' };
  ctx.scene.hits = [glyph];

  ctx.move();
  ctx.canvas.emit('mouseleave');
  ctx.canvas.emit('mouseleave');
  ctx.move();

  assert.deepEqual(ctx.events, [
    ['enter', glyph], ['leave', glyph], ['enter', glyph]
  ]);
  ctx.manager.distruggi();
});

test('window blur clears hover without a duplicate leave on canvas exit', () => {
  const ctx = harness();
  const glyph = { name: 'Moon' };
  ctx.scene.hits = [glyph];

  ctx.move();
  ctx.fakeWindow.emit('blur');
  ctx.canvas.emit('mouseleave');

  assert.deepEqual(ctx.events, [['enter', glyph], ['leave', glyph]]);
  ctx.manager.distruggi();
});

test('teardown clears hover and detaches every registered listener', () => {
  const ctx = harness();
  const glyph = { name: 'AS' };
  ctx.scene.hits = [glyph];

  ctx.move();
  ctx.manager.distruggi();
  ctx.move();
  ctx.canvas.emit('click', { clientX: 150, clientY: 150 });
  ctx.canvas.emit('mouseleave');
  ctx.fakeWindow.emit('blur');

  assert.deepEqual(ctx.events, [['enter', glyph], ['leave', glyph]]);
  for (const name of ['mousemove', 'mouseleave', 'click']) {
    assert.equal(ctx.canvas.listenerCount(name), 0, name);
  }
  for (const name of ['resize', 'blur']) {
    assert.equal(ctx.fakeWindow.listenerCount(name), 0, name);
  }
});

test('reentrant mouseleave does not emit duplicate hover-leave callbacks', () => {
  const ctx = harness(canvas => canvas.emit('mouseleave'));
  const glyph = { name: 'MC' };
  ctx.scene.hits = [glyph];

  ctx.move();
  ctx.canvas.emit('mouseleave');

  assert.deepEqual(ctx.events, [['enter', glyph], ['leave', glyph]]);
  ctx.manager.distruggi();
});

test('mouseleave dispatched during enter immediately clears the active glyph', () => {
  const ctx = harness(null, canvas => canvas.emit('mouseleave'));
  const glyph = { name: 'DS' };
  ctx.scene.hits = [glyph];

  ctx.move();

  assert.deepEqual(ctx.events, [['enter', glyph], ['leave', glyph]]);
  ctx.manager.distruggi();
});

test('mouseleave dispatched by previous glyph leave prevents an obsolete new enter', () => {
  let shouldLeave = false;
  const ctx = harness(canvas => { if (shouldLeave) canvas.emit('mouseleave'); });
  const first = { name: 'Sun' };
  const second = { name: 'Moon' };
  ctx.scene.hits = [first];
  ctx.move();
  shouldLeave = true;
  ctx.scene.hits = [second];
  ctx.move();

  assert.deepEqual(ctx.events, [['enter', first], ['leave', first]]);
  ctx.manager.distruggi();
});

test('ordinary glyph transition emits one leave followed by one enter', () => {
  const ctx = harness();
  const first = { name: 'Sun' };
  const second = { name: 'Moon' };
  ctx.scene.hits = [first];
  ctx.move();
  ctx.scene.hits = [second];
  ctx.move();

  assert.deepEqual(ctx.events, [
    ['enter', first], ['leave', first], ['enter', second]
  ]);
  ctx.manager.distruggi();
});

test('newer nested pointer move wins over obsolete outer transition', () => {
  let nested = false;
  let ctx;
  const first = { name: 'Sun' };
  const obsolete = { name: 'Moon' };
  const latest = { name: 'MC' };
  ctx = harness(() => {
    if (nested) return;
    nested = true;
    ctx.scene.hits = [latest];
    ctx.move();
  });
  ctx.scene.hits = [first];
  ctx.move();
  ctx.scene.hits = [obsolete];
  ctx.move();

  assert.deepEqual(ctx.events, [
    ['enter', first], ['leave', first], ['enter', latest]
  ]);
  ctx.manager.distruggi();
});

test('window blur detaches the stored pointer so resize cannot resurrect an axis hover', () => {
  const ctx = harness();
  const glyph = { name: 'AS' };
  ctx.scene.hits = [glyph];

  ctx.move();
  ctx.fakeWindow.emit('blur');
  ctx.fakeWindow.emit('resize');

  assert.deepEqual(ctx.events, [['enter', glyph], ['leave', glyph]]);
  assert.equal(ctx.camera.zoom, 1);
  assert.equal(ctx.camera.position.z, 3);
  ctx.manager.distruggi();
});

test('AS/DS/MC/IC pointer transitions do not modify the camera or trigger zoom', () => {
  const ctx = harness();
  const axes = ['AS', 'DS', 'MC', 'IC'].map(name => ({ name }));
  for (const axis of axes) {
    ctx.scene.hits = [axis];
    ctx.move();
  }
  ctx.canvas.emit('mouseleave');

  assert.deepEqual(ctx.events, [
    ['enter', axes[0]], ['leave', axes[0]],
    ['enter', axes[1]], ['leave', axes[1]],
    ['enter', axes[2]], ['leave', axes[2]],
    ['enter', axes[3]], ['leave', axes[3]],
  ]);
  assert.equal(ctx.camera.zoom, 1);
  assert.equal(ctx.camera.position.z, 3);
  ctx.manager.distruggi();
});


test('two charts sharing one window maintain independent hover and teardown', () => {
  const win = new FakeEvents();
  const a = harness(null, null, win);
  const b = harness(null, null, win);
  const asc = { name: 'AS' };
  const ic = { name: 'IC' };
  a.scene.hits = [asc];
  b.scene.hits = [ic];

  a.move();
  b.move();
  assert.deepEqual(a.events, [['enter', asc]]);
  assert.deepEqual(b.events, [['enter', ic]]);
  assert.equal(win.listenerCount('blur'), 2);

  a.manager.distruggi();
  assert.equal(win.listenerCount('blur'), 1);
  win.emit('blur');
  b.move();

  assert.deepEqual(a.events, [['enter', asc], ['leave', asc]]);
  assert.deepEqual(b.events, [['enter', ic], ['leave', ic], ['enter', ic]]);
  assert.equal(a.camera.zoom, 1);
  assert.equal(b.camera.zoom, 1);
  b.manager.distruggi();
  assert.equal(win.listenerCount('blur'), 0);
  assert.equal(win.listenerCount('resize'), 0);
});

test('invalid canvas geometry prevents raycast and clears the previous highlight', () => {
  const ctx = harness();
  const sun = { name: 'Sun' };
  ctx.scene.hits = [sun];
  ctx.move();
  ctx.setRect({ left: 0, top: 0, width: 0, height: 300 });
  ctx.move();
  ctx.canvas.emit('click', { clientX: 10, clientY: 10 });
  ctx.setRect({ left: 0, top: 0, width: 300, height: 300 });
  ctx.move();

  assert.deepEqual(ctx.events, [
    ['enter', sun], ['leave', sun], ['enter', sun]
  ]);
  ctx.manager.distruggi();
});

test('teardown during an enter callback emits exactly one balancing leave', () => {
  let ctx;
  ctx = harness(null, () => ctx.manager.distruggi());
  const glyph = { name: 'DS' };
  ctx.scene.hits = [glyph];
  ctx.move();
  ctx.move();

  assert.deepEqual(ctx.events, [['enter', glyph], ['leave', glyph]]);
  assert.equal(ctx.canvas.listenerCount('mousemove'), 0);
  assert.equal(ctx.fakeWindow.listenerCount('blur'), 0);
});

test('teardown during leave prevents stale next-glyph enter', () => {
  let ctx;
  let shouldDestroy = false;
  ctx = harness(() => {
    if (shouldDestroy) ctx.manager.distruggi();
  });
  const first = { name: 'Sun' }, next = { name: 'Moon' };
  ctx.scene.hits = [first];
  ctx.move();
  shouldDestroy = true;
  ctx.scene.hits = [next];
  ctx.move();

  assert.deepEqual(ctx.events, [['enter', first], ['leave', first]]);
  assert.equal(ctx.canvas.listenerCount('mousemove'), 0);
  assert.equal(ctx.fakeWindow.listenerCount('resize'), 0);
});
