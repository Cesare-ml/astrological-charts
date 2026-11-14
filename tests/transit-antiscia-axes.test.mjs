import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

// Executes the actual TypeScript renderer against synthetic geometry, not screenshots.
const source = readFileSync(
  new URL('../src/lib/renderers/moduli/transiti.renderer.ts', import.meta.url), 'utf8',
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

// The consolidated renderer imports the actual color helper; evaluate it
// rather than treating the import as an unknown dependency.
const helperSource = readFileSync(
  new URL('../src/lib/renderers/antisci-marker-color.ts', import.meta.url), 'utf8',
);
const helperCompiled = ts.transpileModule(helperSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const helperExports = {};
vm.runInNewContext(helperCompiled, { exports: helperExports });
const { getAntisciMarkerColor } = helperExports;

function createHarness() {
  const objects = [];
  class Group {
    children = [];
    add(child) { this.children.push(child); }
  }
  class Vector3 {
    constructor(x, y, z) {
      Object.assign(this, { x, y, z });
    }
  }
  const object = (kind, other = {}) => {
    const result = {
      kind, position: new Vector3(0, 0, 0), rotation: { z: 0 },
      rotateZ(angle) { this.rotation.z = angle; },
      translateY(distance) {
        this.position.x = -Math.sin(this.rotation.z) * distance;
        this.position.y = Math.cos(this.rotation.z) * distance;
      },
      ...other,
    };
    objects.push(result);
    return result;
  };
  const primitives = {
    getLineaGrossa(start, end, color, width) {
      return object('thick-line', { start, end, color, width });
    },
    getLineaGrossaTratteggiata(start, end, color, width, spacing) {
      return object('dashed-line', { start, end, color, width, spacing });
    },
    getCerchio(radius, color) { return object('circle', { radius, color }); },
  };
  const dependencies = {
    three: { Group, Vector3, MathUtils: { degToRad: value => value * Math.PI / 180 } },
    '../oggetti-semplici.renderer': { OggettiSempliciRender: primitives },
    './elementi-celesti.renderer': {
      ElementiCelestiRender: {
        async getElementiCelesti() { return { Sun: { longitude: 10 } }; },
      },
    },
    '../_colori.config': { Colori: { elementiCelesti: { Sun: '#ffcc00' } } },
    '../@skin-manager': { SkinManager: { skins: { light: { bgColor: '#fefefe' } } } },
    '../antisci-marker-color': { getAntisciMarkerColor },
  };
  const context = {
    exports: {},
    require(specifier) {
      assert.ok(Object.hasOwn(dependencies, specifier), 'Unexpected import: ' + specifier);
      return dependencies[specifier];
    },
  };
  vm.runInNewContext(compiled, context, { filename: 'transiti.renderer.js' });
  return { TransitiRender: context.exports.TransitiRender, objects };
}
const axisPositions = {
  Cardinale: 270,
  Fissa: 300,
  Mutevole: 330,
};

function isFiniteObject(object) {
  const coordinates = [object.position.x, object.position.y, object.position.z, object.rotation.z];
  if (object.start) coordinates.push(object.start.x, object.start.y, object.start.z);
  if (object.end) coordinates.push(object.end.x, object.end.y, object.end.z);
  return coordinates.every(Number.isFinite);
}

async function render(options) {
  const h = createHarness();
  const group = await h.TransitiRender.getAntisci(
    {}, 90, { settaggi: { skin_id: 'light' }, ...options },
    4, 4, 5, 6,
  );
  return { ...h, group };
}

test('all three supported antiscia axes retain their angular placement', async () => {
  const result = await render({ antisci: { Cardinale: true, Fissa: true, Mutevole: true } });
  assert.equal(result.group.children.length, 3);
  assert.equal(result.objects.length, 3);
  for (const [index, longitude] of Object.values(axisPositions).entries()) {
    const axis = result.group.children[index];
    assert.equal(axis.kind, 'thick-line');
    assert.ok(Math.abs(axis.rotation.z - longitude * Math.PI / 180) < 1e-12);
  }
  assert.ok(result.objects.every(isFiniteObject));
});

test('unknown and inherited antiscia keys cannot create NaN geometry', async () => {
  const antisci = Object.assign(Object.create({ Inherited: true }), {
    Cardinale: true,
    InvalidAxis: true,
  });
  const result = await render({ antisci, antisciTransitiHover: { nome: 'Sun' } });
  assert.equal(result.group.children.length, 8);
  assert.equal(result.objects.filter(x => x.kind === 'thick-line').length, 4);
  assert.equal(result.objects.filter(x => x.kind === 'circle').length, 3);
  assert.equal(result.objects.filter(x => x.kind === 'dashed-line').length, 1);
  assert.ok(result.objects.every(isFiniteObject));
});

test('only recognized enabled axes render, even when unknown keys are truthy', async () => {
  const result = await render({
    antisci: { Cardinale: false, Fissa: false, Mutevole: false, Unexpected: true },
    antisciTransitiHover: { nome: 'Sun' },
  });
  assert.equal(result.group.children.length, 0);
  assert.equal(result.objects.length, 0);
});

test('hovering an unavailable planet draws axes but no triangular relation', async () => {
  const result = await render({
    antisci: { Cardinale: true, Unknown: true },
    antisciTransitiHover: { nome: 'NoPlanet' },
  });
  assert.equal(result.group.children.length, 1);
  assert.equal(result.objects.length, 1);
});

test('inherited recognized axis flags are ignored unless explicitly owned', async () => {
  const inherited = Object.create({ Cardinale: true, Mutevole: true });
  inherited.Fissa = true;
  const result = await render({ antisci: inherited, antisciTransitiHover: { nome: 'Sun' } });
  assert.equal(result.group.children.length, 8, 'only the owned Fissa axis and its hover links');
  const axis = result.group.children[0];
  assert.equal(axis.kind, 'thick-line');
  assert.ok(Math.abs(axis.rotation.z - Math.PI * 5 / 3) < 1e-12);
  assert.ok(result.objects.every(isFiniteObject));
});

test('missing and null antiscia option maps are empty, not exceptions', async () => {
  for (const antisci of [undefined, null]) {
    const result = await render({ antisci, antisciTransitiHover: { nome: 'Sun' } });
    assert.equal(result.group.children.length, 0);
    assert.equal(result.objects.length, 0);
  }
});
