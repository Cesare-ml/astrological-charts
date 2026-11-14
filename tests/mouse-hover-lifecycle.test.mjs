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

function harness(onLeave = null, onEnter = null) {
  const fakeWindow = new FakeEvents();
  const canvas = new FakeEvents();
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 300 });
  const scene = { children: [], hits: [] };
  class Raycaster {
    setFromCamera() {}
    intersectObjects() { return scene.hits.map(object => ({ object })); }
  }
  class Vector2 { x = 0; y = 0; }
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
  const manager = new exports.GestoreEventiMouse(canvas, {}, scene, {
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
  return { manager, canvas, fakeWindow, scene, events, move };
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
