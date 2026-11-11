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
