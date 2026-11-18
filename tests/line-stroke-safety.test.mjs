import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Exercise the actual renderer methods without requiring a GPU, window or native canvas.
// The only substitutions are lightweight Three.js classes and fat-line recording.
const source = readFileSync(new URL('../src/lib/renderers/oggetti-semplici.renderer.ts', import.meta.url), 'utf8');
const withoutImports = source.replace(/^import [^\n]*\n/gm, '');
const stubs = `
const THREE = {
  Group: class {
    children = [];
    add(child) { this.children.push(child); }
  },
  Vector3: class {
    constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
    distanceTo(other) { return Math.hypot(this.x - other.x, this.y - other.y, this.z - other.z); }
  },
  Color: class { constructor(value) { this.value = value; } },
};
`;
const output = ts.transpileModule(stubs + withoutImports, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { OggettiSempliciRender: Renderer } = await import(
  'data:text/javascript;base64,' + Buffer.from(output).toString('base64')
);
// Spy only on the geometry factory, leaving production subdivision logic intact.
Renderer.createFatLineGeometry = (points) => ({ points });
Renderer.createFatLine = (geometry, width) => ({ geometry, width });
const point = (x, y = 0) => ({
  x,
  y,
  distanceTo(other) { return Math.hypot(this.x - other.x, this.y - other.y); },
});
const allCoordsAreFinite = (group) => group.children.every((child) =>
  child.geometry.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
);

test('valid dashed lines preserve original segment subdivision and endpoints', () => {
  const group = Renderer.getLineaGrossaTratteggiata(point(0), point(1), '#fff', 1, 0.25);
  assert.equal(group.children.length, 2);
  assert.deepEqual(group.children.map((line) => line.geometry.points.map((p) => p.x)),
    [[0, 0.25], [0.5, 0.75]]);
  assert.ok(allCoordsAreFinite(group));
});

test('short and zero-length strokes return an empty group without invalid geometry', () => {
  for (const x of [0, 0.1]) {
    assert.equal(Renderer.getLineaGrossaTratteggiata(point(0), point(x), '#fff', 1, 0.2).children.length, 0);
    assert.equal(Renderer.getLineaGrossaPuntoLinea(point(0), point(x), '#fff', 1, {
      passo: 0.2, rateoLineaSpazio: 1, nLinee: 1, nPunti: 1,
    }).children.length, 0);
  }
});

test('valid line-and-dot configurations preserve the number of pieces', () => {
  const group = Renderer.getLineaGrossaPuntoLinea(point(0), point(1), '#fff', 1, {
    passo: 0.5, rateoLineaSpazio: 1, nLinee: 1, nPunti: 2,
  });
  assert.equal(group.children.length, 6);
  assert.ok(allCoordsAreFinite(group));
});

test('dot-only patterns no longer divide by zero', () => {
  const group = Renderer.getLineaGrossaPuntoLinea(point(0), point(1), '#fff', 1, {
    passo: 0.5, rateoLineaSpazio: 1, nLinee: 0, nPunti: 2,
  });
  assert.equal(group.children.length, 4);
  assert.ok(allCoordsAreFinite(group));
});

test('invalid steps and unbounded subdivisions fail immediately', () => {
  for (const passo of [0, -1, NaN, Infinity, -Infinity, 1e-200]) {
    assert.throws(() => Renderer.getLineaGrossaTratteggiata(point(0), point(1), '#fff', 1, passo), RangeError);
    assert.throws(() => Renderer.getLineaGrossaPuntoLinea(point(0), point(1), '#fff', 1, {
      passo, rateoLineaSpazio: 1, nLinee: 1, nPunti: 1,
    }), RangeError);
  }
});

test('malformed line-and-dot parameters fail without creating infinite loops', () => {
  for (const pattern of [
    { nLinee: Infinity, nPunti: 1, rateoLineaSpazio: 1 },
    { nLinee: -1, nPunti: 1, rateoLineaSpazio: 1 },
    { nLinee: 1, nPunti: 1.5, rateoLineaSpazio: 1 },
    { nLinee: 1, nPunti: 1, rateoLineaSpazio: NaN },
    { nLinee: 0, nPunti: 2, rateoLineaSpazio: 0 },
    { nLinee: 20001, nPunti: 0, rateoLineaSpazio: 1 },
  ]) {
    assert.throws(() => Renderer.getLineaGrossaPuntoLinea(point(0), point(1), '#fff', 1, {
      passo: 0.5, ...pattern,
    }), RangeError);
  }
  assert.equal(Renderer.getLineaGrossaPuntoLinea(point(0), point(1), '#fff', 1, {
    passo: 0.5, nLinee: 0, nPunti: 0, rateoLineaSpazio: 1,
  }).children.length, 0);
});
