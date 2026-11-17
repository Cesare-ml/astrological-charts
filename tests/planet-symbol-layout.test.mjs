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

test('five-body natal conjunction stays visually near its longitude and in zodiacal order', () => {
  const source = { Sun: 358.4, Moon: 359.1, Mercury: 0.3, Venus: 1.2, Mars: 2.4 };
  // This reproduces the default synthetic demo's Aries-point group. The
  // renderer uses a narrow outer glyph orbit and separate degree-label strip.
  const innerGlyphOrbit = 1.962 - 0.235;
  for (const rotation of [0, 35, 70, 90, 135, 180, 270]) {
    const positions = layoutPlanetSymbols(source, innerGlyphOrbit, 1.962, width, height, false, rotation);
    const angles = Object.keys(source).map(name => positions[name].displayDegree);
    assert.ok(Math.max(...angles.map((angle, index) => angularDistance(angle, Object.values(source)[index]))) <= 13,
      `rotation ${rotation}: symbols drifted too far from their real longitudes`);
    const unwrapped = angles.map(angle => angle < 180 ? angle + 360 : angle);
    assert.ok(unwrapped.every((angle, index) => !index || angle >= unwrapped[index - 1] - 1e-7),
      `rotation ${rotation}: planets must not appear in reverse zodiacal order`);
    if (rotation === 70 || rotation === 90) {
      assert.ok(new Set(Object.values(positions).map(position => position.radius.toFixed(4))).size >= 2,
        `rotation ${rotation}: radial staggering must be used where the geometry permits`);
    }
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

test('mixed planetary distributions remain collision-free across deterministic chart rotations', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const source = Object.fromEntries(Array.from({ length: 18 }, (_, i) => [
      `body${i}`,
      (i < 7 ? seed * 11 + i * 1.3 : seed * 11 + i * 137.5) % 360,
    ]));
    const chartRotation = seed * 19;
    const positions = layoutPlanetSymbols(source, inner, outer, width, height, true, chartRotation);
    const rectangles = Object.entries(positions).flatMap(([name, placement]) => {
      const theta = (chartRotation + placement.displayDegree) * Math.PI / 180;
      const x = -Math.sin(theta) * placement.radius;
      const y = Math.cos(theta) * placement.radius;
      return [
        { name, x, y, w: width, h: height },
        { name, x: x - Math.cos(theta) * 0.17, y: y - Math.sin(theta) * 0.17,
          w: 0.12, h: 0.06 },
      ];
    });
    for (let i = 0; i < rectangles.length; i++) for (let j = i + 1; j < rectangles.length; j++) {
      const a = rectangles[i], b = rectangles[j];
      if (a.name === b.name) continue;
      const overlapX = (a.w + b.w) / 2 - Math.abs(a.x - b.x);
      const overlapY = (a.h + b.h) / 2 - Math.abs(a.y - b.y);
      assert.ok(overlapX <= 0 || overlapY <= 0,
        `seed ${seed}: ${a.name}/${b.name} overlap`);
    }
  }
});
