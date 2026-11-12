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
