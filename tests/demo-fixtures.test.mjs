import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

// Transpile the real demo fixture module, rather than reimplementing its
// angular math in a test-only copy. TemaRender is a type-only dependency.
const source = readFileSync(new URL('../demo/fixtures.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022},
});
const {demoBodies, makeDemoTheme} = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled.outputText).toString('base64')
);

const mod360 = angle => ((angle % 360) + 360) % 360;
const angles = theme => [
  theme.as, theme.ds, theme.mc, theme.ic,
  ...Object.values(theme.planets).map(body => body.longitude),
  theme.houses.egizia.ascendant, theme.houses.egizia.mc,
  theme.houses.egizia.vertex, ...theme.houses.egizia.house,
];

test('the three shipped demo fixtures retain their exact chart longitudes', () => {
  for (const offset of [0, 24, 71]) {
    const theme = makeDemoTheme(offset);
    const asc = (20 + offset) % 360;
    const mc = (290 + offset) % 360;
    assert.equal(theme.as, asc);
    assert.equal(theme.mc, mc);
    assert.equal(theme.ds, (asc + 180) % 360);
    assert.equal(theme.ic, (mc + 180) % 360);
    assert.deepEqual(Object.values(theme.planets).map(body => body.longitude),
      [15, 75, 42, 103, 135, 195, 255, 278, 308, 338].map(n => (n + offset) % 360));
    assert.deepEqual(theme.houses.egizia.house,
      Array.from({length: 12}, (_, i) => (asc + i * 30) % 360));
  }
});

test('positive and negative offsets keep every longitude in [0, 360)', () => {
  for (const offset of [-730, -390, -90, -0.5, 0, 24, 71, 450, 720, 1000000]) {
    const theme = makeDemoTheme(offset);
    assert.equal(demoBodies.length, 10);
    assert.equal(Object.keys(theme.planets).length, 10);
    assert.equal(theme.houses.egizia.house.length, 12);
    for (const angle of angles(theme)) {
      assert.ok(Number.isFinite(angle) && angle >= 0 && angle < 360,
        `offset ${offset} produced invalid longitude ${angle}`);
    }
    assert.equal(theme.ds, mod360(theme.as + 180));
    assert.equal(theme.ic, mod360(theme.mc + 180));
    for (let i = 0; i < 12; i++) {
      assert.equal(theme.houses.egizia.house[i], mod360(theme.as + i * 30));
    }
  }
});

test('non-finite and nonnumeric offsets fail before building invalid geometry', () => {
  for (const offset of [NaN, Infinity, -Infinity, undefined, null, '24']) {
    assert.throws(() => makeDemoTheme(offset), {
      name: 'TypeError', message: 'Demo chart offset must be a finite number',
    });
  }
});

test('all demo themes remain separate synthetic input objects', () => {
  const one = makeDemoTheme(-90);
  const two = makeDemoTheme(-90);
  assert.notStrictEqual(one, two);
  assert.notStrictEqual(one.planets, two.planets);
  assert.notStrictEqual(one.houses, two.houses);
  one.planets.Sun.longitude = 123;
  assert.notEqual(one.planets.Sun.longitude, two.planets.Sun.longitude);
  assert.equal(one.dataora, '2000-01-01T12:00:00Z');
  assert.equal(one.australInversion, false);
});
