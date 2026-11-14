import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/renderers/moduli/house-cusps.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { unwrapHouseCusps } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));

test('canonical house cusps preserve clockwise order across the 0° seam', () => {
  for (const first of [0, 15, 70, 180, 350]) {
    const input = Array.from({ length: 12 }, (_, index) => (first + index * 30) % 360);
    const copy = [...input];
    assert.deepEqual(unwrapHouseCusps(input),
      Array.from({ length: 12 }, (_, index) => first + index * 30));
    assert.deepEqual(input, copy, 'must not mutate ephemeris source');
  }
});

test('returns a distinct array and preserves already-unwrapped house longitudes', () => {
  const house = Array.from({ length: 12 }, (_, index) => 350 + index * 30);
  const result = unwrapHouseCusps(house);
  assert.deepEqual(result, house);
  assert.notStrictEqual(result, house);
});

test('reconciles mixed angular frames instead of producing backwards cusps', () => {
  const house = [725, 15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315];
  assert.deepEqual(unwrapHouseCusps(house),
    [725, 735, 765, 795, 825, 855, 885, 915, 945, 975, 1005, 1035]);
});

test('rejects missing, nonfinite or incorrectly sized cusp sets', () => {
  for (const house of [null, undefined, {}, [], [0], Array(13).fill(0),
    Array(12).fill(NaN), [...Array(11).fill(0), Infinity],
    [...Array(11).fill(0), '30'], Array(12)]) {
    assert.throws(() => unwrapHouseCusps(house), { name: 'TypeError' });
  }
});

test('each of the three house-ring renderers uses the shared cusp helper', () => {
  const renderer = readFileSync(new URL('../src/lib/renderers/moduli/case.renderer.ts', import.meta.url), 'utf8');
  assert.match(renderer, /import \{ unwrapHouseCusps \} from '\.\/house-cusps';/);
  assert.equal((renderer.match(/const casePos = unwrapHouseCusps\(caseObj\.house\);/g) ?? []).length, 3);
  assert.equal((renderer.match(/if \(!Number\.isFinite\(caseObj\.ascendant\)\)/g) ?? []).length, 3);
  assert.equal((renderer.match(/if \(!Number\.isFinite\(degOffs\)\)/g) ?? []).length, 3);
  assert.doesNotMatch(renderer, /casePos\.push\(caseObj\.house\[0\]\)/);
});


test('rejects cusp arrays requiring more than one zodiac revolution', () => {
  for (const house of [
    [0, 355, 1, 4, 5, 7, 8, 9, 10, 11, 12, 13],
    [0, 359, 0, 359, 0, 359, 0, 359, 0, 359, 0, 359],
  ]) {
    assert.throws(() => unwrapHouseCusps(house), { name: 'RangeError', message: /one finite 360-degree revolution/ });
  }
});

test('rejects arithmetic overflow and never returns nonfinite angles', () => {
  assert.throws(
    () => unwrapHouseCusps([Number.MAX_VALUE, -Number.MAX_VALUE, ...Array(10).fill(0)]),
    { name: 'RangeError' },
  );
  const cusp = unwrapHouseCusps(Array.from({ length: 12 }, (_, index) => (350 + index * 30) % 360));
  assert.ok(cusp.every(Number.isFinite));
});


test('normalizes higher and negative input frames without changing a valid house ring', () => {
  const higher = [0, 390, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
  const negative = [350, 380, -310, -280, -250, -220, -190, -160, -130, -100, -70, -40];
  const higherSnapshot = [...higher];
  const negativeSnapshot = [...negative];
  assert.deepEqual(unwrapHouseCusps(higher),
    Array.from({ length: 12 }, (_, i) => i * 30));
  assert.deepEqual(unwrapHouseCusps(negative),
    Array.from({ length: 12 }, (_, i) => 350 + i * 30));
  assert.deepEqual(higher, higherSnapshot);
  assert.deepEqual(negative, negativeSnapshot);
});


test('normalization is invariant under deterministic per-cusp revolution shifts', () => {
  // Generate distinct valid house wheels with unequal sectors and arbitrary
  // negative/positive 360° input frames, including a shifted first cusp.
  let state = 0x05eed123;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let sample = 0; sample < 256; sample++) {
    const first = Math.floor(random() * 360000) / 1000;
    const widths = Array.from({ length: 12 }, () => 1 + Math.floor(random() * 72));
    const widthSum = widths.reduce((sum, width) => sum + width, 0);
    const reference = [first];
    for (let index = 1; index < 12; index++) {
      reference.push(reference[index - 1] + widths[index - 1] * 360 / widthSum);
    }
    const firstFrame = Math.floor(random() * 15) - 7;
    const input = Object.freeze(reference.map((longitude, index) => {
      const frame = index === 0 ? firstFrame : Math.floor(random() * 15) - 7;
      return ((longitude % 360) + 360) % 360 + frame * 360;
    }));
    const actual = unwrapHouseCusps(input);
    for (let index = 0; index < 12; index++) {
      const expected = reference[index] + firstFrame * 360;
      assert.ok(Math.abs(actual[index] - expected) < 1e-9,
        `sample ${sample}, house ${index + 1}: ${actual[index]} versus ${expected}`);
    }
    assert.ok(actual[11] - actual[0] < 360);
  }
});
