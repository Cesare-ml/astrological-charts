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
