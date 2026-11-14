import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function fromSource(path, deps = {}) {
  const source = readFileSync(new URL('../src/lib/renderers/' + path, import.meta.url), 'utf8');
  const result = ts.transpileModule(source, {
    fileName: path,
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  assert.equal(result.diagnostics?.length ?? 0, 0, `${path}: TypeScript transpilation`);
  const module = { exports: {} };
  runInNewContext(result.outputText, {
    module, exports: module.exports,
    require(specifier) {
      assert.ok(Object.hasOwn(deps, specifier), `unexpected dependency: ${specifier}`);
      return deps[specifier];
    },
  }, { filename: path });
  return module.exports;
}

const { SkinManager } = fromSource('@skin-manager.ts');
const { getAntisciMarkerColor } = fromSource('antisci-marker-color.ts');

class Group {
  children = [];
  add(...children) { this.children.push(...children); }
}
class Vector3 {
  constructor(x = 0, y = 0, z = 0) { Object.assign(this, { x, y, z }); }
}
const markers = {
  getCerchio(_radius, color) {
    return {
      kind: 'marker', color, position: new Vector3(),
      rotateZ(degrees) { this.rotation = degrees; },
      translateY(distance) { this.position.y = distance; },
    };
  },
  getLineaGrossa() { return { kind: 'line', rotateZ() {} }; },
  getLineaGrossaTratteggiata() { return { kind: 'line' }; },
};
const { TransitiRender } = fromSource('moduli/transiti.renderer.ts', {
  three: { Group, Vector3, MathUtils: { degToRad: (degrees) => degrees * Math.PI / 180 } },
  '../oggetti-semplici.renderer': { OggettiSempliciRender: markers },
  './elementi-celesti.renderer': { ElementiCelestiRender: {
    async getElementiCelesti() { return { Sun: { longitude: 42 } }; },
  } },
  '../_colori.config': { Colori: { elementiCelesti: { Sun: '#ffcc00' } } },
  '../@skin-manager': { SkinManager },
  '../antisci-marker-color': { getAntisciMarkerColor },
});

test('contrast helper chooses black or white from actual supported skin backgrounds', () => {
  assert.deepEqual(Object.keys(SkinManager.skins).sort(), [
    'astrolabio', 'astrolabio-girasole', 'dark', 'dark-bn',
    'light', 'light-bn', 'sun',
  ]);
  for (const [skin, palette] of Object.entries(SkinManager.skins)) {
    assert.equal(
      getAntisciMarkerColor(palette.bgColor),
      skin.startsWith('dark') ? '#ffffff' : '#000000',
      `${skin} (${palette.bgColor})`,
    );
  }
  assert.equal(getAntisciMarkerColor('#777777'), '#000000');
  assert.equal(getAntisciMarkerColor('#666'), '#ffffff');
  assert.equal(getAntisciMarkerColor('not-a-hex-color'), '#ffffff', 'legacy fallback');
});

test('transit antiscia hover markers use matching contrast in all seven skins', async () => {
  for (const [skin, palette] of Object.entries(SkinManager.skins)) {
    const options = {
      settaggi: { skin_id: skin },
      antisci: { Cardinale: true, Fissa: false, Mutevole: false },
      antisciTransitiHover: { nome: 'Sun' },
    };
    const group = await TransitiRender.getAntisci({ planets: { Sun: { longitude: 42 } } }, 0, options, 2, 2, 3, 4);
    const circles = group.children.filter((child) => child.kind === 'marker');
    assert.equal(circles.length, 3, `${skin}: planet, antiscia and counter-antiscia circles`);
    for (const circle of circles) {
      assert.equal(circle.color, getAntisciMarkerColor(palette.bgColor), skin);
    }
  }
});

test('transit antiscia without a hover selection does not add markers', async () => {
  const group = await TransitiRender.getAntisci({ planets: { Sun: { longitude: 42 } } }, 0, {
    settaggi: { skin_id: 'sun' }, antisci: { Cardinale: true },
  }, 2, 2, 3, 4);
  assert.equal(group.children.filter((child) => child.kind === 'marker').length, 0);
});
