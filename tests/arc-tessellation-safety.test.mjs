import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(
  new URL('../src/lib/renderers/oggetti-semplici.renderer.ts', import.meta.url),
  'utf8',
);
// Exercise the actual renderer TypeScript with an instrumented Three.js fake.
// No DOM, GPU or production artwork is needed.
const withoutImports = source.replace(/^import [^\n]*\n/gm, '');
const output = ts.transpileModule(withoutImports, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const sampleCounts = [];

const THREE = {
  MathUtils: { degToRad: angle => angle * Math.PI / 180 },
  DoubleSide: 2,
  EllipseCurve: class {
    constructor(x, y, rx, ry, start, end) {
      this.rx = rx;
      this.ry = ry;
      this.start = start;
      this.end = end;
    }
    getSpacedPoints(count) {
      sampleCounts.push(count);
      return Array.from({length: count + 1}, (_, index) => {
        const angle = this.start + (this.end - this.start) * index / count;
        return { x: this.rx * Math.cos(angle), y: this.ry * Math.sin(angle) };
      });
    }
  },
  Shape: class {
    constructor(points) { this.points = points; }
  },
  ShapeGeometry: class {
    constructor(shape) {
      this.points = shape.points;
      this.attributes = {
        position: {
          count: this.points.length,
          getX: index => this.points[index].x,
          getY: index => this.points[index].y,
        },
      };
    }
    computeBoundingBox() {
      const xs = this.points.map(point => point.x);
      const ys = this.points.map(point => point.y);
      this.boundingBox = {
        min: { x: Math.min(...xs), y: Math.min(...ys) },
        max: { x: Math.max(...xs), y: Math.max(...ys) },
      };
    }
    setAttribute(name, attribute) { this.attributes[name] = attribute; }
  },
  Float32BufferAttribute: class {
    constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; }
  },
  MeshBasicMaterial: class {
    constructor(options) { this.options = options; }
  },
  Mesh: class {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
    }
  },
};
const context = { exports: {}, THREE };
vm.runInNewContext(output, context, { filename: 'oggetti-semplici.renderer.js' });
const Renderer = context.exports.OggettiSempliciRender;

function assertFiniteUv(mesh) {
  const uv = mesh.geometry.attributes.uv.array;
  assert.equal(uv.length, mesh.geometry.attributes.position.count * 2);
  for (const value of uv) {
    assert.ok(Number.isFinite(value), 'UV values cannot be NaN/Infinity');
    assert.ok(value >= 0 && value <= 1, 'UV values must be normalized');
  }
}

test('30-degree arcs preserve tessellation', () => {
  sampleCounts.length = 0;
  assertFiniteUv(Renderer.getSemiArcoGrosso(20, 50, 1, 2, '#ccc'));
  assert.deepEqual(Array.from(sampleCounts), [30, 30]);
});

test('tiny positive and reversed arcs have at least two segments', () => {
  for (const [start, end] of [[10, 10.25], [10, 9.8]]) {
    sampleCounts.length = 0;
    assertFiniteUv(Renderer.getSemiArcoGrosso(start, end, 1, 2, '#ccc'));
    assert.deepEqual(Array.from(sampleCounts), [2, 2]);
  }
});

test('zero-width geometry produces finite neutral UVs', () => {
  sampleCounts.length = 0;
  const mesh = Renderer.getSemiArcoGrosso(10, 10, 0, 0, '#ccc');
  assertFiniteUv(mesh);
  assert.deepEqual(Array.from(sampleCounts), [2, 2]);
  assert.ok(mesh.geometry.attributes.uv.array.every(value => value === 0.5));
});

test('very large spans cannot allocate unbounded arc samples', () => {
  sampleCounts.length = 0;
  assertFiniteUv(Renderer.getSemiArcoGrosso(-1e8, 1e8, 1, 2, '#ccc'));
  assert.deepEqual(Array.from(sampleCounts), [720, 720]);
});

test('invalid angles fail before allocating arc geometry', () => {
  for (const [start, end] of [
    [NaN, 20], [20, Infinity], [-Infinity, 20], [-1e308, 1e308],
  ]) {
    sampleCounts.length = 0;
    // Cross-realm Error constructors do not pass instanceof checks.
    assert.throws(
      () => Renderer.getSemiArcoGrosso(start, end, 1, 2, '#ccc'),
      { name: 'RangeError' },
    );
    assert.equal(sampleCounts.length, 0);
  }
});
