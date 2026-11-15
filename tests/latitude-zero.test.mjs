import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Execute the real source method without loading Three.js or an Angular browser runtime.
const source = readFileSync(new URL('../src/lib/renderers/@carta-astrale/latitudini.renderer.ts', import.meta.url), 'utf8');
const match = source.match(/public async getElementiCelesti\(temaRender, opzioni\)\s*\{([\s\S]*?)\n  \}/);
assert.ok(match, 'latitude renderer method must be found');
// This method has no TypeScript-only expressions in its body.
const getElementiCelesti = new Function('temaRender', 'opzioni', 'return (async () => {' + match[1] + '})()');

test('latitude chart includes finite zero and nonzero values only when enabled', async () => {
  const latitudes = { Sun: 0, Moon: -0, Mars: 2.5, Venus: -3, Jupiter: null, Saturn: undefined, Mercury: NaN, Uranus: Infinity, Neptune: '1', Pluto: 1 };
  const planets = Object.fromEntries(Object.entries(latitudes).map(([name, latitude]) => [name, { latitude }]));
  const elementi_celesti = Object.fromEntries(Object.keys(planets).map(name => [name, { att: name !== 'Pluto' }]));
  const result = await getElementiCelesti({ planets }, { settaggi: { elementi_celesti } });
  assert.deepEqual(Object.keys(result), ['Sun', 'Moon', 'Mars', 'Venus']);
  assert.ok(Object.is(result.Moon.latitude, -0));
});

test('missing bodies and disabled zero-latitude bodies are excluded without throwing', async () => {
  const planets = { Sun: { latitude: 0 }, Moon: { latitude: -0 }, Mars: { latitude: 1 } };
  const elementi_celesti = {
    Sun: { att: false },
    Moon: { att: true },
    Mars: { att: true },
    Missing: { att: true },
  };
  const result = await getElementiCelesti({ planets }, { settaggi: { elementi_celesti } });
  assert.deepEqual(Object.keys(result), ['Moon', 'Mars']);
  assert.strictEqual(result.Moon, planets.Moon, 'preserve precomputed input object');
});

test('negative infinity, boolean and numeric-string latitudes are rejected', async () => {
  const planets = {
    Sun: { latitude: -Infinity },
    Moon: { latitude: false },
    Mars: { latitude: '0' },
    Venus: { latitude: 0 },
  };
  const elementi_celesti = Object.fromEntries(Object.keys(planets).map(name => [name, { att: true }]));
  const result = await getElementiCelesti({ planets }, { settaggi: { elementi_celesti } });
  assert.deepEqual(Object.keys(result), ['Venus']);
});

test('finite boundary values preserve references and do not mutate input', async () => {
  const planets = Object.freeze({
    Sun: Object.freeze({ latitude: Number.MIN_VALUE, longitude: 12 }),
    Moon: Object.freeze({ latitude: -Number.MAX_VALUE, longitude: 24 }),
    Mars: Object.freeze({ latitude: Number.MAX_VALUE, longitude: 36 }),
    Venus: Object.freeze({ latitude: 0, longitude: 48 }),
  });
  const elementi_celesti = Object.freeze(Object.fromEntries(
    Object.keys(planets).map(name => [name, Object.freeze({ att: true })])
  ));
  const result = await getElementiCelesti({ planets }, { settaggi: { elementi_celesti } });
  assert.deepEqual(Object.keys(result), Object.keys(planets));
  for (const name of Object.keys(planets)) {
    assert.strictEqual(result[name], planets[name], `preserve precomputed ${name} object`);
  }
  assert.notStrictEqual(result, planets, 'return a filtered collection rather than the input map');
});

test('null-prototype planet and option maps retain zero latitude without mutating inputs', async () => {
  const sun = Object.freeze({ latitude: 0, longitude: 42 });
  const planets = Object.assign(Object.create(null), { Sun: sun });
  const elementi_celesti = Object.assign(Object.create(null), { Sun: Object.freeze({ att: true }) });
  Object.freeze(planets);
  Object.freeze(elementi_celesti);
  const result = await getElementiCelesti({ planets }, { settaggi: { elementi_celesti } });
  assert.deepEqual(Object.keys(result), ['Sun']);
  assert.strictEqual(result.Sun, sun);
  assert.equal(Object.getPrototypeOf(planets), null);
});

test('inherited chart option keys cannot enable extra planets', async () => {
  const inherited = { Hidden: { att: true } };
  const elementi_celesti = Object.assign(Object.create(inherited), { Sun: { att: true } });
  const planets = Object.freeze({
    Sun: Object.freeze({ latitude: 0, longitude: 15 }),
    Hidden: Object.freeze({ latitude: 1, longitude: 30 }),
  });
  const result = await getElementiCelesti({ planets }, { settaggi: { elementi_celesti } });
  assert.deepEqual(Object.keys(result), ['Sun']);
  assert.strictEqual(result.Sun, planets.Sun);
  assert.equal(Object.hasOwn(elementi_celesti, 'Hidden'), false);
});
