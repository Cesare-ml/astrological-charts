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
