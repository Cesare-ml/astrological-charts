import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Compile the actual internal TypeScript mouse adapter. A tiny fake of Three.js
// permits deterministic pointer and listener tests without WebGL or a browser.
const source = readFileSync(new URL('../src/lib/renderers/@gestore-eventi-mouse.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const raycasters = [];
class FakeRaycaster {
  constructor() { this.hits = []; this.lastPoint = null; raycasters.push(this); }
  setFromCamera(vector, camera) { this.lastPoint = { x: vector.x, y: vector.y, camera }; }
  intersectObjects(children, recursive) {
    assert.equal(recursive, true);
    assert.ok(Array.isArray(children));
    return this.hits.map(object => ({ object }));
  }
}
class FakeVector2 {
  constructor() { this.x = 0; this.y = 0; }
  set(x, y) { this.x = x; this.y = y; return this; }
}
const exports = {};
const mod = { exports };
new Function('require', 'module', 'exports', compiled)(
  name => {
    assert.equal(name, 'three');
    return { Raycaster: FakeRaycaster, Vector2: FakeVector2 };
  },
  mod, exports
);
const { mousePositionToNdc, GestoreEventiMouse } = mod.exports;

function eventTarget() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(name, handler) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(handler);
    },
    removeEventListener(name, handler) { listeners.get(name)?.delete(handler); },
    dispatch(name, detail = {}) {
      for (const callback of listeners.get(name) ?? []) callback(detail);
    },
    listenerCount(name) { return listeners.get(name)?.size ?? 0; },
  };
}
function setup(rect = {left: 100, top: 50, width: 200, height: 100}) {
  const canvas = Object.assign(eventTarget(), {
    rect: { ...rect },
    getBoundingClientRect() { return this.rect; },
  });
  const win = eventTarget();
  const originalWindow = globalThis.window;
  globalThis.window = win;
  const camera = { id: 'unchanged-camera', zoom: 1, position: {z: 3} };
  const scene = { children: [] };
  const calls = [];
  const service = new GestoreEventiMouse(canvas, camera, scene, {
    onClick: (object, event) => calls.push(['click', object, event]),
    onHoverEnter: object => calls.push(['enter', object]),
    onHoverLeave: object => calls.push(['leave', object]),
  });
  const raycaster = raycasters.at(-1);
  const close = () => {
    service.distruggi();
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  };
  return {canvas, win, camera, scene, service, raycaster, calls, close};
}

test('maps client coordinates into NDC without zoom or extrapolation outside canvas', () => {
  const rect = {left: 100, top: 50, width: 200, height: 100};
  assert.deepEqual(mousePositionToNdc(100, 50, rect), { x: -1, y: 1 });
  assert.deepEqual(mousePositionToNdc(200, 100, rect), { x: 0, y: 0 });
  assert.deepEqual(mousePositionToNdc(300, 150, rect), { x: 1, y: -1 });
  for (const [x,y,r] of [
    [99, 100, rect], [301, 100, rect], [200, 49, rect], [200, 151, rect],
    [NaN, 100, rect], [200, Infinity, rect],
    [200, 100, {...rect,width:0}], [200, 100, {...rect,height:-1}],
    [200, 100, {...rect,left:NaN}],
  ]) assert.equal(mousePositionToNdc(x, y, r), null);
});

test('resize recomputes raycasting from stored screen coordinates instead of reusing NDC', () => {
  const ctx = setup();
  try {
    const body = { name: 'Sun' };
    ctx.raycaster.hits = [body];
    ctx.canvas.dispatch('mousemove', {clientX:200,clientY:100});
    assert.deepEqual(ctx.raycaster.lastPoint, {x:0,y:0,camera:ctx.camera});
    assert.deepEqual(ctx.calls.map(c=>c[0]), ['enter']);
    // No duplicate enter when hovering the same symbol.
    ctx.canvas.dispatch('mousemove', {clientX:200,clientY:100});
    assert.deepEqual(ctx.calls.map(c=>c[0]), ['enter']);

    ctx.canvas.rect = {left:100,top:50,width:400,height:200};
    ctx.win.dispatch('resize');
    assert.deepEqual(ctx.raycaster.lastPoint, {x:-0.5,y:0.5,camera:ctx.camera});
    assert.deepEqual(ctx.calls.map(c=>c[0]), ['enter']);
    assert.equal(ctx.camera.zoom,1);
  } finally { ctx.close(); }
});

test('resize outside canvas clears hover, and pointer returning restores it', () => {
  const ctx = setup();
  try {
    const body = { name: 'AS' };
    ctx.raycaster.hits = [body];
    ctx.canvas.dispatch('mousemove',{clientX:200,clientY:100});
    ctx.canvas.rect = {left:500,top:500,width:150,height:150};
    ctx.win.dispatch('resize');
    assert.deepEqual(ctx.calls.map(c=>c[0]), ['enter','leave']);
    ctx.canvas.dispatch('click',{clientX:200,clientY:100});
    assert.deepEqual(ctx.calls.map(c=>c[0]), ['enter','leave'],
      'A click outside a resized canvas must not pick stale objects');

    ctx.canvas.rect = {left:100,top:50,width:200,height:100};
    ctx.win.dispatch('resize');
    assert.deepEqual(ctx.calls.map(c=>c[0]), ['enter','leave','enter']);
    const evt = { clientX:200,clientY:100 };
    ctx.canvas.dispatch('click',evt);
    assert.equal(ctx.calls.at(-1)[0], 'click');
    assert.equal(ctx.calls.at(-1)[1],body);
    assert.equal(ctx.calls.at(-1)[2],evt);
  } finally { ctx.close(); }
});

test('mouseleave and destruction release hover and all listeners', () => {
  const ctx = setup();
  try {
    const body = { name: 'MC' };
    ctx.raycaster.hits = [body];
    ctx.canvas.dispatch('mousemove',{clientX:200,clientY:100});
    ctx.canvas.dispatch('mouseleave');
    assert.deepEqual(ctx.calls.map(c=>c[0]), ['enter','leave']);
    ctx.win.dispatch('resize');
    assert.deepEqual(ctx.calls.map(c=>c[0]), ['enter','leave'],
      'A detached pointer must not revive hover after resize');

    ctx.canvas.dispatch('mousemove',{clientX:200,clientY:100});
    ctx.service.distruggi();
    assert.deepEqual(ctx.calls.map(c=>c[0]), ['enter','leave','enter','leave']);
    for(const name of ['mousemove','mouseleave','click'])
      assert.equal(ctx.canvas.listenerCount(name),0,name);
    assert.equal(ctx.win.listenerCount('resize'),0);

    ctx.canvas.dispatch('mousemove',{clientX:200,clientY:100});
    ctx.canvas.dispatch('click',{clientX:200,clientY:100});
    ctx.win.dispatch('resize');
    assert.equal(ctx.calls.length,4,'Destroyed handler must not receive events');
  } finally { ctx.close(); }
});
