import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

// Exercise the committed pure TypeScript helper, without a GPU or mocked
// implementation of the collision algorithm.
const source = readFileSync(
  new URL('../src/lib/renderers/planet-layout.ts', import.meta.url), 'utf8'
);
const output = ts.transpileModule(source, {
  compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}
}).outputText;
const {layoutChartGlyphLongitudes, relaxChartGlyphCycle, chartBodyRenderAngles} = await import(
  'data:text/javascript;base64,' + Buffer.from(output).toString('base64')
);

test('inherited enumerable properties cannot create ghost chart planets', () => {
  const inherited = {Ghost: {longitude: 45}};
  const bodies = Object.assign(Object.create(inherited), {
    Sun: {longitude: 15},
    Moon: {longitude: 18},
  });
  const result = layoutChartGlyphLongitudes(bodies, 'longitude');
  assert.deepEqual(Object.keys(result).sort(), ['Moon', 'Sun']);
  assert.equal(Object.hasOwn(result, 'Ghost'), false);
  assert.equal(Object.getPrototypeOf(result), Object.prototype);
  assert.deepEqual(bodies.Sun, {longitude: 15});
  assert.deepEqual(bodies.Moon, {longitude: 18});
});

test('an own __proto__ planet name stays an own data property', () => {
  // Object literal syntax would use __proto__ to set a prototype instead
  // of creating an own key; JSON.parse is a realistic untyped host input.
  const bodies = JSON.parse(
    '{"__proto__":{"longitude":45},"Sun":{"longitude":47}}'
  );
  const originalKeys = Object.keys(bodies);
  const result = layoutChartGlyphLongitudes(bodies, 'longitude');
  assert.deepEqual(Object.keys(bodies), originalKeys);
  assert.equal(Object.getPrototypeOf(result), Object.prototype);
  assert.equal(Object.hasOwn(result, '__proto__'), true);
  assert.equal(Object.hasOwn(result, 'Sun'), true);
  assert.deepEqual(Object.keys(result).sort(), ['Sun', '__proto__'].sort());
  assert.equal(typeof result['__proto__'].longitude, 'number');
  assert.equal(Object.prototype.longitude, undefined);
});

test('prototype method names remain separate chart keys', () => {
  const bodies = JSON.parse(
    '{"constructor":{"longitude":10},"toString":{"longitude":11},"Sun":{"longitude":12}}'
  );
  const result = layoutChartGlyphLongitudes(bodies, 'longitude');
  assert.deepEqual(
    Object.keys(result).sort(),
    ['Sun', 'constructor', 'toString'].sort()
  );
  for (const name of Object.keys(bodies)) {
    assert.equal(Object.hasOwn(result, name), true);
    assert.ok(Number.isFinite(result[name].longitude));
  }
});

test('plain chart input retains layout, shape and original ephemerides', () => {
  const bodies = {
    Sun: {longitude: 359.5},
    Moon: {longitude: 0.5},
    Mars: {longitude: 2},
    Venus: {longitude: 20},
  };
  const before = structuredClone(bodies);
  const first = layoutChartGlyphLongitudes(bodies, 'longitude');
  const again = layoutChartGlyphLongitudes(bodies, 'longitude');
  assert.deepEqual(first, again);
  assert.deepEqual(bodies, before);
  assert.deepEqual(Object.keys(first), Object.keys(again));
  assert.equal(Object.getPrototypeOf(first), Object.prototype);
  for (const name of Object.keys(bodies)) {
    assert.equal(Object.hasOwn(first, name), true);
    assert.ok(Number.isFinite(first[name].longitude));
  }
});

test('invalid collision gaps fail closed before changing any working coordinates', () => {
  for (const separation of [NaN, Infinity, -Infinity, -1, 361, 1e308, '7', null]) {
    const working = [{key: 'Sun', deg: 3}, {key: 'Moon', deg: 4}];
    const before = structuredClone(working);
    assert.throws(() => relaxChartGlyphCycle(working, separation), {
      name: 'RangeError',
      message: 'Glyph separation must be finite and between 0 and 360 degrees'
    }, String(separation));
    assert.deepEqual(working, before, 'invalid spacing must not sort/mutate the caller');
    const bodies = {Sun: {longitude: 3}, Moon: {longitude: 4}};
    assert.throws(() => layoutChartGlyphLongitudes(bodies, 'longitude', separation),
      RangeError, String(separation));
    assert.deepEqual(bodies, {Sun: {longitude: 3}, Moon: {longitude: 4}});
  }
});

test('valid gaps preserve existing two-pass glyph positions and finite angles', () => {
  const bodies = {Sun: {longitude: 3}, Moon: {longitude: 4}, Venus: {longitude: 20}};
  const original = structuredClone(bodies);
  const legacy = (gap) => {
    const planets = Object.entries(bodies).map(([key, body]) => ({key, deg: body.longitude % 360}));
    const cycle = () => {
      planets.sort((a,b) => a.deg - b.deg);
      for (let i=1;i<planets.length;i++) {
        const distance = planets[i].deg - planets[i-1].deg;
        if (distance < gap) planets[i].deg += gap - distance;
      }
      for (const body of planets) body.deg = (body.deg + 180) % 360;
    };
    cycle(); cycle();
    return Object.fromEntries(planets.map(p => [p.key, {longitude: p.deg}]));
  };
  for (const gap of [0, 0.25, 3, 7, 12, 180, 360]) {
    const result = layoutChartGlyphLongitudes(bodies, 'longitude', gap);
    assert.deepEqual(result, legacy(gap), 'valid gap must keep the legacy exact angles');
    assert.ok(Object.values(result).every(body => Number.isFinite(body.longitude)));
  }
  assert.deepEqual(layoutChartGlyphLongitudes(bodies, 'longitude'), legacy(7));
  assert.deepEqual(bodies, original);
});

test('render angles reject nonfinite and nonnumeric source coordinates', () => {
  const values = [NaN, Infinity, -Infinity, undefined, null, '12'];
  const defaults = [12, 19, 20, 2];
  for (let index=0; index<4; index++) for(const value of values) {
    const inputs = [...defaults];
    inputs[index]=value;
    assert.throws(() => chartBodyRenderAngles(...inputs), {
      name: 'RangeError', message: 'Glyph render angles require finite numeric inputs'
    }, `index ${index}, value ${value}`);
  }
});

test('render angles reject finite inputs whose intermediate arithmetic overflows', () => {
  for (const inputs of [
    [1e308, -1e308, 20, 0],
    [1e308, 1e308, -1e308, 1e308],
    [0, 1e308, -1e308, 1e308],
  ]) {
    assert.throws(() => chartBodyRenderAngles(...inputs), {
      name: 'RangeError', message: 'Glyph render angle arithmetic overflowed'
    });
  }
});

test('valid render angles keep exact legacy expression order and results', () => {
  for(const [original, adjusted, ascendant, offset] of [
    [12, 19, 20, 2],
    [0, 0, 0, 0],
    [359.999, 366.999, 270.25, -40],
    [-12, -5, 180, 6.5],
    [1e150, 1e150, 100, 1e150],
  ]) {
    const expectedTick=75-ascendant+15+original+offset;
    const expectedShift=adjusted-original;
    const expectedGlyph=expectedTick+expectedShift;
    assert.deepEqual(chartBodyRenderAngles(original,adjusted,ascendant,offset), {
      tickDegrees: expectedTick,
      glyphDisplacementDegrees: expectedShift,
      glyphDegrees: expectedGlyph,
    });
  }
});
