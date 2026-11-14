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
const {layoutChartGlyphLongitudes} = await import(
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
