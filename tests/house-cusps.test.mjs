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
