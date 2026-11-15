import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Exercise the actual TypeScript module (not a reimplementation of its math).
const file = resolve('src/lib/renderers/moduli/zodiacal-projections.ts');
const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
  compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS}
}).outputText;
const moduleExports = {};
runInNewContext(compiled, {exports: moduleExports});
const { ZODIAC_REFLECTION_AXES, ZODIAC_TRADITIONAL_PLANETS,
  wrapLongitude, mirroredLongitude, storedDodecatemorion } = moduleExports;

test('Regolo reflection axes are 270/300/330 degrees', () => {
  assert.equal(ZODIAC_REFLECTION_AXES.Cardinale, 270);
  assert.equal(ZODIAC_REFLECTION_AXES.Fissa, 300);
  assert.equal(ZODIAC_REFLECTION_AXES.Mutevole, 330);
  assert.equal(ZODIAC_TRADITIONAL_PLANETS.length, 7);
});

test('single-pole reflection and opposing contra-reflection for every axis', () => {
  for (const [axis, pole] of Object.entries(ZODIAC_REFLECTION_AXES)) {
    for (const longitude of [0, 0.2, 10, 90, 119.5, 150, 270, 329.5, 359.9, -10, 725]) {
      const antiscion = mirroredLongitude(longitude, 'antisci', axis);
      const expected = wrapLongitude(2 * pole - longitude);
      assert.ok(Math.abs(antiscion - expected) < 1e-9, axis);
      assert.ok(Math.abs(mirroredLongitude(longitude, 'contrantisci', axis)
        - wrapLongitude(expected + 180)) < 1e-9);
      assert.ok(Math.abs(mirroredLongitude(antiscion, 'antisci', axis)
        - wrapLongitude(longitude)) < 1e-9);
    }
  }
});

test('known 10° Aries: different antiscion and contra-antiscion destinations', () => {
  assert.equal(mirroredLongitude(10, 'antisci', 'Cardinale'), 170);
  assert.equal(mirroredLongitude(10, 'contrantisci', 'Cardinale'), 350);
  assert.equal(mirroredLongitude(10, 'antisci', 'Fissa'), 230);
  assert.equal(mirroredLongitude(10, 'contrantisci', 'Fissa'), 50);
  assert.equal(mirroredLongitude(10, 'antisci', 'Mutevole'), 290);
  assert.equal(mirroredLongitude(10, 'contrantisci', 'Mutevole'), 110);
});

test('invalid longitudes, axes and kinds do not produce positions', () => {
  assert.equal(wrapLongitude(-10), 350);
  assert.equal(wrapLongitude(360), 0);
  assert.equal(mirroredLongitude(NaN, 'antisci'), null);
  assert.equal(mirroredLongitude(Infinity, 'contrantisci'), null);
  assert.equal(mirroredLongitude(10, 'antisci', 'unknown'), null);
  assert.equal(mirroredLongitude(10, 'unknown', 'Cardinale'), null);
});

test('dodecatemorion uses only stored valid positions', () => {
  assert.equal(storedDodecatemorion({dodecatemoria: {longitude: 370}}), 10);
  assert.equal(storedDodecatemorion({dodecatemoria: {longitude: 0}}), 0);
  assert.equal(storedDodecatemorion({longitude: 40}), null);
  assert.equal(storedDodecatemorion(null), null);
  assert.equal(storedDodecatemorion({dodecatemoria: {longitude: NaN}}), null);
});
