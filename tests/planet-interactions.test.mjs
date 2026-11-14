import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/renderers/planet-interaction.types.ts', import.meta.url), 'utf8');
const geometrySource = readFileSync(new URL('../src/lib/renderers/planet-interaction.geometry.ts', import.meta.url), 'utf8');
const geometryJs = ts.transpileModule(geometrySource, { compilerOptions: {
  module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022
} }).outputText;
const geometry = await import('data:text/javascript;base64,' + Buffer.from(geometryJs).toString('base64'));
const js = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022
} }).outputText;
const api = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const natalSun = { layer: 'natal', name: 'Sun' };
const transitSun = { layer: 'transit', name: 'Sun' };
const transitSaturn = { layer: 'transit', name: 'Saturn' };
const natalMoon = { layer: 'natal', name: 'Moon' };
const links = [
  { from: natalSun, to: transitSaturn, type: 'quadrato' },
  { from: transitSun, to: natalMoon, type: 'trigono' },
  { from: transitSaturn, to: natalMoon, type: 'sestile' }
];

test('natal/transit identities are distinct and support legacy keys', () => {
  assert.notEqual(api.chartPlanetKey(natalSun), api.chartPlanetKey(transitSun));
  assert.equal(api.sameChartPlanet(natalSun, transitSun), false);
  assert.equal(api.sameChartPlanet(natalSun, { ...natalSun }), true);
  assert.equal(api.isChartPlanetRef({ layer: 'transit', name: 'mean Node' }), true);
  assert.equal(api.isChartPlanetRef({ layer: 'other', name: 'Sun' }), false);
});
test('aspect relationships work from either end without mixing layers', () => {
  assert.deepEqual(api.relatedChartAspects(natalSun, links), [links[0]]);
  assert.deepEqual(api.relatedChartAspects(transitSaturn, links), [links[0], links[2]]);
  assert.deepEqual(api.relatedChartAspects(transitSun, links), [links[1]]);
  assert.deepEqual(api.relatedChartAspects({ layer: 'synastry', name: 'Sun' }, links), []);
});

test('AS, DS, MC and IC are layer-aware aspect endpoints, not planets with invented longitudes', () => {
  const angleNames = ['AS', 'DS', 'MC', 'IC'];
  for (const angle of angleNames) {
    const natalAngle = {layer:'natal', name:angle};
    const transitAngle = {layer:'transit', name:angle};
    const relation = {
      from: {layer:'transit', name:'Mercury'},
      to: natalAngle, type:'semiquadrato', orb:1
    };
    assert.equal(api.isChartPlanetRef(natalAngle), true);
    assert.notEqual(api.chartPlanetKey(natalAngle), api.chartPlanetKey(transitAngle));
    assert.deepEqual(api.relatedChartAspects(natalAngle, [relation]), [relation]);
    assert.deepEqual(api.relatedChartAspects(transitAngle, [relation]), []);
    assert.deepEqual(api.relatedChartAspects(relation.from, [relation]), [relation]);
  }
});

test('shared transit spoke chooses closest orb independent of link order', () => {
  const loose = {from:natalSun, to:transitSaturn, type:'opposizione', orb:4};
  const tight = {from:natalMoon, to:transitSaturn, type:'trigono', orb:0.5};
  const pick = api.preferredTransitConnectorAspect;
  assert.equal(pick(loose,tight), tight);
  assert.equal(pick(tight,loose), tight, 'reordering relations cannot change the spoke');
  assert.equal(pick({...loose,orb:undefined},tight),tight);
  assert.equal(pick({...loose,orb:NaN},tight),tight);
  assert.equal(pick({...loose,orb:Infinity},tight),tight);
  assert.equal(pick({...loose,orb:-0.25},tight).type, 'opposizione',
    'negative/signed orbs should be ranked by absolute angular distance');

  const square = {from:natalMoon,to:transitSaturn,type:'quadrato',orb:2};
  const trine = {from:natalSun,to:transitSaturn,type:'trigono',orb:2};
  assert.equal(pick(square,trine).type, 'quadrato');
  assert.equal(pick(trine,square).type, 'quadrato',
    'ties choose deterministic type, not source list order');
  const unknownA = {...square,orb:undefined};
  const unknownB = {...trine,orb:undefined};
  assert.equal(pick(unknownA,unknownB).type,'quadrato');
  assert.equal(pick(unknownB,unknownA).type,'quadrato');
  const namedA = {from:natalSun,to:transitSaturn,type:'trigono'};
  const namedB = {from:natalMoon,to:transitSaturn,type:'trigono'};
  assert.equal(pick(namedA,namedB),namedB);
  assert.equal(pick(namedB,namedA),namedB);
});

test('central aspect endpoints use exact longitude angles, not shifted glyph centers', () => {
  const start = geometry.chartAspectCirclePoint(0, 1.25);
  assert.deepEqual(start, { x: 0, y: 1.25 });
  assert.equal(Object.is(start.x, -0), false,
    'The top cardinal direction must use +0, not -0 for stable snapshots.');
  const minusZeroStart = geometry.chartAspectCirclePoint(-0, 1.25);
  assert.deepEqual(minusZeroStart, { x: 0, y: 1.25 });
  assert.equal(Object.is(minusZeroStart.x, -0), false);
  const rightAngle = geometry.chartAspectCirclePoint(Math.PI / 2, 2);
  assert.ok(Math.abs(rightAngle.x + 2) < 1e-12);
  assert.ok(Math.abs(rightAngle.y) < 1e-12);
  const negativeAngle = geometry.chartAspectCirclePoint(-Math.PI / 2, 2);
  assert.ok(Math.abs(negativeAngle.x - 2) < 1e-12);
  assert.ok(Math.abs(negativeAngle.y) < 1e-12);
  const south = geometry.chartAspectCirclePoint(Math.PI, 2);
  assert.ok(Math.abs(south.x) < 1e-12);
  assert.ok(Math.abs(south.y + 2) < 1e-12);
  assert.equal(geometry.chartAspectCirclePoint(NaN, 2), null);
  assert.equal(geometry.chartAspectCirclePoint(0, 0), null);
  assert.equal(geometry.chartAspectCirclePoint(0, Infinity), null);
});


test('transit spokes stop before the true outer ring and reject degenerate spans', () => {
  const regular = geometry.chartTransitConnectorRadii(0.5, 1.1);
  assert.ok(regular);
  assert.equal(regular.startRadius, 0.5);
  assert.ok(regular.endRadius > 0.5);
  assert.ok(regular.endRadius < 1.1);
  assert.ok(Math.abs(regular.endRadius - (1.1 - 0.072)) < 1e-12);
  const wide = geometry.chartTransitConnectorRadii(0.5, 3);
  assert.ok(wide);
  assert.ok(Math.abs(wide.endRadius - 2.89) < 1e-12,
    'clearance must be bounded for widely separated rings');
  assert.equal(geometry.chartTransitConnectorRadii(0.5, 0.5), null);
  assert.equal(geometry.chartTransitConnectorRadii(0.5, 0.54), null);
  for (const invalid of [NaN, Infinity, -1, 0]) {
    assert.equal(geometry.chartTransitConnectorRadii(invalid, 2), null);
    assert.equal(geometry.chartTransitConnectorRadii(0.5, invalid), null);
  }
});

test('malformed upstream aspect endpoints never reach interactive glyph lookup', () => {
  // Simulate untyped API payloads without involving ephemeris calculations.
  // A valid selected endpoint is not enough: the opposite endpoint must be
  // well-formed too or updateVisuals would read an invalid planet key.
  const malformed = [
    null,
    {from: natalSun, to: null, type: 'quadrato'},
    {from: undefined, to: natalSun, type: 'quadrato'},
    {from: {layer: 'invalid', name: 'Sun'}, to: natalSun, type: 'quadrato'},
    {from: natalSun, to: {layer:'transit', name:''}, type:'quadrato'},
    links[0],
    links[1],
  ];
  assert.deepEqual(api.relatedChartAspects(natalSun, malformed), [links[0]]);
  assert.deepEqual(api.relatedChartAspects(transitSaturn, malformed), [links[0]]);
  assert.deepEqual(api.relatedChartAspects(transitSun, malformed), [links[1]]);
});


