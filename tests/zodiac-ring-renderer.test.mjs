import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the real renderer with synthetic scene objects; no licensed images or browser required.
const source = readFileSync(new URL('../src/lib/renderers/moduli/segni.renderer.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function harness({ textured = false } = {}) {
  const lines = [];
  const arcs = [];
  const images = [];
  const logs = [];
  class Group {
    children = [];
    add(object) { this.children.push(object); }
  }
  const OggettiSempliciRender = {
    getCerchio(radius, color) { return { kind: 'circle', radius, color }; },
    getSemiArcoGrosso(start, end, inner, outer, color, texture) {
      const arc = { kind: 'arc', start, end, inner, outer, color, texture, position: { z: 0 } };
      arcs.push(arc);
      return arc;
    },
    getLinea(start, end, color) {
      const line = {
        kind: 'line', start, end, color, angle: null,
        rotateZ(angle) { this.angle = angle; },
      };
      lines.push(line);
      return line;
    },
    async getImg(...args) {
      images.push(args);
      return {
        kind: 'glyph', scale: { set() {} }, rotation: { z: 0 },
        rotateZ() {}, translateY() {},
      };
    },
  };
  const modules = {
    three: { Group, MathUtils: { degToRad: degrees => degrees * Math.PI / 180 } },
    '../oggetti-semplici.renderer': { OggettiSempliciRender },
    '../@skin-manager': { SkinManager: { skins: {
      test: { anelloSegni: {
        texture: textured ? 'synthetic-checker' : null,
        coloreTexture: '#aaaaaa', coloreLinea: '#111111', coloreSimboli: '#ffffff',
      } },
    } } },
    '../_colori.config': { Colori: { elementiCelesti: {} } },
  };
  const module = { exports: {} };
  vm.runInNewContext(output, {
    exports: module.exports,
    module,
    require(specifier) {
      assert.ok(Object.hasOwn(modules, specifier), 'Unexpected import: ' + specifier);
      return modules[specifier];
    },
    console: { log: (...args) => logs.push(args) },
  }, { filename: 'segni.renderer.js' });
  return { SegniRender: module.exports.SegniRender, lines, arcs, images, logs };
}

for (const australInversion of [false, true]) {
  test('synastry zodiac ring has 12 nonzero separators and correct glyph inversion: ' + australInversion, async () => {
    const { SegniRender, lines, images } = harness();
    const ring = await SegniRender.getAnelloSegniSinastria(
      15, 2, 4, australInversion, { opzioni: { settaggi: { skin_id: 'test' } } },
    );
    assert.equal(lines.length, 12);
    assert.equal(images.length, 12);
    assert.equal(ring.children.length, 25); // outer circle + separators + glyphs
    for (let i = 0; i < 12; i++) {
      assert.equal(lines[i].end.y - lines[i].start.y, 1);
      assert.ok(Math.abs(lines[i].angle - (75 + i * 30) * Math.PI / 180) < 1e-12);
      assert.equal(images[i][4], australInversion, 'propagate the hemisphere image flag');
    }
  });
}

for (const australInversion of [false, true]) {
  test('textured synastry preserves sector count, angle and inverted depth: ' + australInversion, async () => {
    const { SegniRender, lines, arcs, images } = harness({ textured: true });
    const ring = await SegniRender.getAnelloSegniSinastria(
      15, 2, 4, australInversion, { opzioni: { settaggi: { skin_id: 'test' } } },
    );
    assert.equal(lines.length, 12, 'only 12 sign boundaries are needed in textured mode');
    assert.equal(arcs.length, 12);
    assert.equal(images.length, 12);
    assert.equal(ring.children.length, 36); // 12 textured sectors + 12 separators + 12 glyphs
    for (let i = 0; i < 12; i++) {
      assert.equal(arcs[i].start, i * 30 + 75);
      assert.equal(arcs[i].end, (i + 1) * 30 + 75);
      assert.equal(arcs[i].position.z, australInversion ? 0.001 : -0.001);
      assert.equal(arcs[i].texture, 'synthetic-checker');
      assert.equal(images[i][4], australInversion);
      assert.equal(lines[i].end.y - lines[i].start.y, 1);
    }
  });
}

test('untextured natal zodiac ring draws without debug output', async () => {
  const { SegniRender, lines, images, logs } = harness();
  const ring = await SegniRender.getAnelloSegni(
    0, 1, 2, 4, false, false, false,
    { settaggi: { skin_id: 'test' }, mostraDecani: false, mostraDecadi: false },
  );
  assert.equal(logs.length, 0);
  assert.equal(lines.length, 72, 'preserve natal 5-degree tick geometry');
  assert.equal(images.length, 12);
  assert.equal(ring.children.length, 85);
});
