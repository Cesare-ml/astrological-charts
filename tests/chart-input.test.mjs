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

test('zero latitude, signed speeds and boundary declinations survive both adapters', () => {
  const natal = chart();
  natal.planets.Sun.latitude = -0;
  natal.planets.Sun.latitudeSpeed = -0;
  natal.planets.Sun.longitudeSpeed = -1.25;
  natal.planets.Sun.declination = -90;
  natal.planets.Moon.declination = 90;
  const payload = { schemaVersion: 1, natal, mode: 'latitude' };
  assert.equal(validateChartPayloadV1(payload), payload, 'prevalidation must not mutate the supplied chart');
  const parsed = parseChartPayload(payload);
  assert.ok(Object.is(parsed.natal.planets.Sun.latitude, -0), 'negative zero latitude is a valid input');
  assert.ok(Object.is(parsed.natal.planets.Sun.latitudeSpeed, -0), 'negative zero speed must be preserved');
  assert.equal(parsed.natal.planets.Sun.longitudeSpeed, -1.25);
  assert.equal(parsed.natal.planets.Sun.equatoriale.declination, -90);
  assert.equal(parsed.natal.planets.Moon.equatoriale.declination, 90);
  assert.ok(Object.is(natal.planets.Sun.latitude, -0), 'parsing must not mutate caller data');
});

test('both adapters reject out-of-range declinations and invalid optional speeds', () => {
  for (const invalidPlanet of [
    { longitude: 12, declination: -90.01 },
    { longitude: 12, declination: 90.01 },
    { longitude: 12, longitudeSpeed: 'retrograde' },
    { longitude: 12, latitudeSpeed: Infinity },
  ]) {
    const payload = { schemaVersion: 1, natal: { ...chart(), planets: { Sun: invalidPlanet } } };
    assert.throws(() => validateChartPayloadV1(payload), /finite JSON number|between -90 and 90/);
    assert.throws(() => parseChartPayload(payload), /finite JSON number|between -90 and 90/);
  }
});

test('both adapters reject blank planet identifiers without altering valid names', () => {
  for (const invalidName of ['', ' ', '\t\n', '\u00a0', '\u2003', 'x'.repeat(81)]) {
    const payload = { schemaVersion: 1, natal: {
      ...chart(), planets: { [invalidName]: { longitude: 42 } },
    } };
    assert.throws(() => validateChartPayloadV1(payload), /Planet names/);
    assert.throws(() => parseChartPayload(payload), /Planet names/);
  }
  const payload = { schemaVersion: 1, natal: {
    ...chart(), planets: { 'North Node': { longitude: 42 } },
  } };
  assert.equal(validateChartPayloadV1(payload), payload);
  assert.ok(Object.hasOwn(parseChartPayload(payload).natal.planets, 'North Node'));
  const boundaryName = 'x'.repeat(80);
  const boundaryPayload = { schemaVersion: 1, natal: {
    ...chart(), planets: { [boundaryName]: { longitude: 42 } },
  } };
  assert.equal(validateChartPayloadV1(boundaryPayload), boundaryPayload);
  assert.ok(Object.hasOwn(parseChartPayload(boundaryPayload).natal.planets, boundaryName),
    'an 80-character planet identifier must remain valid');
});

test('both adapters validate optional secondary charts even in natal mode', () => {
  for (const key of ['transits', 'synastry']) {
    const invalid = { ...chart(), houseCusps: [42] };
    const payload = { schemaVersion: 1, natal: chart(), mode: 'natal', [key]: invalid };
    assert.throws(() => validateChartPayloadV1(payload), /12 degree values/);
    assert.throws(() => parseChartPayload(payload), /12 degree values/);
  }
});


test('optional secondary charts reject invalid planet identifiers in natal mode', () => {
  for (const key of ['transits', 'synastry']) {
    const secondary = { ...chart(), planets: { [String.fromCodePoint(0x2003)]: { longitude: 42 } } };
    const payload = { schemaVersion: 1, mode: 'natal', natal: chart(), [key]: secondary };
    assert.throws(() => validateChartPayloadV1(payload), /Planet names/);
    assert.throws(() => parseChartPayload(payload), /Planet names/);
  }
});

test('both adapters reject invalid optional vertex and inversion flags', () => {
  for (const invalid of [
    { vertex: Infinity },
    { vertex: '120' },
    { australInversion: 1 },
    { australInversion: 'false' },
  ]) {
    const payload = { schemaVersion: 1, natal: { ...chart(), ...invalid } };
    assert.throws(() => validateChartPayloadV1(payload), /finite JSON number|true or false/);
    assert.throws(() => parseChartPayload(payload), /finite JSON number|true or false/);
  }
});

