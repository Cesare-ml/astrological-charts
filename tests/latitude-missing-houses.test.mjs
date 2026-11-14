import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

// Exercise the actual latitude scene method, without requiring a GPU or
// artwork. The rest of the Three.js render pipeline is replaced by probes.
const source = readFileSync(
  new URL('../src/lib/renderers/@carta-astrale/latitudini.renderer.ts', import.meta.url),
  'utf8',
);
const parsed = ts.createSourceFile('latitudini.renderer.ts', source, ts.ScriptTarget.Latest, true);
const rendererClass = parsed.statements.find(
  node => ts.isClassDeclaration(node) && node.name?.text === 'LatitudiniRender',
);
assert.ok(rendererClass, 'LatitudiniRender class must exist');
const sceneMethod = rendererClass.members.find(
  node => ts.isMethodDeclaration(node) && node.name?.getText(parsed) === 'creaScena',
);
assert.ok(sceneMethod, 'LatitudiniRender.creaScena method must exist');

const isolatedSource = `class LatitudiniRender {
  static lr = null;
  ${sceneMethod.getText(parsed)}
  async getAnelloElementiCelesti() {
    calls.planets++;
    return {kind: 'planets'};
  }
}`;
const isolatedJs = ts.transpileModule(isolatedSource, {
  compilerOptions: {module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022},
}).outputText;

function buildHarness() {
  const calls = {houses: [], ascendants: [], planets: 0};
  class Group {
    constructor() {
      this.children = [];
      this.rotation = {y: 0};
    }
    add(child) {
      this.children.push(child);
    }
  }
  const CaseRender = {
    async getAnelloCaseLatitudini(houses) {
      calls.houses.push(houses);
      return {kind: 'houses'};
    },
  };
  const SegniRender = {
    async getAnelloSegni(ascendant) {
      calls.ascendants.push(ascendant);
      return {kind: 'signs'};
    },
  };
  const AspettiRender = {
    async getBackgroundAspetti() {
      return {kind: 'background'};
    },
  };
  const Renderer = new Function(
    'THREE', 'CaseRender', 'SegniRender', 'AspettiRender', 'calls',
    isolatedJs + '\nreturn LatitudiniRender;',
  )({Group}, CaseRender, SegniRender, AspettiRender, calls);
  return {Renderer, calls};
}

const validHouses = {
  ascendant: 42,
  mc: 225,
  house: Array.from({length: 12}, (_, index) => (42 + index * 30) % 360),
};
function options(selected = 'egizia', ephemerides = false) {
  return {
    settaggi: {domificazione_selezionata: selected},
    mostraEffemeridi: ephemerides,
    effemeridiGrafiche: ephemerides ? {} : null,
    mostraTransiti: false,
  };
}
async function renderWith(houses, settings = options(), {australInversion = false, transits = null} = {}) {
  const {Renderer, calls} = buildHarness();
  const theme = {houses, australInversion};
  const scene = await Renderer.creaScena(theme, transits, null, settings);
  return {scene, calls, theme};
}

test('latitude renders planets and signs if another house system exists but selected one is absent', async () => {
  const houses = {placido: validHouses};
  const {scene, calls, theme} = await renderWith(houses);
  assert.equal(calls.houses.length, 0);
  assert.deepEqual(calls.ascendants, [0]);
  assert.equal(calls.planets, 1);
  assert.deepEqual(scene.children.map(child => child.kind), ['background', 'signs', 'planets']);
  assert.equal(theme.houses, houses, 'rendering must not mutate the input');
});

test('latitude retains selected house ring and exact ascendant when present', async () => {
  const houses = {egizia: validHouses, placido: {...validHouses, ascendant: 70}};
  const {scene, calls} = await renderWith(houses);
  assert.equal(calls.houses.length, 1);
  assert.equal(calls.houses[0], houses, 'pass the original houses object to the house renderer');
  assert.deepEqual(calls.ascendants, [42]);
  assert.deepEqual(scene.children.map(child => child.kind), ['houses', 'background', 'signs', 'planets']);
});

test('empty or missing house collections preserve the existing no-houses behavior', async () => {
  for (const houses of [{}, undefined]) {
    const {scene, calls} = await renderWith(houses);
    assert.equal(calls.houses.length, 0);
    assert.deepEqual(calls.ascendants, [0]);
    assert.equal(calls.planets, 1);
    assert.deepEqual(scene.children.map(child => child.kind), ['background', 'signs', 'planets']);
  }
});


test('an exact 0-degree ascendant is valid and retains its house ring', async () => {
  const houses = {egizia: {...validHouses, ascendant: 0, house: Array.from({length: 12}, (_, i) => i * 30)}};
  const {scene, calls} = await renderWith(houses);
  assert.equal(calls.houses.length, 1);
  assert.deepEqual(calls.ascendants, [0]);
  assert.deepEqual(scene.children.map(child => child.kind), ['houses', 'background', 'signs', 'planets']);
});

test('an invalid ascendant or nonnumeric cusp skips unsafe house geometry', async () => {
  const broken = [
    {...validHouses, ascendant: Number.NaN},
    {...validHouses, ascendant: Infinity},
    {...validHouses, ascendant: '42'},
    {...validHouses, house: [...validHouses.house.slice(0, 11), Number.NaN]},
    {...validHouses, house: [...validHouses.house.slice(0, 11), undefined]},
    {...validHouses, house: [...validHouses.house.slice(0, 11), '0']},
  ];
  for (const candidate of broken) {
    const houses = {egizia: candidate};
    const {scene, calls, theme} = await renderWith(houses);
    assert.equal(calls.houses.length, 0, 'invalid selected system must not reach house ring');
    assert.deepEqual(calls.ascendants, [0]);
    assert.equal(calls.planets, 1);
    assert.deepEqual(scene.children.map(child => child.kind), ['background', 'signs', 'planets']);
    assert.equal(theme.houses, houses);
  }
});

