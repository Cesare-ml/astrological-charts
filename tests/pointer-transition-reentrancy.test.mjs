import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

// Exercise the actual controller arrow properties, not a rewritten mock.
// A synthetic host may dispatch another pointer event synchronously inside
// the leave callback while the first move has temporarily cleared hover.
const source = ts.createSourceFile('planet-interaction.controller.ts',
  readFileSync(new URL('../src/lib/renderers/planet-interaction.controller.ts', import.meta.url), 'utf8'),
  ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
const cls = source.statements.find(node =>
  ts.isClassDeclaration(node) && node.name?.text === 'PlanetInteractionController');
assert.ok(cls, 'interactive controller must exist');
const prop = name => {
  const member = cls.members.find(node =>
    ts.isPropertyDeclaration(node) && node.name.getText(source) === name);
  assert.ok(member?.initializer, 'missing actual pointer handler: ' + name);
  return member.getText(source);
};
const code = ts.transpileModule(`class PointerTransitionProbe {
  disposed=false;
  pointerRevision=0;
  pendingHoverExit:any=null;
  scene:any={};
  sceneRevision=0;
  hovered:any=null;
  pinned:any=null;
  cursor='default';
  canvas={style:{cursor:'default'}};
  visualRevision=0;
  events:string[]=[];
  paints=0;
  renders=0;
  onSend:any=null;
  pick(event:any){return event.ref;}
  send(type:string,ref:any){this.events.push(type+':'+ref.name);this.onSend?.(type,ref);}
  updateVisuals(){this.visualRevision++;this.paints++;}
  requestRender(){this.renders++;}
  ${prop('move')}
  ${prop('leave')}
}`, {compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText;
const samePlanet = (a,b) => a===b || (!!a && !!b && a.layer===b.layer && a.name===b.name);
const Probe = new Function('sameChartPlanet', code + '\nreturn PointerTransitionProbe;')(samePlanet);
const planet = name => ({layer:'natal',name});
const setup = () => {
  const p=new Probe();
  p.hovered=planet('Sun');
  p.canvas.style.cursor='pointer';
  return p;
};

test('pointerleave nested in leave callback cancels stale Moon and restores focus',()=>{
  const p=setup();
  let fired=false;
  p.onSend=type=>{if(type==='leave'&&!fired){fired=true;p.leave();}};
  p.move({ref:planet('Moon')});
  assert.deepEqual(p.events,['leave:Sun'],'stale move cannot emit enter Moon');
  assert.equal(p.hovered,null);
  assert.equal(p.pendingHoverExit,null);
  assert.equal(p.canvas.style.cursor,'default');
  assert.equal(p.pointerRevision,2);
  assert.equal(p.paints,1,'restore underlying pinned/neutral focus exactly once');
  assert.equal(p.renders,1,'only the newest pointer event requests the frame');
  p.move({ref:planet('Venus')});
  assert.deepEqual(p.events,['leave:Sun','enter:Venus']);
  assert.equal(p.hovered.name,'Venus');
});

test('nested pointermove during leave selects only newest Venus without duplicate leave',()=>{
  const p=setup();
  let fired=false;
  p.onSend=type=>{if(type==='leave'&&!fired){fired=true;p.move({ref:planet('Venus')});}};
  p.move({ref:planet('Moon')});
  assert.deepEqual(p.events,['leave:Sun','enter:Venus']);
  assert.equal(p.hovered.name,'Venus');
  assert.equal(p.pendingHoverExit,null);
  assert.equal(p.canvas.style.cursor,'pointer');
  assert.equal(p.paints,1);
  assert.equal(p.renders,1);
});

test('nested empty-canvas move during leave restores neutral focus without repainting twice',()=>{
  const p=setup();
  let fired=false;
  p.onSend=type=>{if(type==='leave'&&!fired){fired=true;p.move({ref:null});}};
  p.move({ref:planet('Moon')});
  assert.deepEqual(p.events,['leave:Sun']);
  assert.equal(p.hovered,null);
  assert.equal(p.canvas.style.cursor,'default');
  assert.equal(p.paints,1);
  assert.equal(p.renders,1);
});

test('redundant pointerleave with no hover neither paints nor emits events',()=>{
  const p=new Probe();
  p.canvas.style.cursor='pointer';
  p.leave();p.leave();
  assert.deepEqual(p.events,[]);
  assert.equal(p.hovered,null);
  assert.equal(p.pointerRevision,2,'even empty leaves invalidate older moves');
  assert.equal(p.canvas.style.cursor,'default');
  assert.equal(p.paints,0);
  assert.equal(p.renders,0);
});

test('valid Sun to Moon transition preserves normal event order and one frame',()=>{
  const p=setup();
  p.move({ref:planet('Moon')});
  assert.deepEqual(p.events,['leave:Sun','enter:Moon']);
  assert.equal(p.hovered.name,'Moon');
  assert.equal(p.pendingHoverExit,null);
  assert.equal(p.paints,1);
  assert.equal(p.renders,1);
});

test('leave nested in enter callback keeps a neutral chart without reentering Moon',()=>{
  const p=new Probe();
  p.onSend=type=>{if(type==='enter')p.leave();};
  p.move({ref:planet('Moon')});
  assert.deepEqual(p.events,['enter:Moon','leave:Moon']);
  assert.equal(p.hovered,null);
  assert.equal(p.canvas.style.cursor,'default');
  assert.equal(p.paints,1);
  assert.equal(p.renders,1);
});

test('a pinned same-body focus survives interrupted hover without geometry churn',()=>{
  const p=setup();
  p.pinned=planet('Sun');
  let fired=false;
  p.onSend=type=>{if(type==='leave'&&!fired){fired=true;p.leave();}};
  p.move({ref:planet('Moon')});
  assert.deepEqual(p.events,['leave:Sun']);
  assert.equal(p.hovered,null);
  assert.equal(p.pinned.name,'Sun');
  assert.equal(p.paints,0,'visible Sun focus remains identical to pinned focus');
  assert.equal(p.renders,0);
});