test('valid secondary charts remain available when natal mode is selected', () => {
  const transits = { ...chart(), planets: { Mars: { longitude: 123, latitude: -0 } } };
  const synastry = { ...chart(), planets: { Venus: { longitude: 222, latitude: 4 } } };
  const payload = { schemaVersion: 1, natal: chart(), transits, synastry, mode: 'natal' };
  assert.equal(validateChartPayloadV1(payload), payload, 'prevalidation preserves the original object');
  const parsed = parseChartPayload(payload);
  assert.equal(parsed.mode, 'natal');
  assert.equal(parsed.transits.planets.Mars.longitude, 123);
  assert.ok(Object.is(parsed.transits.planets.Mars.latitude, -0));
  assert.equal(parsed.synastry.planets.Venus.longitude, 222);
  assert.equal(parsed.synastry.planets.Venus.latitude, 4);
  assert.equal(payload.transits.planets.Mars.longitude, 123, 'input must not be mutated');
});


test('invalid planet identifiers take precedence over malformed planet values in both adapters', () => {
  for (const name of [' ', '\u2003', 'x'.repeat(81)]) {
    const payload = { schemaVersion: 1, natal: {
      ...chart(), planets: { [name]: null },
    } };
    assert.throws(() => validateChartPayloadV1(payload), /Planet names/);
    assert.throws(() => parseChartPayload(payload), /Planet names/);
  }
});


test('angular normalizes signed angular inputs while CLI preserves source values', () => {
  const natal = chart();
  natal.ascendant = -30;
  natal.midheaven = 725;
  natal.vertex = -450;
  natal.houseCusps = Array.from({ length: 12 }, (_, i) => -360 + i * 30);
  natal.planets = { Sun: { longitude: -725, latitude: -0 } };
  const payload = { schemaVersion: 1, natal, mode: 'natal' };
  const before = structuredClone(payload);
  assert.equal(validateChartPayloadV1(payload), payload);
  const parsed = parseChartPayload(payload);
  assert.equal(parsed.natal.as, 330);
  assert.equal(parsed.natal.ds, 150);
  assert.equal(parsed.natal.mc, 5);
  assert.equal(parsed.natal.ic, 185);
  assert.equal(parsed.natal.houses.egizia.vertex, 270);
  assert.deepEqual(parsed.natal.houses.egizia.house,
    Array.from({ length: 12 }, (_, i) => i * 30));
  assert.equal(parsed.natal.planets.Sun.longitude, 355);
  assert.ok(Object.is(parsed.natal.planets.Sun.latitude, -0));
  assert.deepEqual(payload, before, 'neither adapter may mutate caller coordinates');
});


test('both adapters prioritize malformed planet values over optional chart flags', () => {
  for (const invalid of [{ vertex: 'invalid' }, { australInversion: 'invalid' }]) {
    const payload = { schemaVersion: 1, natal: {
      ...chart(), ...invalid, planets: { Sun: null },
    } };
    assert.throws(() => validateChartPayloadV1(payload), /natal\.planets\.Sun must be a JSON object/);
    assert.throws(() => parseChartPayload(payload), /natal\.planets\.Sun must be a JSON object/);
  }
});


test('secondary chart angles normalize independently without mutating source', () => {
  const transits = chart();
  transits.ascendant = -10;
  transits.planets = { Mars: { longitude: 721, latitude: -0 } };
  const synastry = chart();
  synastry.midheaven = -721;
  synastry.planets = { Venus: { longitude: -1, latitude: 2 } };
  const payload = { schemaVersion: 1, natal: chart(), transits, synastry, mode: 'natal' };
  const before = structuredClone(payload);
  assert.equal(validateChartPayloadV1(payload), payload);
  const parsed = parseChartPayload(payload);
  assert.equal(parsed.transits.as, 350);
  assert.equal(parsed.transits.planets.Mars.longitude, 1);
  assert.ok(Object.is(parsed.transits.planets.Mars.latitude, -0));
  assert.equal(parsed.synastry.mc, 359);
  assert.equal(parsed.synastry.planets.Venus.longitude, 359);
  assert.equal(parsed.natal.as, 20, 'secondary chart normalization must not affect natal');
  assert.deepEqual(payload, before, 'caller-owned secondary charts must remain unchanged');
});


