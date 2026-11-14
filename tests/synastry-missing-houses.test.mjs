import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Transpile the actual source; Three.js and other visual modules are replaced
// with deterministic fakes so no WebGL context or copyrighted assets are used.
const source = readFileSync(
  new URL('../src/lib/renderers/moduli/sinastria.renderer.ts', import.meta.url),
  'utf8',
);
const { outputText } = ts.transpileModule(source, {
  fileName: 'sinastria.renderer.ts',
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
});

// Exercise the actual celestial selection logic, rather than inferring the
// absence of phantom axes only from the shallow fallback chart's shape.
const celestialSource = readFileSync(
  new URL('../src/lib/renderers/moduli/elementi-celesti.renderer.ts', import.meta.url),
  'utf8',
);
const celestialOutput = ts.transpileModule(celestialSource, {
  fileName: 'elementi-celesti.renderer.ts',
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText;
const celestialModule = { exports: {} };
const celestialDependencies = new Set([
  'three', 'gsap', '../oggetti-semplici.renderer', '../_colori.config',
  '../@skin-manager', '../scene-animations',
]);
new Function('require', 'module', 'exports', celestialOutput)(
  name => {
    if (!celestialDependencies.has(name)) throw new Error('Unexpected celestial dependency: ' + name);
    return {};
  },
  celestialModule,
  celestialModule.exports,
);
const RealCelestialRender = celestialModule.exports.ElementiCelestiRender;
function selectedCelestial(theme, selectedSystem) {
  return RealCelestialRender.getElementiCelesti(
    theme,
    {
      mostraEffemeridi: false,
      effemeridiGrafiche: false,
      mostraMonomeri: false,
      settaggi: {
        domificazione_selezionata: selectedSystem,
        transaturniniSeCongiunti: false,
        transaturnini_se_congiunti: false,
        elementi_celesti: Object.fromEntries(
          ['Sun', 'AS', 'DS', 'MC', 'IC'].map(name => [name, { att: true, orb: 5 }]),
        ),
      },
    },
    true,
  );
}

function syntheticRenderer({ texture = 'local-test-texture', failHouses = false } = {}) {
  const calls = { houses: 0, planets: 0, signs: 0, visualTheme: null, selectedAngles: null, cleaned: 0 };
  class Group {
    children = [];
    add(child) { this.children.push(child); }
    traverse(callback) { calls.cleaned += 1; callback(this); }
  }
  const modules = {
    three: { Group, MathUtils: { degToRad: angle => angle * Math.PI / 180 } },
    gsap: {},
    '../oggetti-semplici.renderer': {
      OggettiSempliciRender: {
        getSemiArcoGrosso: () => ({ kind: 'fallback-texture', position: { z: 0 } }),
      },
    },
    './elementi-celesti.renderer': {
      ElementiCelestiRender: {
        getAnelloElementiCelesti: async (theme, angle) => {
          calls.planets++;
          calls.visualTheme = theme;
          calls.selectedAngles = angle;
          return { kind: 'planets' };
        },
      },
    },
    './case.renderer': {
      CaseRender: {
        getAnelloCaseCartaAstrale: async () => {
          calls.houses++;
          if (failHouses) throw new Error('Synthetic case rendering failure');
          return { kind: 'houses' };
        },
      },
    },
    './segni.renderer': {
      SegniRender: {
        getAnelloSegniSinastria: async () => {
          calls.signs++;
          return { kind: 'signs' };
        },
      },
    },
    '../@skin-manager': {
      SkinManager: {
        skins: { synthetic: { anelloCase: { texture, coloreTexture: 'white' } } },
      },
    },
    '../scene-animations': { stopSceneAnimations: () => {} },
    '../@carta-astrale/carta-astrale.renderer': {},
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputText)(
    request => {
      if (!Object.hasOwn(modules, request)) throw new Error('Unexpected dependency: ' + request);
      return modules[request];
    },
    module,
    module.exports,
  );
  return { renderer: module.exports.SinastriaRender, calls };
}
const otherHouses = {
  placido: { ascendant: 55, mc: 150, house: Array.from({ length: 12 }, (_, i) => i * 30) },
};
const createTheme = houses => ({ planets: { Sun: { longitude: 11 } }, ...(houses === undefined ? {} : { houses }) });
const state = selection => ({
  opzioni: {
    settaggi: { domificazione_selezionata: selection, skin_id: 'synthetic' },
    mostraDirezioni: false,
  },
});
async function render(renderer, theme, selection = 'egizia') {
  return renderer.getAnelloSinastria(theme, 15, [], state(selection),
    160, 140, 120, 110, 100, 130);
}

test('uses the selected house system when present without changing chart input', async () => {
  const { renderer, calls } = syntheticRenderer();
  const theme = createTheme(otherHouses);
  const result = await render(renderer, theme, 'placido');
  assert.deepEqual(result.children.map(x => x.kind), ['planets', 'signs', 'houses']);
  assert.equal(calls.houses, 1);
  assert.strictEqual(calls.visualTheme, theme);
  assert.equal(calls.visualTheme.houses, otherHouses);
  assert.equal(calls.selectedAngles, 15);
  assert.equal(calls.cleaned, 0);
});

test('missing selected house system renders planet and sign rings without phantom axes', async () => {
  const { renderer, calls } = syntheticRenderer();
  const theme = createTheme(otherHouses);
  const snapshot = structuredClone(theme);
  const result = await render(renderer, theme, 'egizia');
  assert.deepEqual(result.children.map(x => x.kind), ['fallback-texture', 'planets', 'signs']);
  assert.equal(calls.houses, 0);
  assert.equal(calls.planets, 1);
  assert.equal(calls.signs, 1);
  assert.deepEqual(calls.visualTheme.houses, {});
  assert.strictEqual(calls.visualTheme.planets, theme.planets);
  assert.notStrictEqual(calls.visualTheme, theme);
  assert.deepEqual(theme, snapshot);
  assert.equal(calls.selectedAngles, 15);
});

test('incomplete selected house data falls back safely without synthetic axes', async () => {
  const baseCusps = Array.from({ length: 12 }, (_, i) => i * 30);
  const incomplete = [
    null,
    {},
    { ascendant: 30, mc: 100 },
    { ascendant: Number.NaN, mc: 100, house: baseCusps },
    { ascendant: 30, mc: Number.POSITIVE_INFINITY, house: baseCusps },
    { ascendant: 30, mc: 100, house: baseCusps.slice(0, 11) },
    // JavaScript Array.every() skips holes; a missing value cannot be a real cusp.
    { ascendant: 30, mc: 100, house: Array.from({ length: 12 }, (_, i) => i === 4 ? undefined : baseCusps[i]) },
    { ascendant: 30, mc: 100, house: (() => { const cusps = [...baseCusps]; delete cusps[7]; return cusps; })() },
    { ascendant: 30, mc: 100, house: [...baseCusps.slice(0, 8), Number.NaN, ...baseCusps.slice(9)] },
    { ascendant: 30, mc: 100, house: 'not-an-array' },
  ];

  for (const [index, value] of incomplete.entries()) {
    const { renderer, calls } = syntheticRenderer();
    const theme = createTheme({ ...otherHouses, egizia: value });
    const snapshot = structuredClone(theme);
    const result = await render(renderer, theme, 'egizia');
    assert.deepEqual(
      result.children.map(x => x.kind),
      ['fallback-texture', 'planets', 'signs'],
      'Case ' + index + ' must not render invalid cusps',
    );
    assert.equal(calls.houses, 0, 'Case ' + index);
    assert.deepEqual(calls.visualTheme.houses, {}, 'Case ' + index);
    assert.strictEqual(calls.visualTheme.planets, theme.planets, 'Case ' + index);
    assert.deepEqual(theme, snapshot, 'Case ' + index + ' must not mutate input');
  }
});

test('zero-degree ascendant, midheaven and cusp remain valid inputs', async () => {
  const { renderer, calls } = syntheticRenderer();
  const cusps = Array.from({ length: 12 }, (_, i) => i * 30);
  const theme = createTheme({
    egizia: { ascendant: 0, mc: 0, house: cusps },
  });
  const result = await render(renderer, theme, 'egizia');
  assert.deepEqual(result.children.map(x => x.kind), ['planets', 'signs', 'houses']);
  assert.equal(calls.houses, 1);
  assert.strictEqual(calls.visualTheme, theme);
  assert.equal(calls.selectedAngles, 15);
});

test('actual celestial selector confirms why unrelated house systems must be hidden', async () => {
  const theme = createTheme(otherHouses);
  // Before the fix, the raw theme with only "placido" would produce invented
  // axis values at 0° when the user selected "egizia".
  const unguarded = selectedCelestial(theme, 'egizia');
  assert.deepEqual(Object.keys(unguarded), ['Sun', 'AS', 'DS', 'MC', 'IC']);
  assert.equal(unguarded.AS.longitude, 0);
  assert.equal(unguarded.MC.longitude, 0);

  const { renderer, calls } = syntheticRenderer();
  await render(renderer, theme, 'egizia');
  const safe = selectedCelestial(calls.visualTheme, 'egizia');
  assert.deepEqual(Object.keys(safe), ['Sun']);
  assert.deepEqual(theme.houses, otherHouses);
});

test('actual celestial selector retains authentic axes for a valid selected system', async () => {
  const { renderer, calls } = syntheticRenderer();
  await render(renderer, createTheme(otherHouses), 'placido');
  const axes = selectedCelestial(calls.visualTheme, 'placido');
  assert.deepEqual(Object.keys(axes), ['Sun', 'AS', 'DS', 'MC', 'IC']);
  assert.equal(axes.AS.longitude, 55);
  assert.equal(axes.DS.longitude, 235);
  assert.equal(axes.MC.longitude, 150);
  assert.equal(axes.IC.longitude, 330);
});

test('theme without any houses uses the existing texture fallback', async () => {
  const { renderer, calls } = syntheticRenderer();
  const result = await render(renderer, createTheme(undefined));
  assert.deepEqual(result.children.map(x => x.kind), ['fallback-texture', 'planets', 'signs']);
  assert.deepEqual(calls.visualTheme.houses, {});
  assert.equal(calls.houses, 0);
});

test('untextured missing house system leaves no fake case ring', async () => {
  const { renderer, calls } = syntheticRenderer({ texture: null });
  const result = await render(renderer, createTheme(otherHouses));
  assert.deepEqual(result.children.map(x => x.kind), ['planets', 'signs']);
  assert.equal(calls.houses, 0);
});

test('absent synastry theme still returns null without creating rings', async () => {
  const { renderer, calls } = syntheticRenderer();
  assert.equal(await render(renderer, null), null);
  assert.equal(calls.planets, 0);
  assert.equal(calls.houses, 0);
});

test('existing case-render failure still rejects and triggers cleanup', async () => {
  const { renderer, calls } = syntheticRenderer({ failHouses: true });
  await assert.rejects(render(renderer, createTheme(otherHouses), 'placido'),
    /Synthetic case rendering failure/);
  assert.equal(calls.cleaned, 1);
  assert.equal(calls.planets, 0);
});