test('short and sparse cusp arrays are rejected, rather than yielding NaN rotations', async () => {
  const sparse = Array.from({length: 12}, (_, i) => (42 + i * 30) % 360);
  delete sparse[5];
  for (const house of [[], validHouses.house.slice(0, 11), sparse, null, {}]) {
    const {scene, calls} = await renderWith({egizia: {...validHouses, house}});
    assert.equal(calls.houses.length, 0);
    assert.deepEqual(calls.ascendants, [0]);
    assert.deepEqual(scene.children.map(child => child.kind), ['background', 'signs', 'planets']);
  }
});

test('inherited selected house systems do not create phantom house rings', async () => {
  const houses = Object.create({egizia: validHouses});
  // The legacy direct property lookup would treat this as selected data.
  assert.equal(houses.egizia, validHouses);
  assert.equal(Object.prototype.hasOwnProperty.call(houses, 'egizia'), false);
  const {scene, calls, theme} = await renderWith(houses);
  assert.equal(calls.houses.length, 0);
  assert.deepEqual(calls.ascendants, [0]);
  assert.equal(calls.planets, 1);
  assert.deepEqual(scene.children.map(child => child.kind), ['background', 'signs', 'planets']);
  assert.equal(theme.houses, houses, 'must not mutate the input');
});

test('own selected house system in a null-prototype collection still renders', async () => {
  const houses = Object.assign(Object.create(null), {egizia: validHouses});
  assert.equal(Object.getPrototypeOf(houses), null);
  const {scene, calls} = await renderWith(houses);
  assert.equal(calls.houses.length, 1);
  assert.equal(calls.houses[0], houses);
  assert.deepEqual(calls.ascendants, [42]);
  assert.deepEqual(scene.children.map(child => child.kind), ['houses', 'background', 'signs', 'planets']);
});

test('an inherited cusp cannot disguise a sparse selected house array', async () => {
  const house = [...validHouses.house];
  delete house[5];
  const withInheritedCusp = Object.create(Array.prototype);
  withInheritedCusp[5] = validHouses.house[5];
  Object.setPrototypeOf(house, withInheritedCusp);

  // Reading the missing index returns an inherited finite value. It must
  // still count as absent: otherwise the case renderer sees a phantom cusp.
  assert.equal(Number.isFinite(house[5]), true);
  assert.equal(Object.prototype.hasOwnProperty.call(house, 5), false);
  const {scene, calls} = await renderWith({egizia: {...validHouses, house}});
  assert.equal(calls.houses.length, 0);
  assert.deepEqual(calls.ascendants, [0]);
  assert.deepEqual(scene.children.map(child => child.kind), ['background', 'signs', 'planets']);
});

test('null house collections and null selected entries retain the no-houses fallback', async () => {
  for (const houses of [null, {egizia: null}]) {
    const {scene, calls} = await renderWith(houses);
    assert.equal(calls.houses.length, 0);
    assert.deepEqual(calls.ascendants, [0]);
    assert.deepEqual(scene.children.map(child => child.kind), ['background', 'signs', 'planets']);
  }
});


test('missing selected houses keeps transit latitude markers and austral inversion', async () => {
  const houses = {placido: validHouses};
  const settings = {...options(), mostraTransiti: true};
  const transits = {planets: {Sun: {longitude: 75, latitude: -1}}};
  const {scene, calls, theme} = await renderWith(
    houses, settings, {australInversion: true, transits},
  );
  assert.equal(calls.houses.length, 0);
  assert.deepEqual(calls.ascendants, [0]);
  assert.equal(calls.planets, 2, 'natal and transit latitude markers must both render');
  assert.deepEqual(scene.children.map(child => child.kind), [
    'background', 'planets', 'signs', 'planets',
  ]);
  assert.equal(scene.rotation.y, Math.PI, 'south-hemisphere chart must retain inversion');
  assert.equal(theme.houses, houses);
});

test('valid selected houses keep the transit rings and austral inversion', async () => {
  const settings = {...options(), mostraTransiti: true};
  const {scene, calls} = await renderWith(
    {egizia: validHouses}, settings, {australInversion: true, transits: {planets: {}}},
  );
  assert.equal(calls.houses.length, 1);
  assert.deepEqual(calls.ascendants, [42]);
  assert.equal(calls.planets, 2);
  assert.deepEqual(scene.children.map(child => child.kind), [
    'houses', 'background', 'planets', 'signs', 'planets',
  ]);
  assert.equal(scene.rotation.y, Math.PI);
});

test('transit setting without a transit theme does not create phantom markers', async () => {
  const settings = {...options(), mostraTransiti: true};
  const {scene, calls} = await renderWith({placido: validHouses}, settings);
  assert.equal(calls.planets, 1);
  assert.deepEqual(scene.children.map(child => child.kind), ['background', 'signs', 'planets']);
});

test('ephemerides mode ignores the selected house system even when available', async () => {
  const {scene, calls} = await renderWith({egizia: validHouses}, options('egizia', true));
  assert.equal(calls.houses.length, 0);
  assert.deepEqual(calls.ascendants, [0]);
  assert.equal(calls.planets, 1);
  assert.deepEqual(scene.children.map(child => child.kind), ['background', 'signs', 'planets']);
});
