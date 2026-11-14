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
async function renderWith(houses, settings = options()) {
  const {Renderer, calls} = buildHarness();
  const theme = {houses, australInversion: false};
  const scene = await Renderer.creaScena(theme, null, null, settings);
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

test('ephemerides mode ignores the selected house system even when available', async () => {
  const {scene, calls} = await renderWith({egizia: validHouses}, options('egizia', true));
  assert.equal(calls.houses.length, 0);
  assert.deepEqual(calls.ascendants, [0]);
  assert.equal(calls.planets, 1);
  assert.deepEqual(scene.children.map(child => child.kind), ['background', 'signs', 'planets']);
});
