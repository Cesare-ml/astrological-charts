/* Copyright (c) 2026 Cesare-ml (VirgoStars project).
 * CPAL-1.0; see ../LICENSE and Exhibits A/B.
 * CLI/Node/Python bridge JSON v1 validation — no browser required.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateChartPayloadV1, MAX_CHART_JSON_BYTES }
  from '../scripts/validate-chart-input.mjs';

function chart() {
  return {
    datetime: '2000-01-01T12:00:00Z',
    ascendant: 20, midheaven: 290,
    houseCusps: Array.from({length: 12}, (_,i)=>(20+i*30)%360),
    planets: {
      Sun: { longitude: 360, latitude: -0, declination: 0 },
      Moon: { longitude: -15, latitude: -3.5, longitudeSpeed: -0.1 },
    },
  };
}
const payload=()=>({schemaVersion:1,natal:chart()});

test('validates a complete chart without modifying negative zero or longitudes',()=>{
  const input=payload();
  const checked=validateChartPayloadV1(input,{mode:'natal',skin:'light'});
  assert.equal(checked,input);
  assert.ok(Object.is(input.natal.planets.Sun.latitude,-0));
  assert.equal(input.natal.planets.Sun.longitude,360);
  assert.equal(MAX_CHART_JSON_BYTES,1_000_000);
});

test('rejects missing or malformed birth time, angles, houses and planet details',()=>{
  const cases=[
    [{...payload(),natal:{...chart(),datetime:''}},/datetime/],
    [{...payload(),natal:{...chart(),ascendant:'20'}},/finite JSON number/],
    [{...payload(),natal:{...chart(),midheaven:NaN}},/finite JSON number/],
    [{...payload(),natal:{...chart(),houseCusps:[20]}},/exactly 12/],
    [{...payload(),natal:{...chart(),houseCusps:Array(12).fill(Infinity)}},/finite JSON number/],
    [{...payload(),natal:{...chart(),planets:{}}},/at least one/],
    [{...payload(),natal:{...chart(),planets:{Sun:{longitude:42,latitude:91}}}},/between -90 and 90/],
    [{...payload(),natal:{...chart(),planets:{Sun:{longitude:42,declination:-91}}}},/between -90 and 90/],
    [{...payload(),natal:{...chart(),planets:{Sun:{longitude:42,longitudeSpeed:NaN}}}},/finite JSON number/],
    [{...payload(),natal:{...chart(),australInversion:'yes'}},/true or false/],
    [{...payload(),natal:{...chart(),vertex:'wrong'}},/finite JSON number/],
    [{...payload(),natal:{...chart(),planets:{['X'.repeat(81)]:{longitude:15}}}},/1–80/],
    [{...payload(),skin:'  '},/non-empty string/],
    [{...payload(),mode:'unknown'},/mode must be/],
    [{...payload(),schemaVersion:2},/schemaVersion/],
  ];
  for(const [data,message] of cases) {
    assert.throws(()=>validateChartPayloadV1(data),message);
  }
});

test('does not invent missing second charts, even with CLI mode override',()=>{
  assert.throws(()=>validateChartPayloadV1(payload(),{mode:'transits'}),/transits data is required/);
  assert.throws(()=>validateChartPayloadV1(payload(),{mode:'synastry'}),/synastry data is required/);
  assert.throws(()=>validateChartPayloadV1({...payload(),mode:'transits'}, {mode:'natal'}),/transits data is required/);
  assert.equal(validateChartPayloadV1({...payload(),transits:chart()}, {mode:'transits'}).schemaVersion,1);
  assert.equal(validateChartPayloadV1({...payload(),synastry:chart()}, {mode:'synastry'}).schemaVersion,1);
});

test('unknown JSON structures are rejected and no data are mutated',()=>{
  for(const bad of [null,[],false,'json',{}, {schemaVersion:1,natal:null}]) {
    assert.throws(()=>validateChartPayloadV1(bad),/JSON object|schemaVersion/);
  }
});

test('rejects explicit null vertex in every chart while allowing an omitted vertex', () => {
  const original = payload();
  assert.equal(validateChartPayloadV1(original), original);
  for (const location of ['natal', 'transits', 'synastry']) {
    const invalid = {...payload(), [location]: {...chart(), vertex: null}};
    assert.throws(() => validateChartPayloadV1(invalid), new RegExp(location + '\\.vertex.*finite JSON number'));
    assert.equal(invalid[location].vertex, null);
  }
});

test('validates optional secondary planet identifiers even when rendering natal', () => {
  for (const location of ['transits', 'synastry']) {
    for (const name of [' ', ' ', 'X'.repeat(81)]) {
      const invalid = {...payload(), [location]: {...chart(), planets: {[name]: null}}};
      assert.throws(() => validateChartPayloadV1(invalid), /Planet names must be 1–80 characters/);
      assert.equal(invalid[location].planets[name], null);
    }
  }
});

test('rejects explicit null optional planet numbers in all chart layers without mutation', () => {
  for (const location of ['natal', 'transits', 'synastry']) {
    for (const field of ['latitude', 'declination', 'longitudeSpeed', 'latitudeSpeed']) {
      const planet = {longitude: 42, [field]: null};
      const invalid = {...payload(), [location]: {...chart(), planets: {Sun: planet}}};
      assert.throws(
        () => validateChartPayloadV1(invalid, {mode: 'natal'}),
        new RegExp(location + '\\.' + 'planets\\.Sun\\.' + field + '.*finite JSON number'),
        location + ' / ' + field,
      );
      assert.equal(planet[field], null);
      assert.equal(invalid[location].planets.Sun, planet);
    }
  }
});
