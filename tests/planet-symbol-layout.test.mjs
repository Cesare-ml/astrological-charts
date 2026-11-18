import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Bundle the geometry-only TypeScript helper to exercise precisely the code
// the Three.js renderer imports, with no DOM or original artwork required.
const bundle = await build({ entryPoints: ['src/lib/renderers/moduli/planet-symbol-layout.ts'],
  bundle: true, write: false, platform: 'node', format: 'esm', target: 'es2022' });
const { layoutPlanetSymbols, layoutCompositePlanetSymbols, normalizeDegree, degreeWithinSign } =
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

const inner = 1.43, outer = 1.83, width = 0.22, height = 0.22 * 605 / 875;

function angularDistance(a, b) {
  return Math.abs(((a - b + 540) % 360) - 180);
}

test('composite layout is deterministic and never introduces a third orbit', () => {
  const transitInner = 4.5723 / 2, transitOuter = 4.5723 * 146.64 / 120 / 2;
  const compositeWidth = 0.17, compositeHeight = 0.17 * 605 / 875;
  for (let seed = 1; seed <= 60; seed++) {
    const bodies = Object.fromEntries(Array.from({length: 16}, (_, i) => [
      `body${i}`, (i < 8 ? seed * 13 + i * 0.35 : seed * 11 + i * 137.5) % 360,
    ]));
    const shuffled = Object.fromEntries(Object.entries(bodies).reverse());
    const protectedAxisDegrees = [seed * 13 % 360, (seed * 13 + 270) % 360];
    const args = [transitInner, transitOuter, compositeWidth, compositeHeight, seed * 29,
      { protectedAxisDegrees }];
    const positions = layoutCompositePlanetSymbols(bodies, ...args);
    assert.deepEqual(positions, layoutCompositePlanetSymbols(shuffled, ...args),
      `seed ${seed}: order of input keys should not change positions`);
    assert.ok(new Set(Object.values(positions).map(position => position.radius.toFixed(8))).size <= 2);
    const boxes = Object.values(positions).map(position => {
      const angle = (seed * 29 + position.displayDegree) * Math.PI / 180;
      return {x: -Math.sin(angle) * position.radius, y: Math.cos(angle) * position.radius};
    });
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      assert.ok(Math.abs(a.x - b.x) >= compositeWidth ||
        Math.abs(a.y - b.y) >= compositeHeight, `seed ${seed}: glyphs overlap`);
    }
  }
});

test('isolated transiting planets sit on the orbit closest to the external degree ruler', () => {
  const gridRadius = 4.5723 / 2;
  const positions = layoutCompositePlanetSymbols({Sun: 80, Saturn: 210},
    gridRadius, gridRadius * 146.64 / 120, 0.17, 0.17 * 605 / 875,
    90, {preferInnerOrbit: true});
  const preferredRadius = gridRadius + 0.08 + 0.17 / 2 + 0.015 + 0.012;
  for (const [name, position] of Object.entries(positions)) {
    assert.ok(Math.abs(position.radius - preferredRadius) < 1e-8,
      `${name}: isolated transit should be beside the ruler, not on the far rim`);
  }
});

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

