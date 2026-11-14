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
// Use the same helper that the stacked cusp PR ships to the chart renderer.
const cuspSource = readFileSync(
  new URL('../src/lib/renderers/moduli/house-cusps.ts', import.meta.url),
  'utf8',
);
const cuspCompiled = ts.transpileModule(cuspSource, {
  fileName: 'house-cusps.ts',
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const cuspModule = { exports: {} };
new Function('require', 'module', 'exports', cuspCompiled)(
  request => { throw new Error('Unexpected cusp dependency: ' + request); },
  cuspModule,
  cuspModule.exports,
);
const { unwrapHouseCusps } = cuspModule.exports;

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

function syntheticRenderer({ texture = 'local-test-texture', failHouses = false, failSigns = false, validateCusps = unwrapHouseCusps } = {}) {
  const calls = { houses: 0, planets: 0, signs: 0, visualTheme: null, selectedAngles: null, signAngle: null, cleaned: 0, cleanedNodes: [] };
  class Group {
    children = [];
    add(child) { this.children.push(child); }
    traverse(callback) {
      calls.cleaned += 1;
      const visit = object => {
        callback(object);
        for (const child of object.children ?? []) visit(child);
      };
      visit(this);
    }
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
          return { kind: 'planets', children: [{ kind: 'animated-marker' }] };
        },
      },
    },
    './house-cusps': { unwrapHouseCusps: validateCusps },
    './case.renderer': {
      CaseRender: {
        getAnelloCaseCartaAstrale: async () => {
          calls.houses++;
          if (failHouses) throw new Error('Synthetic case rendering failure');
          return { kind: 'houses', children: [{ kind: 'case-image' }] };
        },
      },
    },
    './segni.renderer': {
      SegniRender: {
        getAnelloSegniSinastria: async (angle) => {
          calls.signs++;
          calls.signAngle = angle;
          if (failSigns) throw new Error('Synthetic sign rendering failure');
          return { kind: 'signs' };
        },
      },
    },
    '../@skin-manager': {
      SkinManager: {
        skins: { synthetic: { anelloCase: { texture, coloreTexture: 'white' } } },
      },
    },
    '../scene-animations': { stopSceneAnimations: object => calls.cleanedNodes.push(object.kind ?? 'root') },
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

test('finite but impossible one-revolution house sectors use the safe fallback', async () => {
  const inconsistent = [
    [0, 355, 1, 4, 5, 7, 8, 9, 10, 11, 12, 13],
    [0, 359, 0, 359, 0, 359, 0, 359, 0, 359, 0, 359],
    [Number.MAX_VALUE, -Number.MAX_VALUE, ...Array(10).fill(0)],
  ];
  for (const [index, house] of inconsistent.entries()) {
    assert.throws(() => unwrapHouseCusps(house), {
      name: 'RangeError',
    }, 'House helper must independently reject ' + index);
    const theme = createTheme({
      ...otherHouses,
      egizia: { ascendant: 0, mc: 90, house },
    });
    const original = structuredClone(theme);
    const { renderer, calls } = syntheticRenderer();
    const result = await render(renderer, theme, 'egizia');
    assert.deepEqual(
      result.children.map(item => item.kind),
      ['fallback-texture', 'planets', 'signs'],
      'Cannot render invalid sectors for case ' + index,
    );
    assert.deepEqual(calls.visualTheme.houses, {}, 'No fake angles for case ' + index);
    assert.equal(calls.houses, 0, 'No invalid case ring for ' + index);
    assert.deepEqual(theme, original, 'Do not mutate theme for case ' + index);
  }
});

test('valid mixed angular frames retain their house ring and unchanged source', async () => {
  const house = [725, 15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315];
  assert.deepEqual(unwrapHouseCusps(house),
    [725, 735, 765, 795, 825, 855, 885, 915, 945, 975, 1005, 1035]);
  const theme = createTheme({ egizia: { ascendant: 5, mc: 90, house } });
  const before = structuredClone(theme);
  const { renderer, calls } = syntheticRenderer();
  const result = await render(renderer, theme, 'egizia');
  assert.deepEqual(result.children.map(item => item.kind), ['planets', 'signs', 'houses']);
  assert.equal(calls.houses, 1);
  assert.strictEqual(calls.visualTheme, theme);
  assert.deepEqual(theme, before);
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

test('unexpected cusp validator errors propagate and clean up instead of silently hiding houses', async () => {
  const failure = new Error('Synthetic unexpected validator failure');
  const theme = createTheme(otherHouses);
  const before = structuredClone(theme);
  const { renderer, calls } = syntheticRenderer({
    validateCusps: () => { throw failure; },
  });

  await assert.rejects(render(renderer, theme, 'placido'), actual => actual === failure);
  assert.equal(calls.cleaned, 1, 'Partially built group must be cleaned on failure');
  assert.equal(calls.houses, 0, 'Do not continue to house drawing');
  assert.equal(calls.planets, 0, 'Do not continue to celestial drawing');
  assert.equal(calls.signs, 0, 'Do not continue to zodiac drawing');
  assert.deepEqual(theme, before, 'Validation must never mutate source chart data');
});


test('rejects nonfinite or nonnumeric reference ascendants before drawing', async () => {
  for (const reference of [undefined, null, NaN, Infinity, -Infinity, '15']) {
    const { renderer, calls } = syntheticRenderer();
    const theme = createTheme(otherHouses);
    const snapshot = structuredClone(theme);
    await assert.rejects(
      renderer.getAnelloSinastria(theme, reference, [], state('placido'),
        160, 140, 120, 110, 100, 130),
      { name: 'TypeError', message: /reference ascendant must be a finite longitude/ },
    );
    assert.equal(calls.houses, 0, 'no case geometry should be created');
    assert.equal(calls.planets, 0, 'no planet geometry should be created');
    assert.equal(calls.signs, 0, 'no zodiac geometry should be created');
    assert.equal(calls.cleaned, 1, 'failure must traverse the temporary scene for cleanup');
    assert.deepEqual(theme, snapshot, 'caller theme must not be mutated');
  }
});

test('zero reference ascendant preserves selected and fallback synastry geometry', async () => {
  for (const selected of ['placido', 'egizia']) {
    const { renderer, calls } = syntheticRenderer();
    const theme = createTheme(otherHouses);
    const result = await renderer.getAnelloSinastria(
      theme, 0, [], state(selected), 160, 140, 120, 110, 100, 130,
    );
    assert.equal(calls.selectedAngles, 0);
    assert.equal(calls.planets, 1);
    assert.equal(calls.signs, 1);
    assert.equal(calls.cleaned, 0);
    assert.deepEqual(
      result.children.map(child => child.kind),
      selected === 'placido'
        ? ['planets', 'signs', 'houses']
        : ['fallback-texture', 'planets', 'signs'],
    );
  }
});


test('keeps exact reference angle when selected house frame is unusually large', async () => {
  // Angular frames from upstream providers are finite but not always normalized.
  // The previous as + (reference - as) cancellation rounded 13° to 12° here.
  const theme = createTheme({
    placido: {
      ascendant: 1e16,
      mc: 150,
      house: Array.from({ length: 12 }, (_, i) => i * 30),
    },
  });
  const before = structuredClone(theme);
  const { renderer, calls } = syntheticRenderer();
  const result = await renderer.getAnelloSinastria(
    theme, 13, [], state('placido'), 160, 140, 120, 110, 100, 130,
  );
  assert.deepEqual(result.children.map(child => child.kind), ['planets', 'signs', 'houses']);
  assert.equal(calls.selectedAngles, 13, 'planet ring must keep the exact reference angle');
  assert.equal(calls.signAngle, 13, 'zodiac ring must use the same exact reference angle');
  assert.equal(calls.houses, 1);
  assert.equal(calls.cleaned, 0);
  assert.deepEqual(theme, before, 'input chart must not be mutated');
});


test('cleans completed house ring and planet animation descendants when sign rendering fails', async () => {
  for (const selection of ['placido', 'egizia']) {
    const { renderer, calls } = syntheticRenderer({ failSigns: true });
    const theme = createTheme(otherHouses);
    const before = structuredClone(theme);
    await assert.rejects(
      render(renderer, theme, selection),
      /Synthetic sign rendering failure/,
    );
    assert.equal(calls.planets, 1);
    assert.equal(calls.signs, 1);
    assert.equal(calls.cleaned, 1, 'the failed scene is traversed once');
    if (selection === 'placido') {
      assert.equal(calls.houses, 1);
      assert.deepEqual(calls.cleanedNodes,
        ['root', 'planets', 'animated-marker', 'houses', 'case-image'],
        'even the not-yet-attached house ring must be traversed for cleanup');
    } else {
      assert.equal(calls.houses, 0);
      assert.deepEqual(calls.cleanedNodes,
        ['root', 'fallback-texture', 'planets', 'animated-marker'],
        'missing-house fallback must not create a phantom case ring');
    }
    assert.deepEqual(theme, before, 'failed render must not mutate the source chart');
  }
});