test('CLI mode override requires actual secondary chart without changing Angular natal import', () => {
  const payload = { schemaVersion: 1, natal: chart(), mode: 'natal' };
  const before = structuredClone(payload);
  assert.equal(parseChartPayload(payload).mode, 'natal');
  for (const mode of ['transits', 'synastry']) {
    assert.throws(() => validateChartPayloadV1(payload, { mode }), new RegExp(`${mode} data is required`));
  }
  assert.deepEqual(payload, before, 'rejected overrides must not modify the source');
  for (const mode of ['transits', 'synastry']) {
    const complete = { ...payload, [mode]: chart() };
    assert.equal(validateChartPayloadV1(complete, { mode }), complete);
    assert.equal(parseChartPayload(complete).mode, 'natal', 'CLI override must not rewrite embedded mode');
  }
});


test('each secondary chart independently preserves optional speed and declination boundaries', () => {
  const transits = chart();
  transits.planets = { Mars: { longitude: -360, latitude: -0, longitudeSpeed: -0, latitudeSpeed: -2, declination: 90 } };
  const synastry = chart();
  synastry.planets = { Venus: { longitude: 720, latitude: 0, longitudeSpeed: 1.5, latitudeSpeed: -0, declination: -90 } };
  const payload = { schemaVersion: 1, mode: 'natal', natal: chart(), transits, synastry };
  const before = structuredClone(payload);
  assert.equal(validateChartPayloadV1(payload), payload);
  const parsed = parseChartPayload(payload);
  assert.equal(parsed.transits.planets.Mars.longitude, 0);
  assert.ok(Object.is(parsed.transits.planets.Mars.latitude, -0));
  assert.ok(Object.is(parsed.transits.planets.Mars.longitudeSpeed, -0));
  assert.equal(parsed.transits.planets.Mars.latitudeSpeed, -2);
  assert.equal(parsed.transits.planets.Mars.equatoriale.declination, 90);
  assert.equal(parsed.synastry.planets.Venus.longitude, 0);
  assert.equal(parsed.synastry.planets.Venus.longitudeSpeed, 1.5);
  assert.ok(Object.is(parsed.synastry.planets.Venus.latitudeSpeed, -0));
  assert.equal(parsed.synastry.planets.Venus.equatoriale.declination, -90);
  assert.deepEqual(payload, before, 'adapters must not mutate secondary chart inputs');
});

test('failed validation does not alter caller-owned natal or secondary chart data', () => {
  for (const key of ['natal', 'transits', 'synastry']) {
    const payload = {
      schemaVersion: 1,
      mode: 'natal',
      natal: chart(),
      transits: chart(),
      synastry: chart(),
    };
    payload[key].planets.Sun.longitude = -725;
    payload[key].planets.Sun.latitude = -0;
    payload[key].houseCusps = [1]; // Fail after providing otherwise valid planet coordinates.
    const before = structuredClone(payload);
    assert.throws(() => validateChartPayloadV1(payload), /12 degree values/);
    assert.deepEqual(payload, before, 'Node validation mutated ' + key);
    assert.throws(() => parseChartPayload(payload), /12 degree values/);
    assert.deepEqual(payload, before, 'Angular parsing mutated ' + key);
    assert.ok(Object.is(payload[key].planets.Sun.latitude, -0));
  }
});

test('explicit null vertex is invalid in natal and optional secondary charts', () => {
  for (const key of ['natal', 'transits', 'synastry']) {
    const payload = { schemaVersion: 1, mode: 'natal', natal: chart() };
    payload[key] = { ...chart(), vertex: null };
    const before = structuredClone(payload);
    assert.throws(() => validateChartPayloadV1(payload), new RegExp(`${key}\\.vertex must be a finite JSON number`));
    assert.throws(() => parseChartPayload(payload), new RegExp(`${key}\\.vertex must be a finite JSON number`));
    assert.deepEqual(payload, before, 'rejected null vertex must not mutate input');
  }
  const omitted = { schemaVersion: 1, natal: chart() };
  assert.equal(validateChartPayloadV1(omitted), omitted);
  assert.equal(parseChartPayload(omitted).natal.houses.egizia.vertex, 160,
    'omitted vertex still uses the documented ascendant + 140 fallback');
});

test('null optional numeric planet fields are rejected in all chart layers', () => {
  for (const layer of ['natal', 'transits', 'synastry']) {
    for (const field of ['latitude', 'declination', 'longitudeSpeed', 'latitudeSpeed']) {
      const payload = { schemaVersion: 1, mode: 'natal', natal: chart() };
      payload[layer] = { ...chart(), planets: { Sun: { longitude: 42, [field]: null } } };
      const before = structuredClone(payload);
      const error = new RegExp(`${layer}\\.planets\\.Sun\\.${field} must be a finite JSON number`);
      assert.throws(() => validateChartPayloadV1(payload), error);
      assert.throws(() => parseChartPayload(payload), error);
      assert.deepEqual(payload, before, 'rejected optional numeric field must not mutate input');
    }
  }
});
