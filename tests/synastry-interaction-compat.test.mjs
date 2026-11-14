import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function compile(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  return ts.transpileModule(source, {
    fileName: path, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
}
function load(compiled, dependencies) {
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(
    name => {
      assert.ok(Object.hasOwn(dependencies, name), 'Unexpected dependency: ' + name);
      return dependencies[name];
    }, module, module.exports,
  );
  return module.exports;
}

const cusp = load(compile('../src/lib/renderers/moduli/house-cusps.ts'), {});
const { unwrapHouseCusps } = cusp;
const celestial = load(compile('../src/lib/renderers/moduli/elementi-celesti.renderer.ts'), {
  three: {},
  gsap: {},
  '../oggetti-semplici.renderer': {},
  '../_colori.config': {},
  '../@skin-manager': {},
  '../scene-animations': {},
  '../scene-resources': {},
  '../planet-layout': {},
});

const otherHouses = {
  placido: {
    ascendant: 55, mc: 150,
    house: Array.from({ length: 12 }, (_, i) => i * 30),
  },
};
const createTheme = houses => ({
  planets: { Sun: { longitude: 11 } },
  ...(houses === undefined ? {} : { houses }),
});
function graphOptions(system) {
  return {
    mostraEffemeridi: false, effemeridiGrafiche: false, mostraMonomeri: false,
    settaggi: {
      skin_id: 'synthetic', domificazione_selezionata: system,
      transaturnini_se_congiunti: false,
      elementi_celesti: Object.fromEntries(
        ['Sun', 'AS', 'DS', 'MC', 'IC'].map(name => [name, { att: true, orb: 5 }]),
      ),
    },
  };
}
const actualBodies = (theme, system) =>
  celestial.ElementiCelestiRender.getElementiCelesti(theme, graphOptions(system), true);

function renderer({ validate = unwrapHouseCusps, failHouses = false } = {}) {
  const calls = { selected: null, layer: null, planets: 0, cases: 0, signs: 0, cleaned: 0 };
  class Group {
    children = [];
    add(child) { this.children.push(child); }
    traverse(callback) { calls.cleaned++; callback(this); }
  }
  const three = { Group, MathUtils: { degToRad: x => x * Math.PI / 180 } };
  const modules = {
    three,
    gsap: {},
    '../oggetti-semplici.renderer': {
      OggettiSempliciRender: {
        getSemiArcoGrosso: () => ({ kind: 'texture', position: { z: 0 } }),
      },
    },
    './elementi-celesti.renderer': {
      ElementiCelestiRender: {
        getAnelloElementiCelesti: async (...args) => {
          calls.planets++;
          calls.selected = args[0];
          calls.layer = args.at(-1);
          return { kind: 'planets' };
        },
      },
    },
    './case.renderer': {
      CaseRender: {
        getAnelloCaseCartaAstrale: async () => {
          calls.cases++;
          if (failHouses) throw new Error('Synthetic case rendering failure');
          return { kind: 'houses' };
        },
      },
    },
    './house-cusps': { unwrapHouseCusps: validate },
    './segni.renderer': {
      SegniRender: {
        getAnelloSegniSinastria: async () => { calls.signs++; return { kind: 'signs' }; },
      },
    },
    '../@skin-manager': {
      SkinManager: { skins: { synthetic: { anelloCase: { texture: 'test-texture' } } } },
    },
    '../scene-animations': { stopSceneAnimations: () => {} },
    '../@carta-astrale/carta-astrale.renderer': {},
  };
  const SinastriaRender = load(
    compile('../src/lib/renderers/moduli/sinastria.renderer.ts'), modules,
  ).SinastriaRender;
  return { calls, draw: (theme, system) =>
    SinastriaRender.getAnelloSinastria(
      theme, 15, [], { opzioni: graphOptions(system) },
      160, 140, 120, 110, 100, 130,
    ) };
}

test('missing selected houses preserve synastry interaction layer without phantom axes', async () => {
  const { calls, draw } = renderer();
  const theme = createTheme(otherHouses);
  const original = structuredClone(theme);
  const ring = await draw(theme, 'egizia');
  assert.deepEqual(ring.children.map(x => x.kind), ['texture', 'planets', 'signs']);
  assert.equal(calls.cases, 0);
  assert.equal(calls.planets, 1);
  assert.equal(calls.layer, 'synastry');
  assert.deepEqual(actualBodies(calls.selected, 'egizia'), { Sun: theme.planets.Sun });
  assert.deepEqual(calls.selected.houses, {});
  assert.strictEqual(calls.selected.planets, theme.planets);
  assert.deepEqual(theme, original);
});

test('valid selected houses retain authentic AS/DS/MC/IC and the synastry layer', async () => {
  const { calls, draw } = renderer();
  const theme = createTheme(otherHouses);
  const ring = await draw(theme, 'placido');
  assert.deepEqual(ring.children.map(x => x.kind), ['planets', 'signs', 'houses']);
  assert.equal(calls.cases, 1);
  assert.equal(calls.layer, 'synastry');
  assert.strictEqual(calls.selected, theme);
  const bodies = actualBodies(calls.selected, 'placido');
  assert.deepEqual([bodies.AS.longitude, bodies.DS.longitude,
    bodies.MC.longitude, bodies.IC.longitude], [55, 235, 150, 330]);
});

test('invalid finite sectors keep the synastry layer but suppress house geometry', async () => {
  const { calls, draw } = renderer();
  const house = [0, 355, 1, 4, 5, 7, 8, 9, 10, 11, 12, 13];
  const theme = createTheme({ egizia: { ascendant: 0, mc: 90, house } });
  const snapshot = structuredClone(theme);
  assert.throws(() => unwrapHouseCusps(house), { name: 'RangeError' });
  const ring = await draw(theme, 'egizia');
  assert.deepEqual(ring.children.map(x => x.kind), ['texture', 'planets', 'signs']);
  assert.deepEqual(calls.selected.houses, {});
  assert.equal(calls.layer, 'synastry');
  assert.equal(calls.cases, 0);
  assert.deepEqual(theme, snapshot);
});

test('valid zero-degree axes keep the interactive house ring', async () => {
  const { calls, draw } = renderer();
  const theme = createTheme({
    egizia: { ascendant: 0, mc: 0, house: Array.from({ length: 12 }, (_, i) => i * 30) },
  });
  const ring = await draw(theme, 'egizia');
  assert.deepEqual(ring.children.map(x => x.kind), ['planets', 'signs', 'houses']);
  assert.equal(calls.layer, 'synastry');
  assert.strictEqual(calls.selected, theme);
});

test('unexpected validation failures reject and clean up without drawing planets', async () => {
  const error = new Error('Unexpected synthetic validator error');
  const { calls, draw } = renderer({ validate: () => { throw error; } });
  await assert.rejects(draw(createTheme(otherHouses), 'placido'), actual => actual === error);
  assert.equal(calls.cleaned, 1);
  assert.equal(calls.cases, 0);
  assert.equal(calls.planets, 0);
  assert.equal(calls.signs, 0);
});

test('case-render failure still triggers cleanup and does not register stale planet glyphs', async () => {
  const { calls, draw } = renderer({ failHouses: true });
  await assert.rejects(draw(createTheme(otherHouses), 'placido'),
    /Synthetic case rendering failure/);
  assert.equal(calls.cleaned, 1);
  assert.equal(calls.planets, 0);
  assert.equal(calls.layer, null);
});
