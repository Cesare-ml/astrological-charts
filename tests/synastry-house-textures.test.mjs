import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(
  new URL('../src/lib/renderers/moduli/case.renderer.ts', import.meta.url),
  'utf8'
);
const compiled = ts.transpileModule(source, {
  fileName: 'case.renderer.ts',
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

class FakeGroup {
  children = [];
  add(child) { this.children.push(child); }
}

function mockObject(kind, properties = {}) {
  return {
    kind,
    ...properties,
    position: { z: 0 },
    rotation: { z: 0 },
    scale: { set() {} },
    rotateZ() {},
    translateY() {},
  };
}
const skin = {
  anelloCase: {
    coloreLinea: '#333',
    coloreSimboli: '#eee',
    texture: null,
  },
};
const THREE = {
  Group: FakeGroup,
  MathUtils: { degToRad: value => value * Math.PI / 180 },
};
const OggettiSempliciRender = {
  getCerchio: (radius, color) => mockObject('circle', { radius, color }),
  getLinea: (from, to, color) => mockObject('line', { from, to, color }),
  getSemiArcoGrosso: (start, end, inner, outer, color, texture) =>
    mockObject('band', { start, end, inner, outer, color, texture }),
  getImg: async () => mockObject('house-glyph'),
};
// Load the real helper from the parent cusp PR. Avoid a fake implementation:
// the synastry test must detect mismatched helper behavior in a stacked merge.
const helperSource = readFileSync(
  new URL('../src/lib/renderers/moduli/house-cusps.ts', import.meta.url),
  'utf8',
);
const helperCompiled = ts.transpileModule(helperSource, {
  fileName: 'house-cusps.ts',
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const helperModule = { exports: {} };
new Function('require', 'module', 'exports', helperCompiled)(
  name => { throw new Error('Unexpected helper dependency: ' + name); },
  helperModule,
  helperModule.exports,
);
const { unwrapHouseCusps } = helperModule.exports;
const imported = { exports: {} };
const dependencies = {
  three: THREE,
  '../oggetti-semplici.renderer': { OggettiSempliciRender },
  '../@skin-manager': { SkinManager: { skins: { synthetic: skin } } },
  './house-cusps': { unwrapHouseCusps },
};
new Function('require', 'module', 'exports', compiled)(
  name => {
    if (!Object.hasOwn(dependencies, name)) throw new Error('Unexpected dependency: ' + name);
    return dependencies[name];
  },
  imported,
  imported.exports,
);
const { CaseRender } = imported.exports;
const house = { ascendant: 0, house: Array.from({ length: 12 }, (_, i) => i * 30) };
const options = { settaggi: { skin_id: 'synthetic' } };

async function render(australInversion = false, inputHouse = house) {
  return CaseRender.renderAnelloCaseSinastria(
    inputHouse, 0, 1, 100, 120, 180, australInversion, options,
  );
}

test('textured synastry has twelve outer annuli and twelve inner mini-annuli', async () => {
  skin.anelloCase.texture = 'base-texture';
  skin.anelloCase.sinastria = { texture: 'synastry-texture', coloreTexture: '#fed' };
  const result = await render();
  const bands = result.children.filter(child => child.kind === 'band');
  assert.equal(bands.length, 24);
  for (let index = 0; index < 12; index++) {
    const outer = bands[2 * index];
    const mini = bands[2 * index + 1];
    assert.deepEqual([outer.inner, outer.outer], [50, 90]);
    assert.deepEqual([mini.inner, mini.outer], [50, 60]);
    assert.deepEqual([mini.start, mini.end], [outer.start, outer.end]);
    assert.equal(outer.texture, 'synastry-texture');
    assert.equal(mini.texture, 'synastry-texture');
    assert.equal(mini.color, '#fed');
    assert.equal(outer.position.z, -0.001);
    assert.equal(mini.position.z, -0.0009);
  }
});

test('inverted southern rendering preserves radii and reverses texture depth', async () => {
  skin.anelloCase.texture = 'base-texture';
  skin.anelloCase.sinastria = { texture: 'synastry-texture' };
  const result = await render(true);
  const bands = result.children.filter(child => child.kind === 'band');
  assert.equal(bands.length, 24);
  for (let i = 0; i < 12; i++) {
    assert.deepEqual([bands[i * 2 + 1].inner, bands[i * 2 + 1].outer], [50, 60]);
    assert.equal(bands[i * 2].position.z, 0.001);
    assert.equal(bands[i * 2 + 1].position.z, 0.0009);
  }
});

test('textured synastry inherits the base texture when no override is set', async () => {
  skin.anelloCase.texture = 'base-texture';
  delete skin.anelloCase.sinastria;
  const result = await render();
  const bands = result.children.filter(child => child.kind === 'band');
  assert.equal(bands.length, 24);
  assert.equal(bands[0].texture, 'base-texture');
  assert.equal(bands[1].texture, 'base-texture');
  assert.deepEqual([bands[1].inner, bands[1].outer], [50, 60]);
});

test('untextured synastry still draws its two circle outlines', async () => {
  skin.anelloCase.texture = null;
  delete skin.anelloCase.sinastria;
  const result = await render();
  assert.equal(result.children.filter(child => child.kind === 'band').length, 0);
  assert.deepEqual(
    result.children.filter(child => child.kind === 'circle').map(child => child.radius),
    [90, 60],
  );
  assert.equal(result.children.filter(child => child.kind === 'house-glyph').length, 12);
});

test('mixed-frame cusp longitudes generate monotonic sectors with corrected inner texture radii', async () => {
  skin.anelloCase.texture = 'base-texture';
  skin.anelloCase.sinastria = { texture: 'synastry-texture' };
  const values = [725, 15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315];
  const original = [...values];
  const result = await render(false, { ascendant: 5, house: values });
  const bands = result.children.filter(child => child.kind === 'band');
  assert.equal(bands.length, 24);
  assert.deepEqual([bands[0].start, bands[0].end], [900, 910]);
  assert.deepEqual([bands[2].start, bands[2].end], [910, 940]);
  assert.deepEqual([bands[22].start, bands[22].end], [1210, 1260]);
  for (let index = 0; index < 12; index++) {
    const outer = bands[2 * index];
    const inner = bands[2 * index + 1];
    assert.ok(outer.start < outer.end, 'house boundary must advance');
    assert.deepEqual([outer.start, outer.end], [inner.start, inner.end]);
    assert.deepEqual([inner.inner, inner.outer], [50, 60]);
  }
  assert.deepEqual(values, original, 'renderer must not mutate original longitudes');
});

test('synastry rejects nonfinite or incomplete house cusp arrays before drawing', async () => {
  skin.anelloCase.texture = 'base-texture';
  for (const invalid of [null, [], Array(12).fill(Infinity), Array(12)]) {
    await assert.rejects(render(false, { ascendant: 0, house: invalid }), { name: 'TypeError' });
  }
});

test('natal and latitude house rings continue rendering with the same shared helper', async () => {
  skin.anelloCase.texture = null;
  const natal = await CaseRender.renderAnelloCase(house, 0, 1, 100, 120, 180, false, options);
  const latitude = await CaseRender.renderAnelloCaseLatitudini(house, 100, 180, false, options);
  assert.equal(natal.children.filter(child => child.kind === 'house-glyph').length, 12);
  assert.equal(latitude.children.filter(child => child.kind === 'house-glyph').length, 12);
});
