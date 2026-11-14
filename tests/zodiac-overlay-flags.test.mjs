import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(
  new URL('../src/lib/renderers/moduli/segni.renderer.ts', import.meta.url),
  'utf8',
);

function fixtureObject() {
  return {
    position: { z: 0 },
    rotation: { z: 0 },
    scale: { set() {} },
    rotateZ() {},
    translateY() {},
  };
}

function loadRenderer() {
  class Group {
    children = [];
    add(object) { this.children.push(object); }
  }

  const graphicPrimitives = {
    getCerchio: fixtureObject,
    getSemiArcoGrosso: fixtureObject,
    getLinea: fixtureObject,
    getImg: async () => fixtureObject(),
  };
  const modules = {
    three: {
      Group,
      MathUtils: { degToRad: value => value * Math.PI / 180 },
    },
    '../oggetti-semplici.renderer': { OggettiSempliciRender: graphicPrimitives },
    '../@skin-manager': {
      SkinManager: {
        skins: {
          light: {
            anelloSegni: {
              coloreLinea: '#777',
              coloreSimboli: '#333',
              coloreTexture: '#fff',
              coloreImgFolder: null,
              texture: null,
            },
            elementi: ['#f00', '#0f0', '#ff0', '#00f'],
          },
        },
      },
    },
    '../_colori.config': { Colori: { elementiCelesti: {} } },
  };

  const context = {
    exports: {},
    require(name) {
      assert.ok(Object.hasOwn(modules, name), 'Unexpected renderer import: ' + name);
      return modules[name];
    },
    console: {
      log() { throw new Error('The zodiac renderer must not write debug logs'); },
    },
  };
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(output, context, { filename: 'segni.renderer.js' });
  return context.exports.SegniRender;
}

test('zodiac decan and decade overlays obey explicit call-site flags', async () => {
  const renderer = loadRenderer();
  let decanCount = 0;
  let decadeCount = 0;
  renderer.getDecani = async () => {
    decanCount += 1;
    return { overlay: 'decan' };
  };
  renderer.getDecadi = async () => {
    decadeCount += 1;
    return { overlay: 'decade' };
  };

  for (const [showDecans, showDecades] of [
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ]) {
    decanCount = 0;
    decadeCount = 0;
    // Deliberately contradict the positional flags: only the explicit
    // getAnelloSegni arguments are authoritative for this render call.
    const options = {
      settaggi: { skin_id: 'light' },
      mostraDecani: !showDecans,
      mostraDecadi: !showDecades,
    };
    const group = await renderer.getAnelloSegni(
      120, 1, 3, 5, false, showDecans, showDecades, options,
    );
    assert.equal(decanCount, Number(showDecans));
    assert.equal(decadeCount, Number(showDecades));
    assert.equal(group.children.filter(child => child.overlay === 'decan').length, Number(showDecans));
    assert.equal(group.children.filter(child => child.overlay === 'decade').length, Number(showDecades));
    assert.ok(group.children.length >= 85, 'Baseline ring and 12 glyphs are still present');
  }
});
