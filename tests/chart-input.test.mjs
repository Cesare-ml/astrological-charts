/* Copyright (c) 2026 Cesare-ml (VirgoStars project).
 * CPAL-1.0; see ../LICENSE and Exhibits A/B.
 * Focused JSON adapter tests: no browser or ephemeris installation needed. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { validateChartPayloadV1 } from '../scripts/validate-chart-input.mjs';

// Compile the actual checked-in TypeScript parser, not a reimplementation.
const tsSource = readFileSync(new URL('../demo/chart-input.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(tsSource, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
}}).outputText;
const module = { exports: {} };
new Function('module', 'exports', js)(module, module.exports);
const { parseChartPayload } = module.exports;

function chart() {
  return {
    datetime: '2026-01-01T00:00:00Z',
    ascendant: 20,
    midheaven: 290,
    houseCusps: Array.from({ length: 12 }, (_, i) => 20 + i * 30),
    planets: { Sun: { longitude: 360, latitude: 0 }, Moon: { longitude: -15, latitude: -3.5 } },
  };
}

test('Python JSON contract converts to legacy TemaRender without calculating ephemerides', () => {
  const parsed = parseChartPayload({ schemaVersion: 1, natal: chart(), mode: 'natal' });
  assert.equal(parsed.natal.as, 20);
  assert.equal(parsed.natal.ds, 200);
  assert.equal(parsed.natal.mc, 290);
  assert.equal(parsed.natal.ic, 110);
  assert.equal(parsed.natal.planets.Sun.longitude, 0);
  assert.equal(parsed.natal.planets.Sun.latitude, 0, 'zero latitude must be kept, not omitted');
  assert.equal(parsed.natal.planets.Moon.longitude, 345);
  assert.equal(parsed.natal.planets.Moon.latitude, -3.5);
  assert.equal(parsed.natal.planets.Moon.equatoriale.declination, 0);
  assert.equal(parsed.natal.houses.egizia.house.length, 12);
  assert.equal(parsed.transits, null, 'no synthetic transits should be injected');
  assert.equal(parsed.synastry, null);
});

test('transits and synastry must be provided for their selected modes', () => {
  assert.throws(() => parseChartPayload({ schemaVersion: 1, natal: chart(), mode: 'transits' }), /transits data is required/);
  assert.throws(() => parseChartPayload({ schemaVersion: 1, natal: chart(), mode: 'synastry' }), /synastry data is required/);
  const transit = parseChartPayload({ schemaVersion: 1, natal: chart(), transits: chart(), mode: 'transits' });
  assert.ok(transit.transits);
});

test('invalid fields fail explicitly, including malformed houses and nonfinite coordinates', () => {
  assert.throws(() => parseChartPayload({ schemaVersion: 2, natal: chart() }), /schemaVersion/);
  assert.throws(() => parseChartPayload({ schemaVersion: 1, natal: { ...chart(), houseCusps: [1] } }), /12/);
  assert.throws(() => parseChartPayload({ schemaVersion: 1, natal: {
    ...chart(), planets: { Sun: { longitude: 'not a number' } },
  }}), /finite JSON number/);
  assert.throws(() => parseChartPayload({ schemaVersion: 1, natal: {
    ...chart(), planets: { Sun: { longitude: 12, latitude: 100 } },
  }}), /between -90 and 90/);
  assert.throws(() => parseChartPayload({ schemaVersion: 1, natal: {
    ...chart(), planets: {},
  }}), /at least one/);
});

test('CLI prevalidation and Angular parser agree on shared JSON v1 fixtures',()=>{
  const cases=[
    [{schemaVersion:1,natal:chart()},true],
    [{schemaVersion:1,natal:chart(),mode:'latitude'},true],
    [{schemaVersion:1,natal:chart(),mode:'transits',transits:chart()},true],
    [{schemaVersion:1,natal:chart(),mode:'synastry',synastry:chart()},true],
    [{schemaVersion:1,natal:chart(),mode:'transits'},false],
    [{schemaVersion:1,natal:chart(),mode:'synastry'},false],
    [{schemaVersion:1,natal:{...chart(),datetime:''}},false],
    [{schemaVersion:1,natal:{...chart(),houseCusps:[12]}},false],
    [{schemaVersion:1,natal:{...chart(),planets:{Sun:{longitude:12,latitude:-91}}}},false],
    [{schemaVersion:1,natal:{...chart(),planets:{Sun:{longitude:NaN}}}},false],
    [{schemaVersion:1,natal:{...chart(),australInversion:'yes'}},false],
    [{schemaVersion:1,natal:chart(),skin:'  '},false],
    [{schemaVersion:1,natal:chart(),mode:'unknown'},false],
  ];
  for(const [input,expected] of cases){
    const clientValid=(()=>{try{parseChartPayload(input);return true;}catch{return false;}})();
    const serverValid=(()=>{try{validateChartPayloadV1(input);return true;}catch{return false;}})();
    assert.equal(clientValid,expected,'Angular accepted an unexpected fixture');
    assert.equal(serverValid,clientValid,'Node prevalidation and Angular parser diverged');
  }
});