test('bounded natal layout never shifts a glyph more than three degrees or overlaps its neighbours', () => {
  const natalInner = 4.5723 * 67.1 / 120 / 2 + 0.055;
  const natalOuter = 4.5723 * 103 / 120 / 2 - 0.085;
  const options = { maxAngularDisplacement: 3, labelWidth: 0.17,
    labelHeight: 0.10, labelTangentOffset: 0.205 };
  const clusters = [
    { Sun: 358.4, Moon: 359.1, Mercury: 0.3, Venus: 1.2, Mars: 2.4 },
    Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`p${i}`, 359.7])),
    { Sun: 12, Moon: 12.01, Mercury: 12.1, Venus: 12.2, Mars: 12.4,
      Jupiter: 12.5, Saturn: 12.6 },
  ];
  for (const rotation of [0, 45, 90, 135, 180, 240, 315]) for (const source of clusters) {
    const result = layoutPlanetSymbols(source, natalInner, natalOuter,
      width, height, true, rotation, options);
    assert.deepEqual(Object.keys(result).sort(), Object.keys(source).sort());
    const objects = [];
    for (const [name, position] of Object.entries(result)) {
      const drift = angularDistance(position.displayDegree, source[name]);
      assert.ok(drift <= 3 + 1e-8, `rotation ${rotation}: ${name} drift ${drift}`);
      const scale = position.scale ?? 1;
      assert.ok(scale > 0, 'crowded glyph remains visible');
      assert.ok(position.radius > natalInner && position.radius < natalOuter,
        `${name}: radial placement outside the celestial band`);
      const radians = (rotation + position.displayDegree) * Math.PI / 180;
      const x = -Math.sin(radians) * position.radius;
      const y = Math.cos(radians) * position.radius;
      objects.push({ name, x, y, w: width * scale, h: height * scale });
      objects.push({ name, x: x - Math.cos(radians) * options.labelTangentOffset * scale,
        y: y - Math.sin(radians) * options.labelTangentOffset * scale,
        w: options.labelWidth * scale, h: options.labelHeight * scale });
    }
    for (let i = 0; i < objects.length; i++) for (let j = i + 1; j < objects.length; j++) {
      const a = objects[i], b = objects[j];
      if (a.name === b.name) continue;
      const dx = (a.w + b.w) / 2 - Math.abs(a.x - b.x);
      const dy = (a.h + b.h) / 2 - Math.abs(a.y - b.y);
      assert.ok(dx <= 0 || dy <= 0, `rotation ${rotation}: ${a.name}/${b.name} collision`);
    }
  }
});

test('three nearly coincident glyphs prefer two sign-side positions and one house-side position', () => {
  const options = {maxAngularDisplacement: 5, fixedTwoLanes: true,
    isolatedScale: 0.24 / 0.18, isolatedRadialInset: 0.05,
    labelWidth: 0.13, labelHeight: 0.075, labelRadialOffset: 0.152,
    houseTickInnerRadius: 1.278, houseTickOuterRadius: 1.338};
  const source = {SouthNode: 25, Mars: 25.8, Jupiter: 26.4};
  for (const rotation of [0, 30, 45, 90, 135, 180, 270]) {
    const result = layoutPlanetSymbols(source, 1.293, 1.947,
      0.18, 0.18 * 605 / 875, true, rotation, options);
    assert.equal(result.Mars.radius, result.SouthNode.radius,
      `rotation ${rotation}: Mars and South Node should share the zodiac-side lane`);
    assert.ok(result.Jupiter.radius < result.Mars.radius,
      `rotation ${rotation}: only Jupiter should use the house-side lane`);
    for (const [key, degree] of Object.entries(source)) {
      assert.ok(angularDistance(result[key].displayDegree, degree) <= 5,
        `${key} must remain within the natal display-angle tolerance`);
      assert.equal(result[key].scale, 1, 'the actual three-body conjunction remains compact');
    }
  }
});

test('two distinct bodies retain full isolated size whenever their actual glyphs fit', () => {
  const options = {maxAngularDisplacement: 5, fixedTwoLanes: true,
    isolatedScale: 0.24 / 0.18, isolatedRadialInset: 0.05,
    labelWidth: 0.13, labelHeight: 0.075, labelRadialOffset: 0.152,
    houseTickInnerRadius: 1.278, houseTickOuterRadius: 1.338};
  for (const source of [{Mercury: 7, Venus: 23}, {Saturn: 1, Neptune: 8}]) {
    for (const rotation of [0, 45, 90, 135, 180, 270]) {
      const result = layoutPlanetSymbols(source, 1.293, 1.947,
        0.18, 0.18 * 605 / 875, true, rotation, options);
      for (const name of Object.keys(source)) {
        assert.equal(result[name].scale, 0.24 / 0.18,
          `rotation ${rotation}: ${name} should not be shrunken solely by angular proximity`);
        assert.ok(angularDistance(result[name].displayDegree, source[name]) <= 5);
      }
    }
  }
});
