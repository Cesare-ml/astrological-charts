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
