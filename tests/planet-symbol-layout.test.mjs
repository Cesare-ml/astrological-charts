import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Bundle the geometry-only TypeScript helper to exercise precisely the code
// the Three.js renderer imports, with no DOM or original artwork required.
const bundle = await build({ entryPoints: ['src/lib/renderers/moduli/planet-symbol-layout.ts'],
  bundle: true, write: false, platform: 'node', format: 'esm', target: 'es2022' });
const { layoutPlanetSymbols, normalizeDegree, degreeWithinSign } =
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

const inner = 1.43, outer = 1.83, width = 0.22, height = 0.22 * 605 / 875;

function angularDistance(a, b) {
  return Math.abs(((a - b + 540) % 360) - 180);
}

test('isolated symbols stay exactly on their true degrees', () => {
  const source = { Sun: 12.5, Moon: 90.2, Venus: 180.5, Mars: 280.1 };
  const positions = layoutPlanetSymbols(source, inner, outer, width, height, true);
  for (const [name, degree] of Object.entries(source)) {
    assert.ok(angularDistance(positions[name].displayDegree, degree) < 1e-8, name);
    assert.equal(positions[name].radius, (inner + outer) / 2, name);
  }
  assert.deepEqual(source, { Sun: 12.5, Moon: 90.2, Venus: 180.5, Mars: 280.1 });
});

test('a conjunction crosses the Aries point without piling up or drifting tens of degrees', () => {
  const source = { Sun: 358.5, Moon: 359.2, Mercury: 0.1, Venus: 1.4,
    Mars: 2.3, Jupiter: 3.1, Saturn: 4.2 };
  const positions = layoutPlanetSymbols(source, inner, outer, width, height, true);
  const radii = new Set(Object.values(positions).map(body => body.radius));
  assert.equal(radii.size, 2, 'crowded points should use separate radial lanes');
  for (const [name, degree] of Object.entries(source)) {
    assert.ok(angularDistance(positions[name].displayDegree, degree) < 22, name);
  }
  // Two objects at the same radius must not overlap after the projection.
  const entries = Object.entries(positions);
  for (let i = 0; i < entries.length; i++) for (let j = i + 1; j < entries.length; j++) {
    const [nameA, a] = entries[i], [nameB, b] = entries[j];
    if (Math.abs(a.radius - b.radius) > 1e-8) continue;
    const chord = 2 * a.radius * Math.sin(angularDistance(a.displayDegree, b.displayDegree) * Math.PI / 360);
    assert.ok(chord >= width * 1.53 + 0.017, `${nameA}/${nameB} overlap in their lane`);
  }
});

test('exactly coincident bodies spread symmetrically instead of accumulating drift', () => {
  const source = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`p${i}`, 359.7]));
  const result = layoutPlanetSymbols(source, inner, outer, width, height, true);
  assert.equal(Object.keys(result).length, 8);
  assert.ok(Math.max(...Object.values(result).map(p => angularDistance(p.displayDegree, 359.7))) < 23);
  assert.equal(new Set(Object.values(result).map(p => p.displayDegree.toFixed(4))).size, 8);
});

test('labels use the unshifted degree within the sign, including 360° and negatives', () => {
  assert.equal(degreeWithinSign(359.99), 29);
  assert.equal(degreeWithinSign(360), 0);
  assert.equal(degreeWithinSign(-0.1), 29);
  assert.equal(degreeWithinSign(46.8), 16);
  assert.equal(normalizeDegree(-1), 359);
});

test('omitting labels permits more compact angular spacing', () => {
  const source = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`p${i}`, 20]));
  const withLabels = layoutPlanetSymbols(source, inner, outer, width, height, true);
  const withoutLabels = layoutPlanetSymbols(source, inner, outer, width, height, false);
  const maxDrift = positions => Math.max(...Object.values(positions).map(p => angularDistance(p.displayDegree, 20)));
  assert.ok(maxDrift(withoutLabels) < maxDrift(withLabels));
});