test('aspect snapshots isolate mutating live hosts, callbacks and malformed rows', () => {
  const mutable = {
    from: {...natalSun}, to: {...transitSaturn}, type: 'quadrato', orb: 1.2,
  };
  const input = [mutable, null, {from: natalSun, to:null, type:'quadrato'},
    {from:natalSun, to:transitSaturn, type:''}];
  const stored = api.snapshotChartAspects(input);
  assert.equal(stored.length, 1, 'only valid precomputed aspects are retained');
  assert.notEqual(stored[0], mutable);
  assert.notEqual(stored[0].from, mutable.from);
  assert.notEqual(stored[0].to, mutable.to);
  mutable.from.name = 'Moon';
  mutable.to.name = 'Sun';
  mutable.type = 'opposizione';
  mutable.orb = 8;
  input.push(links[1]);
  assert.deepEqual(api.relatedChartAspects(natalSun, stored), [{
    from: natalSun, to: transitSaturn, type: 'quadrato', orb: 1.2,
  }], 'external mutations must not silently change the active aspect');
  const outbound = api.snapshotChartAspects(api.relatedChartAspects(natalSun, stored));
  outbound[0].from.name = 'Mercury';
  outbound[0].type = 'trigono';
  assert.equal(stored[0].from.name, 'Sun', 'event payload must not corrupt internal state');
  assert.equal(stored[0].type, 'quadrato');
  assert.deepEqual(api.snapshotChartAspects(null), [], 'untyped null API responses are ignored');
});

test('identical aspect snapshots do not require a redraw, but genuine changes do', () => {
  const current = api.snapshotChartAspects([
    {from: natalSun, to: transitSaturn, type:'quadrato', orb:1.25},
    {from: transitSun, to: natalMoon, type:'trigono'}
  ]);
  const copy = api.snapshotChartAspects(current);
  assert.equal(api.sameChartAspects(current, copy), true);
  assert.equal(api.sameChartAspects([], []), true);
  assert.equal(api.sameChartAspects(current, [...copy].reverse()), false);
  assert.equal(api.sameChartAspects(current, copy.slice(0, 1)), false);
  assert.equal(api.sameChartAspects(current, [
    {...copy[0], orb:1.2}, copy[1]
  ]), false, 'orb changes must update the live frontend');
  assert.equal(api.sameChartAspects(current, [
    {...copy[0], type:'opposizione'}, copy[1]
  ]), false, 'aspect type changes must update colored overlays');
  assert.equal(api.sameChartAspects(current, [
    {...copy[0], from:transitSun}, copy[1]
  ]), false, 'layer-aware identity changes must not be ignored');
  assert.equal(api.sameChartAspects(current, [
    {...copy[0], from:copy[0].to, to:copy[0].from}, copy[1]
  ]), false, 'endpoint order changes also update host event payloads');
  assert.equal(api.sameChartAspects(current, [
    {...copy[0], orb: undefined}, copy[1]
  ]), false, 'present-but-undefined orb differs from an actual value');
  assert.equal(api.sameChartAspects(
    [{from:natalSun,to:transitSaturn,type:'quadrato'}],
    [{from:natalSun,to:transitSaturn,type:'quadrato',orb:undefined}]
  ), false, 'preserve optional property shape for typed event consumers');
  assert.equal(api.sameChartAspects(current, [
    {...copy[0], debugNote:'changed-by-host'},copy[1]
  ]), false, 'unknown host metadata disables the optimization');
  assert.equal(api.sameChartAspects(current, [
    {...copy[0],from:{...natalSun,source:'custom'}},copy[1]
  ]), false, 'unknown endpoint metadata must also force an update');
  assert.equal(api.sameChartAspects(current, [
    {...copy[0],to:null},copy[1]
  ]), false, 'malformed endpoints never match a valid snapshot');
});


