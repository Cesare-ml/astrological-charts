import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';

// Exercise the actual controller constructor, blur listener and pointerleave
// implementation. No browser, WebGL, Angular, third-party artwork or natal data.
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/lib/renderers/planet-interaction.controller.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions:{
  target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.CommonJS
}}).outputText;

class FakeTarget {
  listeners = new Map();
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  emit(type, value={}) {
    for (const callback of [...(this.listeners.get(type) ?? [])]) callback({...value,type});
  }
  count(type) { return this.listeners.get(type)?.size ?? 0; }
}

const exports = {};
const planetEquals = (a,b) => a===b ||
  (!!a && !!b && a.layer===b.layer && a.name===b.name);
runInNewContext(compiled,{
  exports, module:{exports},
  require(id) {
    if (id==='three') return {
      Raycaster:class {}, Vector2:class {}, Vector3:class {}
    };
    if (id.endsWith('_colori.config')) return {Colori:{elementiCelesti:{}}};
    if (id.endsWith('planet-interaction.geometry')) return {};
    if (id.endsWith('planet-interaction.types')) return {
      sameChartPlanet:planetEquals,
      relatedChartAspects:()=>[],
      snapshotChartAspects:()=>[]
    };
    throw new Error('Unexpected module dependency: '+id);
  }
},{filename:'planet-interaction.controller.ts'});
const {PlanetInteractionController}=exports;
assert.equal(typeof PlanetInteractionController,'function','controller export missing');
const axis = name => ({layer:'natal',name});

function harness(windowTarget = new FakeTarget(), onEvent = null, hasDocument = true) {
  const canvas = new FakeTarget();
  canvas.style={cursor:'crosshair'};
  if (hasDocument) canvas.ownerDocument={defaultView:windowTarget};
  const camera={zoom:1,position:{z:3}};
  const events=[]; let paints=0, renders=0;
  const controller=new PlanetInteractionController(canvas,camera,event=>{
    events.push(event.type+':'+event.planet.name);
    onEvent?.(event,windowTarget,controller);
  },()=>{renders++;});
  // Don't create GPU material overlays in the deterministic lifecycle test.
  controller.updateVisuals=()=>{paints++;};
  const hover=name=>{
    controller.hovered=axis(name);
    canvas.style.cursor='pointer';
  };
  const state=()=>({paints,renders});
  return {canvas,camera,controller,windowTarget,events,hover,state};
}

test('window blur clears AS hover, emits one leave and keeps camera unchanged',()=>{
  const p=harness();
  p.hover('AS');
  assert.equal(p.windowTarget.count('blur'),1);
  p.windowTarget.emit('blur');
  assert.deepEqual(p.events,['leave:AS']);
  assert.equal(p.controller.hovered,null);
  assert.equal(p.canvas.style.cursor,'crosshair');
  assert.deepEqual(p.state(),{paints:1,renders:1});
  assert.equal(p.camera.zoom,1);
  assert.equal(p.camera.position.z,3);
  p.controller.destroy();
  assert.equal(p.windowTarget.count('blur'),0);
});

test('blur preserves a pinned DS and avoids needless repaint/zoom',()=>{
  const p=harness();
  p.hover('DS');
  p.controller.pinned=axis('DS');
  p.windowTarget.emit('blur');
  assert.deepEqual(p.events,['leave:DS']);
  assert.deepEqual(p.controller.pinned,{layer:'natal',name:'DS'});
  assert.deepEqual(p.state(),{paints:0,renders:0});
  assert.equal(p.camera.zoom,1);
  p.controller.destroy();
});

test('duplicate and reentrant window blur never starve the pending leave repaint',()=>{
  let once=false;
  const p=harness(new FakeTarget(),(event,win)=>{
    if (event.type==='leave' && !once) {
      once=true;
      win.emit('blur');
    }
  });
  p.hover('MC');
  p.windowTarget.emit('blur');
  p.windowTarget.emit('blur');
  p.canvas.emit('pointerleave');
  assert.deepEqual(p.events,['leave:MC']);
  assert.deepEqual(p.state(),{paints:1,renders:1});
  assert.equal(p.controller.hovered,null);
  p.controller.destroy();
});

test('owner windows are independent and destroy unregisters only its own blur listener',()=>{
  const aWindow=new FakeTarget(), bWindow=new FakeTarget();
  const a=harness(aWindow), b=harness(bWindow);
  a.hover('AS');
  b.hover('IC');
  aWindow.emit('blur');
  assert.deepEqual(a.events,['leave:AS']);
  assert.deepEqual(b.events,[]);
  a.controller.destroy();
  assert.equal(aWindow.count('blur'),0);
  assert.equal(bWindow.count('blur'),1);
  bWindow.emit('blur');
  assert.deepEqual(b.events,['leave:IC']);
  b.controller.destroy();
  assert.equal(bWindow.count('blur'),0);
});

test('blur during enter callback cancels stale pointer focus and balances leave',()=>{
  const p=harness(new FakeTarget(),(event,win)=>{
    if (event.type==='enter') win.emit('blur');
  });
  p.controller.scene={};
  p.controller.pick=event=>event.ref;
  p.canvas.emit('pointermove',{ref:axis('MC')});
  assert.deepEqual(p.events,['enter:MC','leave:MC']);
  assert.equal(p.controller.hovered,null);
  assert.equal(p.canvas.style.cursor,'crosshair');
  assert.deepEqual(p.state(),{paints:1,renders:1});
  p.controller.destroy();
});

test('controller also works without ownerDocument or global window in Node probes',()=>{
  const p=harness(new FakeTarget(),null,false);
  assert.equal(p.controller.hostWindow,null);
  p.hover('IC');
  p.canvas.emit('pointerleave');
  assert.deepEqual(p.events,['leave:IC']);
  p.controller.destroy();
});
