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
  const ownerDocument = hasDocument ? new FakeTarget() : null;
  if (ownerDocument) {
    ownerDocument.defaultView = windowTarget;
    ownerDocument.visibilityState = 'visible';
    ownerDocument.focused = true;
    ownerDocument.hasFocus = () => ownerDocument.focused;
    canvas.ownerDocument = ownerDocument;
  }
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
  return {canvas,camera,controller,windowTarget,ownerDocument,events,hover,state};
}

test('window blur clears AS hover, emits one leave and keeps camera unchanged',()=>{
  const p=harness();
  p.hover('AS');
  assert.equal(p.windowTarget.count('blur'),1);
  assert.equal(p.windowTarget.count('focus'),1);
  p.windowTarget.emit('blur');
  assert.deepEqual(p.events,['leave:AS']);
  assert.equal(p.controller.hovered,null);
  assert.equal(p.canvas.style.cursor,'crosshair');
  assert.deepEqual(p.state(),{paints:1,renders:1});
  assert.equal(p.camera.zoom,1);
  assert.equal(p.camera.position.z,3);
  p.controller.destroy();
  assert.equal(p.windowTarget.count('blur'),0);
  assert.equal(p.windowTarget.count('focus'),0);
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

test('hidden document clears hover without requiring window blur, and visible never fabricates enter',()=>{
  const p=harness();
  p.hover('AS');
  assert.equal(p.ownerDocument.count('visibilitychange'),1);
  p.ownerDocument.emit('visibilitychange'); // Still visible.
  assert.deepEqual(p.events,[]);
  p.ownerDocument.visibilityState='hidden';
  p.ownerDocument.emit('visibilitychange');
  p.windowTarget.emit('blur'); // Browsers may deliver both events.
  p.ownerDocument.emit('visibilitychange');
  assert.deepEqual(p.events,['leave:AS']);
  assert.equal(p.controller.hovered,null);
  assert.equal(p.canvas.style.cursor,'crosshair');
  assert.deepEqual(p.state(),{paints:1,renders:1});
  p.ownerDocument.visibilityState='visible';
  p.ownerDocument.emit('visibilitychange');
  assert.deepEqual(p.events,['leave:AS']);
  p.controller.destroy();
  assert.equal(p.ownerDocument.count('visibilitychange'),0);
  assert.equal(p.windowTarget.count('blur'),0);
});

test('hiding a document keeps pinned MC and avoids extra GPU repaint',()=>{
  const p=harness();
  p.hover('MC');
  p.controller.pinned=axis('MC');
  p.ownerDocument.visibilityState='hidden';
  p.ownerDocument.emit('visibilitychange');
  assert.deepEqual(p.events,['leave:MC']);
  assert.deepEqual(p.controller.pinned,{layer:'natal',name:'MC'});
  assert.deepEqual(p.state(),{paints:0,renders:0});
  assert.equal(p.camera.zoom,1);
  p.controller.destroy();
});

test('visibility loss triggered by a leave callback does not starve the final repaint',()=>{
  let once=false;
  let p;
  p=harness(new FakeTarget(),(event)=>{
    if (event.type==='leave' && !once) {
      once=true;
      p.ownerDocument.visibilityState='hidden';
      p.ownerDocument.emit('visibilitychange');
    }
  });
  p.hover('DS');
  p.windowTarget.emit('blur');
  assert.deepEqual(p.events,['leave:DS']);
  assert.deepEqual(p.state(),{paints:1,renders:1});
  p.controller.destroy();
});

test('a detached owner document never registers against an unrelated global window',()=>{
  const p=harness(null);
  assert.equal(p.controller.hostWindow,null);
  assert.equal(p.ownerDocument.count('visibilitychange'),1);
  p.hover('IC');
  p.ownerDocument.visibilityState='hidden';
  p.ownerDocument.emit('visibilitychange');
  assert.deepEqual(p.events,['leave:IC']);
  assert.deepEqual(p.state(),{paints:1,renders:1});
  p.controller.destroy();
  assert.equal(p.ownerDocument.count('visibilitychange'),0);
});

test('visibility loss during enter callback balances leave and cancels stale pointer focus',()=>{
  let p;
  p=harness(new FakeTarget(), event=>{
    if(event.type==='enter') {
      p.ownerDocument.visibilityState='hidden';
      p.ownerDocument.emit('visibilitychange');
    }
  });
  p.controller.scene={};
  p.controller.pick=event=>event.ref;
  p.canvas.emit('pointermove',{ref:axis('MC')});
  assert.deepEqual(p.events,['enter:MC','leave:MC']);
  assert.equal(p.controller.hovered,null);
  assert.deepEqual(p.state(),{paints:1,renders:1});
  p.controller.destroy();
});

test('hidden document ignores stale pointer moves until visibility is restored',()=>{
  const p=harness();
  p.controller.scene={};
  p.controller.pick=event=>event.ref;
  p.ownerDocument.visibilityState='hidden';
  p.ownerDocument.emit('visibilitychange');
  p.canvas.emit('pointermove',{ref:axis('AS')});
  assert.deepEqual(p.events,[],'a hidden tab must not create fresh hover');
  assert.equal(p.controller.hovered,null);
  p.ownerDocument.visibilityState='visible';
  p.ownerDocument.emit('visibilitychange');
  p.canvas.emit('pointermove',{ref:axis('AS')});
  assert.deepEqual(p.events,['enter:AS']);
  assert.equal(p.controller.hovered.name,'AS');
  assert.equal(p.camera.zoom,1);
  p.controller.destroy();
});

test('synthetic clicks on a hidden document cannot select an axis',()=>{
  const p=harness();
  p.controller.scene={};
  p.controller.pick=event=>event.ref;
  p.ownerDocument.visibilityState='hidden';
  p.canvas.emit('click',{ref:axis('DS')});
  assert.deepEqual(p.events,[],'background click must not notify the host');
  p.ownerDocument.visibilityState='visible';
  p.canvas.emit('click',{ref:axis('DS')});
  assert.deepEqual(p.events,['click:DS']);
  p.controller.destroy();
});

test('hidden-document reentrant pointermove cannot revive a retiring glyph',()=>{
  let p;
  p=harness(new FakeTarget(),event=>{
    if(event.type==='leave') {
      p.canvas.emit('pointermove',{ref:axis('IC')});
    }
  });
  p.controller.scene={};
  p.controller.pick=event=>event.ref;
  p.hover('MC');
  p.ownerDocument.visibilityState='hidden';
  p.ownerDocument.emit('visibilitychange');
  assert.deepEqual(p.events,['leave:MC']);
  assert.equal(p.controller.hovered,null);
  assert.deepEqual(p.state(),{paints:1,renders:1});
  p.controller.destroy();
});

test('blurred visible window suppresses hover and click until focus returns',()=>{
  const p=harness();
  p.controller.scene={};
  p.controller.pick=event=>event.ref;
  p.hover('AS');
  p.windowTarget.emit('blur');
  assert.deepEqual(p.events,['leave:AS']);
  assert.equal(p.ownerDocument.visibilityState,'visible');
  p.canvas.emit('pointermove',{ref:axis('IC')});
  p.canvas.emit('click',{ref:axis('IC')});
  assert.deepEqual(p.events,['leave:AS'],'blurred window must not accept synthetic input');
  assert.equal(p.controller.hovered,null);
  p.windowTarget.emit('focus');
  p.canvas.emit('pointermove',{ref:axis('IC')});
  p.canvas.emit('click',{ref:axis('IC')});
  assert.deepEqual(p.events,['leave:AS','enter:IC','click:IC']);
  assert.equal(p.camera.zoom,1);
  p.controller.destroy();
});

test('visibility restored without window focus allows new real pointer input',()=>{
  const p=harness();
  p.controller.scene={};
  p.controller.pick=event=>event.ref;
  p.hover('DS');
  p.ownerDocument.visibilityState='hidden';
  p.ownerDocument.emit('visibilitychange');
  p.canvas.emit('pointermove',{ref:axis('MC')});
  assert.deepEqual(p.events,['leave:DS']);
  p.ownerDocument.visibilityState='visible';
  p.ownerDocument.emit('visibilitychange');
  p.canvas.emit('pointermove',{ref:axis('MC')});
  assert.deepEqual(p.events,['leave:DS','enter:MC']);
  p.controller.destroy();
});

test('focus event while the document is still hidden does not accept pointer input',()=>{
  const p=harness();
  p.controller.scene={};
  p.controller.pick=event=>event.ref;
  p.ownerDocument.visibilityState='hidden';
  p.ownerDocument.emit('visibilitychange');
  p.windowTarget.emit('focus');
  p.canvas.emit('pointermove',{ref:axis('MC')});
  p.canvas.emit('click',{ref:axis('MC')});
  assert.deepEqual(p.events,[]);
  p.ownerDocument.visibilityState='visible';
  p.ownerDocument.emit('visibilitychange');
  p.canvas.emit('pointermove',{ref:axis('MC')});
  assert.deepEqual(p.events,['enter:MC']);
  p.controller.destroy();
});

test('reentrant pointer event during window blur cannot restore retired hover',()=>{
  let p;
  p=harness(new FakeTarget(),event=>{
    if (event.type==='leave') p.canvas.emit('pointermove',{ref:axis('DS')});
  });
  p.controller.scene={};
  p.controller.pick=event=>event.ref;
  p.hover('MC');
  p.windowTarget.emit('blur');
  assert.deepEqual(p.events,['leave:MC']);
  assert.equal(p.controller.hovered,null);
  assert.deepEqual(p.state(),{paints:1,renders:1});
  p.controller.destroy();
  assert.equal(p.windowTarget.count('focus'),0);
});

test('visible tab without document focus does not prematurely re-enable pointer events',()=>{
  const p=harness();
  p.controller.scene={};
  p.controller.pick=event=>event.ref;
  p.hover('AS');
  p.windowTarget.emit('blur');
  p.ownerDocument.visibilityState='hidden';
  p.ownerDocument.focused=false;
  p.ownerDocument.emit('visibilitychange');
  p.ownerDocument.visibilityState='visible';
  p.ownerDocument.emit('visibilitychange');
  p.canvas.emit('pointermove',{ref:axis('DS')});
  p.canvas.emit('click',{ref:axis('DS')});
  assert.deepEqual(p.events,['leave:AS'],
    'visibilityState=visible is not proof that the window regained focus');
  assert.equal(p.controller.windowBlurred,true);
  p.ownerDocument.focused=true;
  p.windowTarget.emit('focus');
  p.canvas.emit('pointermove',{ref:axis('DS')});
  assert.deepEqual(p.events,['leave:AS','enter:DS']);
  p.controller.destroy();
});

test('premature focus while tab remains hidden must not clear the blur latch',()=>{
  const p=harness();
  p.controller.scene={};
  p.controller.pick=event=>event.ref;
  p.windowTarget.emit('blur');
  p.ownerDocument.visibilityState='hidden';
  p.ownerDocument.focused=false;
  p.ownerDocument.emit('visibilitychange');
  p.windowTarget.emit('focus');
  assert.equal(p.controller.windowBlurred,true,
    'focus on a hidden document must not restore interactive state');
  p.ownerDocument.visibilityState='visible';
  p.ownerDocument.emit('visibilitychange');
  p.canvas.emit('pointermove',{ref:axis('IC')});
  assert.deepEqual(p.events,[]);
  p.ownerDocument.focused=true;
  p.windowTarget.emit('focus');
  p.canvas.emit('pointermove',{ref:axis('IC')});
  assert.deepEqual(p.events,['enter:IC']);
  p.controller.destroy();
});