test('repeated programmatic focus and unchanged natal palette avoid repainting', () => {
  // Extract the actual controller methods without requiring a browser/WebGL
  // constructor. The only dependencies are the real public identity helpers.
  const controllerSource = ts.createSourceFile('planet-interaction.controller.ts',
    readFileSync(new URL('../src/lib/renderers/planet-interaction.controller.ts', import.meta.url), 'utf8'),
    ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const declaration = controllerSource.statements.find(node =>
    ts.isClassDeclaration(node) && node.name?.text === 'PlanetInteractionController');
  assert.ok(declaration, 'interactive controller class is present');
  const methods = ['highlight', 'setNatalAspectPresentation'].map(name => {
    const method = declaration.members.find(node =>
      ts.isMethodDeclaration(node) && node.name.getText(controllerSource) === name);
    assert.ok(method?.body, name + ' method is present');
    return method.getText(controllerSource);
  });
  const code = ts.transpileModule(`class FocusProbe {
    pinned: any = null;
    scene: any = {};
    natalAspectPresentation = 'all';
    visualUpdates = 0;
    renderRequests = 0;
    updateVisuals(): void { this.visualUpdates++; }
    requestRender(): void { this.renderRequests++; }
    ${methods.join('\n')}
  }`, {compilerOptions: {module:ts.ModuleKind.None, target:ts.ScriptTarget.ES2022}}).outputText;
  const Probe = new Function('sameChartPlanet', 'isChartPlanetRef',
    code + '\nreturn FocusProbe;')(api.sameChartPlanet, api.isChartPlanetRef);
  const probe = new Probe();
  const checks = [];
  const record = () => checks.push([probe.visualUpdates, probe.renderRequests]);
  probe.highlight(natalSun); record();
  probe.highlight({...natalSun}); record();
  probe.highlight(transitSun); record();
  probe.highlight({layer:'invalid',name:'Sun'}); record();
  probe.highlight(null); record();
  probe.setNatalAspectPresentation('focused'); record();
  probe.setNatalAspectPresentation('focused'); record();
  probe.setNatalAspectPresentation('muted'); record();
  probe.scene = null;
  probe.highlight(natalMoon); record();
  assert.deepEqual(checks, [
    [1,1], [1,1], [2,2], [3,3], [3,3],
    [4,4], [4,4], [5,5], [6,5],
  ], 'identical selections/modes must never schedule duplicate renders');
});

test('focus uses independent material clones, with safe transfer and disposal', () => {
  const src = ts.createSourceFile('planet-interaction.controller.ts',
    readFileSync(new URL('../src/lib/renderers/planet-interaction.controller.ts', import.meta.url), 'utf8'),
    ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
  const cls = src.statements.find(stmt =>
    ts.isClassDeclaration(stmt) && stmt.name?.text==='PlanetInteractionController');
  assert.ok(cls);
  const method = name => {
    const m = cls.members.find(member =>
      ts.isMethodDeclaration(member) && member.name.getText(src)===name);
    assert.ok(m?.body,'controller method missing: '+name);
    return m.getText(src);
  };
  const code = ts.transpileModule(`class MaterialFocusProbe {
    glyphMaterialOverrides = new Map<any,any>();
    natalLineColors = new Map<any,any>();
    natalFocusOverlays: any[] = [];
    lines: any[] = [];
    transitGuides = new Map<any,any>();
    ${method('tintGlyph')}
    ${method('clearVisuals')}
  }`,{compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText;
  const Probe = new Function('focusMaterialOrigins',
    code+'\nreturn MaterialFocusProbe;')(new WeakMap());
  const texture = {};
  const material = value => ({
    color: {
      value,
      set(next) {this.value=next;}
    },
    map:texture,
    disposed:0,
    clone() {return material(this.color.value);},
    dispose() {this.disposed++;}
  });
  const shared = material('#171717');
  const a = new Probe();
  const b = new Probe();
  const sun = {material:[shared,shared]};
  const moon = {material:shared};
  const moved = {material:shared};
  a.tintGlyph(sun,'#ff0000');
  const sunCopies = sun.material;
  assert.ok(Array.isArray(sunCopies));
  assert.equal(sunCopies.length,2);
  assert.notEqual(sunCopies[0],sunCopies[1]);
  assert.ok(sunCopies.every(copy=>copy!==shared && copy.map===texture &&
    copy.color.value==='#ff0000'));
  assert.equal(shared.color.value,'#171717',
    'tinting A may never alter the base material shared with B');
  b.tintGlyph(moon,'#c0c0c0');
  assert.equal(moon.material.color.value,'#c0c0c0');
  assert.equal(sunCopies[0].color.value,'#ff0000');
  assert.notEqual(sunCopies[0],moon.material);
  a.tintGlyph(moved,'#9e02ff');
  const sourceCopy=moved.material;
  b.tintGlyph(moved,'#0055ff'); // transferred without notifying A
  const destinationCopy=moved.material;
  assert.notEqual(sourceCopy,destinationCopy);
  assert.equal(destinationCopy.map,texture);
  assert.equal(destinationCopy.color.value,'#0055ff');
  a.clearVisuals();
  assert.equal(moved.material,destinationCopy,
    'old controller cannot overwrite the new controller focus');
  assert.equal(sourceCopy.disposed,1);
  assert.deepEqual(sun.material,[shared,shared]);
  assert.ok(sunCopies.every(copy=>copy.disposed===1));
  assert.equal(destinationCopy.disposed,0);
  assert.equal(shared.disposed,0);
  b.clearVisuals();
  assert.equal(moved.material,shared,
    'destination must restore the base, never a disposed source clone');
  assert.equal(moon.material,shared);
  assert.equal(destinationCopy.disposed,1);
  assert.equal(shared.color.value,'#171717');
  assert.equal(shared.disposed,0);

  // A host can replace just one material array slot while focused.
  // Clearing this controller must restore only the slot still owned by
  // its focus clone and must not overwrite the new host material.
  const external = material('#123456');
  const mixed = {material:[shared,shared]};
  a.tintGlyph(mixed,'#ff0000');
  const mixedCopies = mixed.material;
  mixed.material=[mixedCopies[0],external];
  a.clearVisuals();
  assert.equal(mixed.material[0],shared);
  assert.equal(mixed.material[1],external);
  assert.ok(mixedCopies.every(copy=>copy.disposed===1));
  assert.equal(external.disposed,0);

  // A host may collapse a material ARRAY to a single currently focused
  // slot. Teardown must not leave that clone attached after disposing it.
  const collapsed = {material:[shared,shared]};
  a.tintGlyph(collapsed,'#ff0000');
  const collapsedCopies = collapsed.material;
  collapsed.material = collapsedCopies[1];
  a.clearVisuals();
  assert.equal(collapsed.material,shared,
    'array-to-single host replacement must restore the surviving clone');
  assert.ok(collapsedCopies.every(copy=>copy.disposed===1));
  assert.equal(shared.disposed,0);

  // The inverse change is also legal: a host can wrap an existing focused
  // material in a new array containing external materials.
  const expanded = {material:shared};
  a.tintGlyph(expanded,'#ff0000');
  const expandedCopy = expanded.material;
  expanded.material = [external,expandedCopy];
  a.clearVisuals();
  assert.deepEqual(expanded.material,[external,shared],
    'single-to-array changes must preserve host material order');
  assert.equal(expandedCopy.disposed,1);
  assert.equal(external.disposed,0);

  // Reordering active clone slots must not restore by their OLD indexes:
  // every clone retains its own baseline, independent of array position.
  const firstBase = material('#345678');
  const secondBase = material('#abcdef');
  const reordered = {material:[firstBase,secondBase]};
  a.tintGlyph(reordered,'#ff0000');
  const reorderedCopies = reordered.material;
  reordered.material = [reorderedCopies[1],external,reorderedCopies[0]];
  a.clearVisuals();
  assert.deepEqual(reordered.material,[secondBase,external,firstBase]);
  assert.ok(reorderedCopies.every(copy=>copy.disposed===1));
  assert.equal(firstBase.disposed,0);
  assert.equal(secondBase.disposed,0);
  assert.equal(external.disposed,0);

  const nonTintable={disposed:0,clone(){throw Error('should not clone')},
    dispose(){this.disposed++}};
  const mesh={material:nonTintable};
  a.tintGlyph(mesh,'#ff0000');
  a.clearVisuals();
  assert.equal(mesh.material,nonTintable);
  assert.equal(nonTintable.disposed,0);
});

test('active aspect endpoints skip glyphs transferred outside the source chart', () => {
  const src = ts.createSourceFile('planet-interaction.controller.ts',
    readFileSync(new URL('../src/lib/renderers/planet-interaction.controller.ts', import.meta.url), 'utf8'),
    ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
  const declaration = src.statements.find(stmt =>
    ts.isClassDeclaration(stmt) && stmt.name?.text==='PlanetInteractionController');
  assert.ok(declaration);
  const method = name => {
    const found = declaration.members.find(member =>
      ts.isMethodDeclaration(member) && member.name.getText(src)===name);
    assert.ok(found?.body,name+' must be present');
    return found.getText(src);
  };
  const code = ts.transpileModule(`class EndpointProbe {
    scene: any;
    glyphs = new Map<string,any[]>();
    constructor(scene: any) { this.scene=scene; }
    ${method('ownsGlyph')}
    ${method('activeGlyph')}
  }`,{compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText;
  const Probe = new Function('chartPlanetKey',
    code+'\nreturn EndpointProbe;')(api.chartPlanetKey);
  const sourceScene={parent:null};
  const destinationScene={parent:null};
  const sourceRoot={parent:sourceScene};
  const destinationRoot={parent:destinationScene};
  const moved={parent:destinationRoot};
  const remaining={parent:sourceRoot};
  const ref={layer:'transit',name:'Saturn'};
  const probe=new Probe(sourceScene);
  probe.glyphs.set('transit:Saturn',[moved,remaining]);
  assert.equal(probe.ownsGlyph(moved),false);
  assert.equal(probe.ownsGlyph(remaining),true);
  assert.equal(probe.activeGlyph(ref),remaining,
    'pick the still-attached duplicate, not the first stale cached mesh');
  remaining.parent=null;
  assert.equal(probe.activeGlyph(ref),undefined,
    'a chart with no still-owned partner must not render stale aspect endpoints');
  moved.parent=sourceRoot;
  assert.equal(probe.activeGlyph(ref),moved,
    'reattaching restores the already indexed glyph');
  moved.parent=destinationRoot;
  probe.scene=destinationScene;
  assert.equal(probe.activeGlyph(ref),moved,
    'destination controller can select its own transferred glyph');
});

test('nested identical native natal aspect tags index one foreground root', () => {
  const text = readFileSync(new URL('../src/lib/renderers/planet-interaction.controller.ts',import.meta.url),'utf8');
  const parsed = ts.createSourceFile('planet-interaction.controller.ts',
    text,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
  const klass = parsed.statements.find(item => ts.isClassDeclaration(item) &&
    item.name?.text==='PlanetInteractionController');
  assert.ok(klass);
  const setScene = klass.members.find(item => ts.isMethodDeclaration(item) &&
    item.name.getText(parsed)==='setScene');
  assert.ok(setScene?.body);
  const js = ts.transpileModule(`class AspectTagProbe {
    disposed=false;
    sceneRevision=0;
    hovered=null;
    canvas={style:{cursor:''}};
    cursor='';
    scene=null;
    glyphs=new Map();
    pickTargets=[];
    natalAspectTags=[];
    aspectRing=null;
    paints=0;
    clearVisuals(){}
    updateVisuals(){this.paints++;}
    send(){}
    ${setScene.getText(parsed)}
  }`,{compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText;
  const Probe = new Function('THREE','isChartPlanetRef','chartPlanetKey',
    js+'\nreturn AspectTagProbe;')({Mesh:class Mesh{}},()=>false,()=>'');

  class Node {
    constructor(tag=null) {
      this.userData=tag?{chartNatalAspect:tag}:{};
      this.parent=null;
      this.children=[];
    }
    add(node) {node.parent=this;this.children.push(node);return node;}
    traverse(callback){callback(this);for(const node of this.children)node.traverse(callback);}
  }
  const tag=(from,to,type='quadrato')=>({from,to,type});
  const scene = new Node();
  const wheel = scene.add(new Node());
  wheel.userData.chartAspectRadius=0.5;
  const sunMoon=wheel.add(new Node(tag('Sun','Moon')));
  const sunMC=wheel.add(new Node(tag('Sun','MC')));
  const venusMars=wheel.add(new Node(tag('Venus','Mars')));
  sunMoon.add(new Node(tag('Sun','Moon')));
  sunMC.add(new Node(tag('Sun','MC'))).add(new Node(tag('Sun','MC')));
  venusMars.add(new Node(tag('Venus','Mars')));
  const different=wheel.add(new Node(tag('Moon','Venus')));
  const distinctChild=different.add(new Node(tag('Moon','Mars')));
  wheel.add(new Node({from:12,to:'Moon',type:'quadrato'}));

  const controller=new Probe();
  controller.setScene(scene);
  assert.deepEqual(controller.natalAspectTags.map(entry=>entry.root),
    [sunMoon,sunMC,venusMars,different,distinctChild],
    'only redundant nested tags are removed; independent aspects stay indexed');
  assert.equal(controller.aspectRing.root,wheel);
  assert.equal(controller.aspectRing.radius,0.5);
  assert.equal(controller.paints,1);
  controller.setScene(null);
  assert.equal(controller.natalAspectTags.length,0,
    'scene teardown cannot retain a stale native aspect tag');
});

test('cached picking respects current scene ancestry when glyphs are moved', () => {
  const controllerSource = ts.createSourceFile('planet-interaction.controller.ts',
    readFileSync(new URL('../src/lib/renderers/planet-interaction.controller.ts', import.meta.url), 'utf8'),
    ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const declaration = controllerSource.statements.find(statement =>
    ts.isClassDeclaration(statement) && statement.name?.text === 'PlanetInteractionController');
  assert.ok(declaration);
  const member = declaration.members.find(node =>
    ts.isMethodDeclaration(node) &&
    node.name.getText(controllerSource) === 'visiblePlanetHit');
  assert.ok(member?.body, 'private hit filter must exist');
  const code = ts.transpileModule(`class HitProbe {
    scene: any;
    constructor(scene: any) { this.scene = scene; }
    ${member.getText(controllerSource)}
  }`, {compilerOptions: {module:ts.ModuleKind.None, target:ts.ScriptTarget.ES2022}}).outputText;
  const Probe = new Function(code + '\nreturn HitProbe;')();

  const scene = {visible:true, parent:null};
  const otherScene = {visible:true, parent:null};
  const group = {visible:true, parent:scene};
  const mesh = {visible:true, parent:group, material:{visible:true}};
  const hit = {object:mesh};
  const probe = new Probe(scene);
  assert.equal(probe.visiblePlanetHit(hit),true, 'attached visible glyph can be picked');
  mesh.parent = null;
  assert.equal(probe.visiblePlanetHit(hit),false, 'detached glyph remains cached but cannot be selected');
  mesh.parent = otherScene;
  assert.equal(probe.visiblePlanetHit(hit),false, 'glyph in another chart must not receive this canvas pointer');
  mesh.parent = group;
  assert.equal(probe.visiblePlanetHit(hit),true, 'reattaching to original group restores hit without reindex');
  group.visible = false;
  assert.equal(probe.visiblePlanetHit(hit),false, 'hidden ancestor prevents hits');
  group.visible = true;
  mesh.material.visible = false;
  assert.equal(probe.visiblePlanetHit(hit),false, 'hidden material prevents hits');
  mesh.material.visible = true;
  assert.equal(probe.visiblePlanetHit(hit),true, 'restoring material visibility restores hit');

  // Three.js multi-material mesh faces carry a materialIndex. A raycast hit
  // on an invisible submesh must NEVER be accepted merely because a different
  // triangle group has a visible material.
  const hidden = {visible:false};
  const shown = {visible:true};
  mesh.material = [hidden, shown];
  hit.face = {materialIndex:0};
  assert.equal(probe.visiblePlanetHit(hit),false,
    'invisible triangle group must not be picked');
  hit.face.materialIndex = 1;
  assert.equal(probe.visiblePlanetHit(hit),true,
    'the visible group of the same glyph remains pickable');
  mesh.material[1].visible = false;
  assert.equal(probe.visiblePlanetHit(hit),false,
    'visibility changes are checked on every pointer event');
  mesh.material[1].visible = true;

  for (const index of [-1, 2, 0.5, Number.NaN, Number.POSITIVE_INFINITY, '1']) {
    hit.face = {materialIndex:index};
    assert.equal(probe.visiblePlanetHit(hit),false,
      'invalid/ambiguous material index must fail closed: '+String(index));
  }
  hit.face = undefined;
  assert.equal(probe.visiblePlanetHit(hit),false,
    'missing raycast face cannot inherit visibility of another triangle group');
  hit.face = {materialIndex:0};
  mesh.material = [null, shown];
  assert.equal(probe.visiblePlanetHit(hit),false,
    'a missing material slot must not throw or match');
  hit.face.materialIndex = 1;
  assert.equal(probe.visiblePlanetHit(hit),true,
    'the valid material slot remains pickable');
  mesh.material = [];
  assert.equal(probe.visiblePlanetHit(hit),false,
    'an empty material list is never pickable');
  mesh.material = {visible:true};
  hit.face = undefined;
  assert.equal(probe.visiblePlanetHit(hit),true,
    'single-material picking remains backwards compatible');
});

test('hover-to-pin callback paints once and preserves deferred button focus', () => {
  const controllerSource = ts.createSourceFile('planet-interaction.controller.ts',
    readFileSync(new URL('../src/lib/renderers/planet-interaction.controller.ts', import.meta.url), 'utf8'),
    ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const cls = controllerSource.statements.find(node =>
    ts.isClassDeclaration(node) && node.name?.text === 'PlanetInteractionController');
  assert.ok(cls);
  const member = name => {
    const found = cls.members.find(node => node.name?.getText(controllerSource) === name);
    assert.ok(found, 'controller member missing: ' + name);
    return found.getText(controllerSource);
  };
  const code = ts.transpileModule(`class PointerPinProbe {
    disposed = false;
    scene: any = {};
    sceneRevision = 1;
    visualRevision = 0;
    pinned: any = null;
    hovered: any = null;
    canvas: any = {style: {cursor:''}};
    cursor = '';
    events: string[] = [];
    redraws = 0;
    paints = 0;
    pick(event: any): any { return event.planet; }
    send(type: string, planet: any): void {
      this.events.push(type + ':' + planet.layer + ':' + planet.name);
      if (type === 'enter') this.highlight(planet);
    }
    updateVisuals(): void { this.visualRevision++; this.paints++; }
    requestRender(): void { this.redraws++; }
    ${member('highlight')}
    ${member('move')}
    ${member('leave')}
  }`, {compilerOptions: {module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText;
  const Probe = new Function('sameChartPlanet','isChartPlanetRef',
    code + '\nreturn PointerPinProbe;')(api.sameChartPlanet,api.isChartPlanetRef);
  const probe = new Probe();
  probe.move({planet:natalSun});
  assert.deepEqual([probe.paints,probe.redraws], [1,1],
    'first hover paints even though synchronous enter callback pins the planet');
  probe.move({planet:natalSun});
  assert.deepEqual([probe.paints,probe.events.length], [1,1],
    'duplicate pointermove does not repaint or emit another enter');
  probe.move({planet:transitSaturn});
  assert.deepEqual([probe.paints,probe.redraws], [2,2],
    'new hover repaints exactly once, not twice during the pin callback');
  assert.deepEqual(probe.events,[
    'enter:natal:Sun','leave:natal:Sun','enter:transit:Saturn'
  ]);
  probe.leave();
  for(let i=0;i<20;i++) {probe.move({planet:transitSaturn});probe.leave();}
  assert.deepEqual([probe.paints,probe.redraws,probe.events.length],[2,2,44],
    'repeating an already pinned hover must not allocate graphics');
  probe.move({planet:transitSaturn});
  probe.highlight(natalSun);
  assert.equal(probe.paints,2,
    'a button changing the pinned body during hover must defer drawing');
  probe.leave();
  assert.deepEqual([probe.paints,probe.redraws],[3,3],
    'pointer leave restores the pinned button selection exactly once');
  assert.equal(probe.pinned.name,'Sun');

  // A pointermove from the selected Saturn glyph into empty space *within*
  // the canvas emits leave, not pointerleave. It must preserve the existing
  // focus overlay just like leaving the entire canvas.
  probe.move({planet:transitSaturn});
  const beforeBlank = [probe.paints,probe.redraws,probe.events.length];
  probe.move({planet:null});
  assert.deepEqual([probe.paints,probe.redraws,probe.events.length],
    [beforeBlank[0],beforeBlank[1],beforeBlank[2]+1],
    'in-canvas empty space must emit leave without redrawing unchanged pin');

  // When a button selected a DIFFERENT planet while Saturn was hovered,
  // entering blank space must restore that pin exactly once.
  probe.move({planet:transitSaturn});
  probe.highlight(natalSun);
  const beforeDifferentPin = probe.paints;
  probe.move({planet:null});
  assert.deepEqual([probe.paints,probe.redraws],
    [beforeDifferentPin+1,beforeDifferentPin+1],
    'in-canvas empty space restores a different pinned selection');
});

test('off-focus transit updates do not invalidate the displayed aspects', () => {
  const sunLink = {from:{...natalSun},to:{...transitSaturn},type:'quadrato',orb:1};
  const moonLink = {from:{...natalMoon},to:{...transitSun},type:'sestile',orb:1.5};
  const newerMoonLink = {...moonLink,orb:2.75};
  const before = api.snapshotChartAspects([sunLink, moonLink]);
  const after = api.snapshotChartAspects([sunLink, newerMoonLink]);
  assert.equal(api.sameChartAspects(before,after),false,'store changed host payload');
  assert.equal(api.sameChartAspects(
    api.relatedChartAspects(natalSun,before),
    api.relatedChartAspects(natalSun,after)
  ),true,'natal Sun visual links are unchanged');
  assert.equal(api.sameChartAspects(
    api.relatedChartAspects(natalMoon,before),
    api.relatedChartAspects(natalMoon,after)
  ),false,'new Moon selection must see the new orb');
  assert.deepEqual(api.relatedChartAspects(natalMoon,after),[newerMoonLink]);
  assert.equal(api.sameChartAspects([],[]),true,'no active focus paints no links');
});


test('orb-only transit updates repaint only when the selected guide color changes', () => {
  const square = {from:natalSun,to:transitSaturn,type:'quadrato',orb:0.5};
  const trine = {from:natalMoon,to:transitSaturn,type:'trigono',orb:1.5};
  const initial = api.snapshotChartAspects([square]);
  const newOrb = api.snapshotChartAspects([{...square,orb:2.5}]);
  assert.equal(api.sameChartAspects(initial,newOrb),false);
  assert.equal(api.sameChartAspectVisuals(initial,newOrb),true,
    'one link retains the same geometry and transit guide tint');
  assert.equal(api.sameChartAspectVisuals(initial,[
    {...square,orb:undefined}
  ]),true,'optional orb absence does not affect a sole guide');
  assert.equal(api.sameChartAspectVisuals(initial,[
    {...square,type:'trigono'}
  ]),false,'central line color/guide color changes');
  assert.equal(api.sameChartAspectVisuals(initial,[
    {...square,to:transitSun}
  ]),false,'a changed transit endpoint is a new radial line');
  assert.equal(api.sameChartAspectVisuals(initial,[
    {...square,customDisplayFlag:true}
  ]),false,'unknown host metadata forces conservative visual refresh');
  const pair = api.snapshotChartAspects([square,trine]);
  assert.equal(api.sameChartAspectVisuals(pair,[
    {...square,orb:0.75},{...trine,orb:1.25}
  ]),true,'tightest orb stays quadrato: the Saturn guide is unchanged');
  assert.equal(api.sameChartAspectVisuals(pair,[
    {...square,orb:2},{...trine,orb:0.3}
  ]),false,'tightest orb switched to trigono: repaint dashed Saturn guide');
  assert.equal(api.sameChartAspectVisuals(pair,[
    {...square,orb:2},{...trine,orb:2}
  ]),true,'equal orbs preserve the quadrato winner by the stable type-key tie-break');
  assert.equal(api.sameChartAspectVisuals([
    {...square,orb:2},{...trine,orb:0.1}
  ],[
    {...square,orb:2},{...trine,orb:2}
  ]),false,'a tie can change the winner from trigono to quadrato');
  assert.equal(api.sameChartAspectVisuals(pair,[
    {...square,orb:0.5},{...trine,orb:1.5,customMetadata:1}
  ]),false,'unknown metadata never bypasses visual work');
  assert.equal(api.sameChartAspectVisuals(initial,[
    square,{...square,orb:1}
  ]),false,'a newly duplicated link still uses the safe redraw path');
  assert.equal(api.sameChartAspectVisuals(
    [square,{...square,orb:2}],[square,{...square,orb:3}]
  ),false,'existing duplicated central lines disable the optimization');
  assert.equal(api.sameChartAspectVisuals([],[]),true);
});


test('pinned focus emits detail updates without needless orb-only WebGL repaint', () => {
  // Execute the exact setRelations TypeScript method with lightweight host stubs.
  const ast = ts.createSourceFile('planet-interaction.controller.ts',
    readFileSync(new URL('../src/lib/renderers/planet-interaction.controller.ts', import.meta.url), 'utf8'),
    ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const cls = ast.statements.find(node =>
    ts.isClassDeclaration(node) && node.name?.text === 'PlanetInteractionController');
  const method = cls?.members.find(node =>
    ts.isMethodDeclaration(node) && node.name.getText(ast) === 'setRelations');
  assert.ok(method?.body, 'setRelations is present on the actual controller');
  const code = ts.transpileModule(`class RelationProbe {
    relations: any[] = [];
    hovered: any = null;
    pinned: any = null;
    scene: any = {};
    sceneRevision = 1;
    events: any[] = [];
    visuals = 0;
    renders = 0;
    updateVisuals(): void { this.visuals++; }
    requestRender(): void { this.renders++; }
    send(type: string, planet: any): void {
      this.events.push({type, planet, aspects: relatedChartAspects(planet, this.relations)});
    }
    ${method.getText(ast)}
  }`, {compilerOptions: {module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022}}).outputText;
  const Probe = new Function('snapshotChartAspects', 'sameChartAspects',
    'sameChartAspectVisuals', 'relatedChartAspects', code + '\nreturn RelationProbe;')(
      api.snapshotChartAspects, api.sameChartAspects,
      api.sameChartAspectVisuals, api.relatedChartAspects);
  const probe = new Probe();
  probe.pinned = {...transitSaturn};
  const selected = {from: {...natalSun}, to: {...transitSaturn}, type: 'quadrato', orb: 1};
  const unrelated = {from: {...transitSun}, to: {...natalMoon}, type: 'trigono', orb: 1};
  probe.setRelations([selected, unrelated]);
  assert.equal(probe.events.length, 1);
  assert.equal(probe.events[0].type, 'update');
  assert.equal(probe.events[0].planet.layer, 'transit');
  assert.equal(probe.events[0].aspects.length, 1);
  const baseline = [probe.events.length, probe.visuals, probe.renders];
  probe.setRelations([{...selected, from: {...natalSun}, to: {...transitSaturn}}, {...unrelated}]);
  assert.deepEqual([probe.events.length, probe.visuals, probe.renders], baseline,
    'identical links must not generate a redundant update');
  probe.setRelations([selected, {...unrelated, orb: 2}]);
  assert.deepEqual([probe.events.length, probe.visuals, probe.renders], baseline,
    'off-focus link changes must not update the pinned transit');
  probe.setRelations([{...selected, orb: 2}, {...unrelated, orb: 2}]);
  assert.equal(probe.events.at(-1)?.type, 'update');
  assert.equal(probe.events.at(-1)?.aspects[0].orb, 2);
  assert.equal(probe.events.length, 2);
  assert.equal(probe.visuals, baseline[1],
    'orb-only change with same guide color should not allocate new overlays');
  assert.equal(probe.renders, baseline[2],
    'orb-only detail change should not request an extra frame');
  probe.setRelations([{...unrelated, orb: 2}]);
  assert.equal(probe.events.at(-1)?.type, 'update');
  assert.deepEqual(probe.events.at(-1)?.aspects, [],
    'a pinned selection must learn when its last relation disappears');
  assert.equal(probe.events.length, 3);
  assert.equal(probe.visuals, baseline[1] + 1);
  assert.equal(probe.renders, baseline[2] + 1);
  probe.pinned = null;
  const countWithoutFocus = probe.events.length;
  probe.setRelations([selected, unrelated]);
  assert.equal(probe.events.length, countWithoutFocus,
    'no active focus means no fabricated detail event');
});


test('aspect structure equality permits in-place guide tint but not changed links', () => {
  const a = {from:natalSun,to:transitSaturn,type:'quadrato',orb:0.25};
  const b = {from:natalMoon,to:transitSaturn,type:'trigono',orb:1.25};
  assert.equal(api.sameChartAspectStructure([a,b],[
    {...a,orb:2.5},{...b,orb:0.1}
  ]),true,'a guide winner can change without moving either line');
  assert.equal(api.sameChartAspectStructure([a],[
    {...a,orb:undefined}
  ]),true,'optional orb presence is display metadata');
  assert.equal(api.sameChartAspectStructure([a],[{...a,type:'sestile'}]),false);
  assert.equal(api.sameChartAspectStructure([a],[{...a,from:transitSun}]),false);
  assert.equal(api.sameChartAspectStructure([a,b],[b,a]),false,'ordered line identity is preserved');
  assert.equal(api.sameChartAspectStructure([a],[{...a,debugColor:'#fff'}]),false,
    'custom host data requires a conservative full redraw');
  assert.equal(api.sameChartAspectStructure([a],[{...a,from:{...natalSun,localX:3}}]),false);
  assert.equal(api.sameChartAspectStructure([a],[]),false);
});


test('reentrant dispose cannot erase newer scene or dispose owned focus resources twice',()=>{
  const controllerSource=ts.createSourceFile('planet-interaction.controller.ts',
    readFileSync(new URL('../src/lib/renderers/planet-interaction.controller.ts',import.meta.url),'utf8'),
    ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
  const declaration=controllerSource.statements.find(node=>
    ts.isClassDeclaration(node)&&node.name?.text==='PlanetInteractionController');
  assert.ok(declaration);
  const methods=['setScene','clearVisuals'].map(name=>{
    const member=declaration.members.find(node=>
      ts.isMethodDeclaration(node)&&node.name.getText(controllerSource)===name);
    assert.ok(member?.body,name);
    return member.getText(controllerSource);
  });
  const compiled=ts.transpileModule(`class SceneProbe {
    disposed=false;
    sceneRevision=0;
    scene:any=null;
    hovered:any=null;
    cursor='';
    canvas={style:{cursor:''}};
    glyphs=new Map();
    pickTargets:any[]=[];
    natalAspectTags:any[]=[];
    aspectRing:any=null;
    glyphMaterialOverrides=new Map();
    natalLineColors=new Map();
    natalFocusOverlays:any[]=[];
    lines:any[]=[];
    transitGuides=new Map();
    paints=0;
    updateVisuals(){this.paints++;}
    send(){}
    ${methods.join('\n')}
  }`,{compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText;
  class MockMesh {
    constructor(name){this.userData={chartPlanet:{layer:'natal',name}};this.material={};}
  }
  const Probe=new Function('THREE','isChartPlanetRef','chartPlanetKey',
    compiled+'\nreturn SceneProbe;')(
    {Mesh:MockMesh},api.isChartPlanetRef,api.chartPlanetKey);
  const mkScene=name=>{
    const mesh=new MockMesh(name);
    const scene={userData:{},name,mesh,traverse(cb){cb(scene);cb(mesh);}};
    return scene;
  };
  for(const mode of ['material','line-geometry']){
    const probe=new Probe();
    const old=mkScene('Old'),latest=mkScene('New'),stale=mkScene('Stale');
    const oldMesh=old.mesh;
    const baseline={disposed:0,dispose(){this.disposed++;}};
    let materialDisposals=0,geometryDisposals=0,callbackCount=0;
    const focusCopy={dispose(){
      materialDisposals++;
      if(mode==='material'&&++callbackCount===1)probe.setScene(latest);
    }};
    const geometry={dispose(){
      geometryDisposals++;
      if(mode==='line-geometry'&&++callbackCount===1)probe.setScene(latest);
    }};
    const foreground={material:{dispose(){}},geometry,parent:{remove(){}}};
    probe.scene=old;
    oldMesh.material=focusCopy;
    probe.glyphMaterialOverrides.set(oldMesh,{original:baseline,focused:focusCopy});
    probe.lines=[{geometry,material:{dispose(){}},parent:{remove(){}}}];
    probe.transitGuides.set('natal:Old',probe.lines[0]);
    probe.setScene(stale);
    assert.equal(callbackCount,1,mode+' must invoke nested replacement');
    assert.equal(materialDisposals,1,mode+' focus material only disposed once');
    assert.equal(geometryDisposals,1,mode+' line geometry only disposed once');
    assert.equal(probe.scene,latest,mode+' newer scene retained');
    assert.equal(probe.glyphs.get('natal:New')?.[0],latest.mesh);
    assert.equal(probe.glyphs.has('natal:Stale'),false);
    assert.equal(probe.paints,1,'only newest scene repainted');
    assert.equal(probe.lines.length,0);
    assert.equal(probe.transitGuides.size,0);
    assert.equal(oldMesh.material,baseline,'old mesh material restored');
    assert.equal(baseline.disposed,0,'never dispose native base');
    assert.equal(foreground.material.dispose instanceof Function,true);
  }
});


test('nested repaint or scene replacement makes the older paint a no-op',()=>{
  const ast=ts.createSourceFile('planet-interaction.controller.ts',
    readFileSync(new URL('../src/lib/renderers/planet-interaction.controller.ts',import.meta.url),'utf8'),
    ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
  const cls=ast.statements.find(node=>
    ts.isClassDeclaration(node)&&node.name?.text==='PlanetInteractionController');
  const method=cls?.members.find(member=>
    ts.isMethodDeclaration(member)&&member.name.getText(ast)==='updateVisuals');
  assert.ok(method?.body);
  const compiled=ts.transpileModule(`class PaintProbe {
    disposed=false;
    scene:any={};
    sceneRevision=0;
    visualRevision=0;
    hovered:any=null;
    pinned:any=null;
    paints=0;
    onClear:any=null;
    clearVisuals(){this.onClear?.();}
    paintNatalAspectPalette(){this.paints++;}
    ${method.getText(ast)}
  }`,{compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText;
  const Probe=new Function(compiled+'\nreturn PaintProbe;')();
  const changedScene=new Probe();
  changedScene.onClear=()=>{
    changedScene.scene={};
    changedScene.sceneRevision++;
  };
  changedScene.updateVisuals();
  assert.equal(changedScene.paints,0,
    'a retired scene cannot be repainted after a disposal callback');
  const disposed=new Probe();
  disposed.onClear=()=>{disposed.disposed=true;};
  disposed.updateVisuals();
  assert.equal(disposed.paints,0,'destroyed controllers must not paint');
  const nested=new Probe();
  let invoked=false;
  nested.onClear=()=>{
    if(invoked)return;
    invoked=true;
    nested.updateVisuals();
  };
  nested.updateVisuals();
  assert.equal(nested.visualRevision,2);
  assert.equal(nested.paints,1,
    'the nested repaint wins; the older paint must not run afterward');
});


test('reentrant relation updates cannot emit stale selection details or duplicate renders',()=>{
  const ast=ts.createSourceFile('planet-interaction.controller.ts',
    readFileSync(new URL('../src/lib/renderers/planet-interaction.controller.ts',import.meta.url),'utf8'),
    ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
  const cls=ast.statements.find(item=>
    ts.isClassDeclaration(item)&&item.name?.text==='PlanetInteractionController');
  const method=cls?.members.find(item=>
    ts.isMethodDeclaration(item)&&item.name.getText(ast)==='setRelations');
  assert.ok(method?.body);
  const js=ts.transpileModule(`class RelationsProbe {
    disposed=false;
    relations:any[]=[];
    hovered:any=null;
    pinned:any={layer:'natal',name:'Sun'};
    scene:any={};
    sceneRevision=1;
    events:any[]=[];
    renders=0;
    paints=0;
    onPaint:any=null;
    onSend:any=null;
    updateVisuals(){this.paints++;this.onPaint?.();}
    recolorTransitGuides(){return false;}
    send(type:any,focus:any){
      this.events.push({type,focus:focus.name,
        relation:this.relations[0]?.type});
      this.onSend?.();
    }
    requestRender(){this.renders++;}
    ${method.getText(ast)}
  }`,{compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText;
  const Probe=new Function('snapshotChartAspects','sameChartAspects',
    'sameChartAspectVisuals','relatedChartAspects','sameChartAspectStructure',
    'sameChartPlanet',js+'\nreturn RelationsProbe;')(
      api.snapshotChartAspects,api.sameChartAspects,api.sameChartAspectVisuals,
      api.relatedChartAspects,api.sameChartAspectStructure,api.sameChartPlanet);
  const ref={layer:'natal',name:'Sun'};
  const relation=type=>[{from:ref,to:{layer:'transit',name:'Saturn'},
    type,orb:1}];
  const make=()=>{
    const p=new Probe();
    p.relations=api.snapshotChartAspects(relation('quadrato'));
    return p;
  };
  const standard=make();
  standard.setRelations(relation('trigono'));
  assert.deepEqual(standard.events.map(e=>e.relation),['trigono']);
  assert.equal(standard.renders,1);

  const nested=make();
  let repainted=false;
  nested.onPaint=()=>{
    if(repainted)return;
    repainted=true;
    nested.setRelations(relation('sestile'));
  };
  nested.setRelations(relation('trigono'));
  assert.equal(nested.relations[0].type,'sestile');
  assert.deepEqual(nested.events.map(e=>e.relation),['sestile'],
    'obsolete outer update must not notify a second time');
  assert.equal(nested.renders,1,'only newer relation repaints');
  assert.equal(nested.paints,2);

  const moved=make();
  moved.onPaint=()=>{moved.scene={};moved.sceneRevision++;};
  moved.setRelations(relation('trigono'));
  assert.deepEqual(moved.events,[]);
  assert.equal(moved.renders,0,'retired chart cannot request a render');

  const refocused=make();
  refocused.onPaint=()=>{refocused.pinned={layer:'natal',name:'Moon'};};
  refocused.setRelations(relation('trigono'));
  assert.deepEqual(refocused.events,[],
    'a new selection must not receive previous Sun details');
  assert.equal(refocused.renders,0);

  const nestedFromEmit=make();
  let emitted=false;
  nestedFromEmit.onSend=()=>{
    if(emitted)return;
    emitted=true;
    nestedFromEmit.setRelations(relation('sestile'));
  };
  nestedFromEmit.setRelations(relation('trigono'));
  assert.deepEqual(nestedFromEmit.events.map(e=>e.relation),
    ['trigono','sestile']);
  assert.equal(nestedFromEmit.renders,1,
    'reentrant host update makes the outer render request obsolete');

  const destroyed=make();
  destroyed.onPaint=()=>{destroyed.disposed=true;};
  destroyed.setRelations(relation('trigono'));
  assert.deepEqual(destroyed.events,[]);
  assert.equal(destroyed.renders,0);
});


test('reentrant pointermove/leave callbacks keep the newest same-scene hit',()=>{
  const ast=ts.createSourceFile('planet-interaction.controller.ts',
    readFileSync(new URL('../src/lib/renderers/planet-interaction.controller.ts',import.meta.url),'utf8'),
    ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
  const cls=ast.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text==='PlanetInteractionController');
  assert.ok(cls);
  const props=['move','leave'].map(name=>{
    const prop=cls.members.find(n=>ts.isPropertyDeclaration(n)&&n.name.getText(ast)===name);
    assert.ok(prop?.initializer,name);
    return prop.getText(ast);
  });
  const js=ts.transpileModule(`class PointerProbe {
    disposed=false; pointerRevision=0; scene:any={}; sceneRevision=0;
    hovered:any=null; pinned:any=null; cursor='default';
    canvas={style:{cursor:'default'}};
    visualRevision=0; events:string[]=[]; renders=0; paints=0;
    onSend:any=null; onPaint:any=null;
    pick(event:any){return event.ref;}
    send(type:string,planet:any){this.events.push(type+':'+planet.name);this.onSend?.(type,planet);}
    updateVisuals(){this.paints++;this.visualRevision++;this.onPaint?.();}
    requestRender(){this.renders++;}
    ${props.join('\n')}
  }`,{compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText;
  const Probe=new Function('sameChartPlanet',js+'\nreturn PointerProbe;')(api.sameChartPlanet);
  const ref=name=>({layer:'natal',name});
  const move=(probe,name)=>probe.move({ref:ref(name)});
  const starting=()=>{const p=new Probe();p.hovered=ref('Sun');return p;};
  const leaveNested=starting();
  let nested=false;
  leaveNested.onSend=type=>{
    if(type==='leave'&&!nested){nested=true;move(leaveNested,'Venus');}
  };
  move(leaveNested,'Moon');
  assert.deepEqual(leaveNested.events,['leave:Sun','enter:Venus']);
  assert.equal(leaveNested.hovered?.name,'Venus');
  assert.equal(leaveNested.paints,1);
  assert.equal(leaveNested.renders,1);
  const previous=leaveNested.events.length;
  move(leaveNested,'Venus');
  assert.equal(leaveNested.events.length,previous,'latched newer hit must not repeat');

  const enterNested=new Probe();
  nested=false;
  enterNested.onSend=type=>{
    if(type==='enter'&&!nested){nested=true;move(enterNested,'Venus');}
  };
  move(enterNested,'Moon');
  assert.deepEqual(enterNested.events,['enter:Moon','leave:Moon','enter:Venus']);
  assert.equal(enterNested.hovered?.name,'Venus');
  assert.equal(enterNested.renders,1);
  assert.equal(enterNested.paints,1);

  const enterLeave=new Probe();
  enterLeave.onSend=type=>{if(type==='enter')enterLeave.leave();};
  move(enterLeave,'Moon');
  assert.deepEqual(enterLeave.events,['enter:Moon','leave:Moon']);
  assert.equal(enterLeave.hovered,null);
  assert.equal(enterLeave.renders,1);

  const paintNested=new Probe();
  nested=false;
  paintNested.onPaint=()=>{
    if(!nested){nested=true;move(paintNested,'Venus');}
  };
  move(paintNested,'Moon');
  assert.equal(paintNested.hovered?.name,'Venus');
  assert.equal(paintNested.renders,1,'obsolete repaint must not request a frame');

  const leavePaintNested=starting();
  nested=false;
  leavePaintNested.onPaint=()=>{
    if(!nested){nested=true;move(leavePaintNested,'Venus');}
  };
  leavePaintNested.leave();
  assert.deepEqual(leavePaintNested.events,['leave:Sun','enter:Venus']);
  assert.equal(leavePaintNested.hovered?.name,'Venus');
  assert.equal(leavePaintNested.renders,1);
});


test('programmatic focus and aspect mode never render after nested disposal updates',()=>{
  const ast=ts.createSourceFile('planet-interaction.controller.ts',
    readFileSync(new URL('../src/lib/renderers/planet-interaction.controller.ts',import.meta.url),'utf8'),
    ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
  const cls=ast.statements.find(item=>
    ts.isClassDeclaration(item)&&item.name?.text==='PlanetInteractionController');
  assert.ok(cls);
  const methods=['highlight','setNatalAspectPresentation'].map(name=>{
    const member=cls.members.find(item=>
      ts.isMethodDeclaration(item)&&item.name.getText(ast)===name);
    assert.ok(member?.body,name);
    return member.getText(ast);
  });
  const js=ts.transpileModule(`class FocusReentryProbe {
    disposed=false;scene:any={};sceneRevision=0;visualRevision=0;
    pinned:any=null;hovered:any=null;natalAspectPresentation='all';
    renders=0;paints=0;onPaint:any=null;
    updateVisuals(){this.visualRevision++;this.paints++;this.onPaint?.();}
    requestRender(){this.renders++;}
    ${methods.join('\n')}
  }`,{compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText;
  const Probe=new Function('isChartPlanetRef','sameChartPlanet',
    js+'\nreturn FocusReentryProbe;')(api.isChartPlanetRef,api.sameChartPlanet);
  const sun={layer:'natal',name:'Sun'},moon={layer:'natal',name:'Moon'};
  const regular=new Probe();
  regular.highlight(sun);
  assert.deepEqual([regular.renders,regular.paints],[1,1]);
  regular.highlight({...sun});
  assert.deepEqual([regular.renders,regular.paints],[1,1],
    'identical pinned focus never repaints');

  const nestedPin=new Probe();
  let triggered=false;
  nestedPin.onPaint=()=>{
    if(triggered)return;
    triggered=true;
    nestedPin.highlight(moon);
  };
  nestedPin.highlight(sun);
  assert.equal(nestedPin.pinned.name,'Moon');
  assert.equal(nestedPin.paints,2);
  assert.equal(nestedPin.renders,1,'only newer pin requests a frame');

  const changedChart=new Probe();
  changedChart.onPaint=()=>{changedChart.scene={};changedChart.sceneRevision++;};
  changedChart.highlight(sun);
  assert.equal(changedChart.renders,0,'retired scene cannot request a frame');

  const destroyed=new Probe();
  destroyed.onPaint=()=>{destroyed.disposed=true;};
  destroyed.highlight(sun);
  assert.equal(destroyed.renders,0,'destroyed controller cannot render');

  const hovered=new Probe();
  hovered.hovered=moon;
  hovered.highlight(sun);
  assert.equal(hovered.pinned.name,'Sun');
  assert.deepEqual([hovered.renders,hovered.paints],[0,0],
    'pinning behind active hover must not redraw');

  const standardMode=new Probe();
  standardMode.setNatalAspectPresentation('focused');
  assert.deepEqual([standardMode.renders,standardMode.paints],[1,1]);
  standardMode.setNatalAspectPresentation('focused');
  assert.deepEqual([standardMode.renders,standardMode.paints],[1,1]);

  const nestedMode=new Probe();
  triggered=false;
  nestedMode.onPaint=()=>{
    if(triggered)return;
    triggered=true;
    nestedMode.setNatalAspectPresentation('muted');
  };
  nestedMode.setNatalAspectPresentation('focused');
  assert.equal(nestedMode.natalAspectPresentation,'muted');
  assert.equal(nestedMode.paints,2);
  assert.equal(nestedMode.renders,1,'only newest mode renders');

  const modeAfterScene=new Probe();
  modeAfterScene.onPaint=()=>{modeAfterScene.scene={};modeAfterScene.sceneRevision++;};
  modeAfterScene.setNatalAspectPresentation('focused');
  assert.equal(modeAfterScene.renders,0);

  const modeAfterDestroy=new Probe();
  modeAfterDestroy.onPaint=()=>{modeAfterDestroy.disposed=true;};
  modeAfterDestroy.setNatalAspectPresentation('focused');
  assert.equal(modeAfterDestroy.renders,0);

  const newerFocusDuringMode=new Probe();
  triggered=false;
  newerFocusDuringMode.onPaint=()=>{
    if(triggered)return;
    triggered=true;
    newerFocusDuringMode.highlight(moon);
  };
  newerFocusDuringMode.setNatalAspectPresentation('focused');
  assert.equal(newerFocusDuringMode.pinned.name,'Moon');
  assert.equal(newerFocusDuringMode.renders,1,
    'mode refresh must not duplicate the newer focus frame');
});


test('new focus render objects are owned before synchronous added callbacks',()=>{
  const ast=ts.createSourceFile('planet-interaction.controller.ts',
    readFileSync(new URL('../src/lib/renderers/planet-interaction.controller.ts',import.meta.url),'utf8'),
    ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
  const cls=ast.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text==='PlanetInteractionController');
  assert.ok(cls);
  const methods=['updateVisuals','addTransitConnector','addNatalFocusOverlay'].map(name=>{
    const m=cls.members.find(n=>ts.isMethodDeclaration(n)&&n.name.getText(ast)===name);
    assert.ok(m?.body,name);
    return m.getText(ast);
  });
  // The actual updateVisuals implementation is run with a tiny Three-like
  // controller host. Added callbacks clear its tracked lines immediately,
  // then replace the scene. No older stage may publish a disposed guide.
  const compiled=ts.transpileModule(`class AddedProbe {
    disposed=false;visualRevision=0;sceneRevision=0;
    scene:any={};pinned:any={layer:'natal',name:'Sun'};hovered:any=null;
    glyphs=new Map();natalAspectTags:any[]=[];natalAspectPresentation='all';
    lines:any[]=[];transitGuides=new Map();
    aspectRing:any=null;relations:any[]=[];
    created:any[]=[];onAdd:any=null;
    clearVisuals(){
      const old=this.lines;this.lines=[];this.transitGuides=new Map();
      for(const line of old){line.parent?.remove(line);line.geometry.dispose();line.material.dispose();}
    }
    paintNatalAspectPalette(){}
    ownsGlyph(){return true;}
    tintGlyph(){}
    activeGlyph(ref:any){return this.glyphs.get(ref.layer+':'+ref.name)?.[0]??null;}
    aspectEndpoint(mesh:any){return {x:mesh.x,y:mesh.y,z:0};}
    addTransitConnector(){return null;}
    ${methods[0]}
  }`,{compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText;
  const fakeThree={
    BufferGeometry:class {
      disposed=0;setFromPoints(){return this;}
      dispose(){this.disposed++;}
    },
    LineBasicMaterial:class {disposed=0;dispose(){this.disposed++;}},
    Line:class {
      parent=null;geometry=null;material=null;name='';renderOrder=0;
      constructor(geometry,material){this.geometry=geometry;this.material=material;}
    }
  };
  const relation={
    from:{layer:'natal',name:'Sun'},
    to:{layer:'transit',name:'Saturn'},
    type:'quadrato',orb:1
  };
  const Probe=new Function('THREE','Colori','relatedChartAspects','chartPlanetKey',
    'chartAspectRelationKey','preferredTransitConnectorAspect',
    compiled+'\nreturn AddedProbe;')(
    fakeThree,{elementiCelesti:{},aspetti:{quadrato:'#ff0000'}},
    ()=>[relation],ref=>ref.layer+':'+ref.name,()=> 'natal:Sun-transit:Saturn',(a)=>a);
  const starting=()=>{
    const p=new Probe();
    const sun={x:-0.3,y:0,userData:{chartPlanet:relation.from}};
    const saturn={x:0.3,y:0,userData:{chartPlanet:relation.to}};
    p.glyphs.set('natal:Sun',[sun]);
    p.glyphs.set('transit:Saturn',[saturn]);
    const scene={added:[],updateMatrixWorld(){},
      add(line){
        line.parent=this;
        this.added.push(line);
        p.onAdd?.(line);
      },
      remove(line){line.parent=null;this.added=this.added.filter(v=>v!==line);}
    };
    p.scene=scene;
    return {p,scene};
  };
  const ordinary=starting();
  ordinary.p.updateVisuals();
  assert.equal(ordinary.scene.added.length,1);
  assert.equal(ordinary.p.lines.length,1);
  assert.equal(ordinary.scene.added[0].geometry.disposed,0);

  const interrupted=starting();
  const newScene={updateMatrixWorld(){}};
  interrupted.p.onAdd=line=>{
    assert.ok(interrupted.p.lines.includes(line),'owner records line before add()');
    interrupted.p.clearVisuals();
    interrupted.p.scene=newScene;
    interrupted.p.sceneRevision++;
  };
  interrupted.p.updateVisuals();
  assert.equal(interrupted.scene.added.length,0,
    'old scene contains no orphan line after nested teardown');
  assert.equal(interrupted.p.lines.length,0);
  assert.equal(interrupted.p.scene,newScene);
});


test('cached native aspect roots transferred to a peer chart are not recolored or cloned',()=>{
  const ast=ts.createSourceFile('planet-interaction.controller.ts',
    readFileSync(new URL('../src/lib/renderers/planet-interaction.controller.ts',import.meta.url),'utf8'),
    ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
  const cls=ast.statements.find(m=>ts.isClassDeclaration(m)&&m.name?.text==='PlanetInteractionController');
  const methods=['ownsChartObject','paintNatalAspectPalette'].map(name=>{
    const member=cls?.members.find(m=>ts.isMethodDeclaration(m)&&m.name.getText(ast)===name);
    assert.ok(member?.body,name);
    return member.getText(ast);
  });
  const code=ts.transpileModule(`class NativeOwnershipProbe {
    scene:any=null; natalAspectPresentation='focused'; natalAspectTags:any[]=[];
    overlayCount=0; tintCount=0;
    addNatalFocusOverlay(){this.overlayCount++;}
    tintNatalGeometry(){this.tintCount++;}
    ${methods.join('\n')}
  }`,{compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText;
  const Probe=new Function('THREE',code+'\nreturn NativeOwnershipProbe;')(
    {Color:class {constructor(value){this.value=value;}}});
  const source={parent:null},other={parent:null};
  const native={parent:source,userData:{chartNatalAspect:{
    from:'Sun',to:'Moon',type:'quadrato'
  }}};
  const p=new Probe();
  p.scene=source;
  p.natalAspectTags=[{root:native,from:'Sun',to:'Moon',type:'quadrato'}];
  const sun={layer:'natal',name:'Sun'};
  native.parent=other;
  p.paintNatalAspectPalette(sun,()=>true);
  assert.equal(p.overlayCount,0,'no clone must be created in a peer chart');
  assert.equal(p.tintCount,0,'peer native colors remain unchanged');
  native.parent=null;
  p.paintNatalAspectPalette(sun,()=>true);
  assert.equal(p.overlayCount,0,'detached native aspect is also ignored');
  assert.equal(p.tintCount,0);
  native.parent=source;
  p.paintNatalAspectPalette(sun,()=>true);
  assert.equal(p.overlayCount,1,'returning a native root restores focus support');
  assert.equal(p.tintCount,1);
  const remoteGrandchild={parent:{parent:other}};
  assert.equal(p.ownsChartObject(remoteGrandchild),false);
  const localGrandchild={parent:{parent:source}};
  assert.equal(p.ownsChartObject(localGrandchild),true);
});
