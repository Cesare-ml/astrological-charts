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
const ellipseInputs = [];
const textureRequests = [];

const THREE = {
  MathUtils: { degToRad: angle => angle * Math.PI / 180 },
  DoubleSide: 2,
  ClampToEdgeWrapping: 1001,
  LinearFilter: 1002,
  EllipseCurve: class {
    constructor(x, y, rx, ry, start, end, clockwise) {
      this.rx = rx;
      this.ry = ry;
      this.start = start;
      this.end = end;
      this.clockwise = clockwise;
      ellipseInputs.push({start, end, clockwise});
    }
    getSpacedPoints(count) {
      sampleCounts.push(count);
      // Mirrors Three.js r170 EllipseCurve.getPoint() wrapping semantics.
      // Assert bounded angles first, avoiding unbounded while-loops in a test.
      assert.ok(this.start >= 0 && this.start <= 2 * Math.PI,
        'Arc start should be normalized into one turn');
      assert.ok(Math.abs(this.end) <= 4 * Math.PI + 1e-10,
        'Arc end should be bounded to an adjacent turn');
      const twoPi = 2 * Math.PI;
      let delta = this.end - this.start;
      const samePoints = Math.abs(delta) < Number.EPSILON;
      while (delta < 0) delta += twoPi;
      while (delta > twoPi) delta -= twoPi;
      if (delta < Number.EPSILON) delta = samePoints ? 0 : twoPi;
      if (this.clockwise && !samePoints) {
        delta = delta === twoPi ? -twoPi : delta - twoPi;
      }
      return Array.from({length: count + 1}, (_, index) => {
        const angle = this.start + delta * index / count;
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
const GestoreImmagini = {
  getImg(reference) {
    textureRequests.push(reference);
    const transform = () => ({ values: null, set(...values) { this.values = values; } });
    return {
      repeat: transform(),
      offset: transform(),
      center: transform(),
      wrapS: 0,
      wrapT: 0,
      minFilter: 0,
      magFilter: 0,
      rotation: 1,
    };
  },
};
const context = { exports: {}, THREE, GestoreImmagini };
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


test('reversed radial band used by the aspect-center disc remains supported', () => {
  sampleCounts.length = 0;
  const mesh = Renderer.getSemiArcoGrosso(0, 360, 2, 0, '#ccc');
  assert.deepEqual(Array.from(sampleCounts), [360, 360]);
  assertFiniteUv(mesh);
});

test('nonfinite or negative arc radii fail before curve sampling', () => {
  for (const [inner, outer] of [
    [NaN, 1], [1, NaN],
    [Infinity, 1], [1, -Infinity],
    [-1, 1], [1, -0.001],
  ]) {
    sampleCounts.length = 0;
    assert.throws(
      () => Renderer.getSemiArcoGrosso(0, 30, inner, outer, '#ccc'),
      { name: 'RangeError' },
    );
    assert.equal(sampleCounts.length, 0);
  }
});


test('normal textured arcs preserve material and stable UV mapping', () => {
  sampleCounts.length = 0;
  textureRequests.length = 0;
  const reference = 'synthetic/checkerboard.png';
  const mesh = Renderer.getSemiArcoGrosso(0, 90, 1, 2, '#abc', reference);

  assert.deepEqual(Array.from(sampleCounts), [90, 90]);
  assert.deepEqual(Array.from(textureRequests), [reference]);
  assertFiniteUv(mesh);

  const uv = mesh.geometry.attributes.uv.array;
  assert.ok(Math.abs(uv[0] - 0.5) < 0.001, 'inner start point retains u=0.5');
  assert.ok(Math.abs(uv[1]) < 0.001, 'inner start point retains v=0');
  assert.ok(Math.abs(uv.at(-2) - 1) < 0.001, 'outer end point retains u=1');
  assert.ok(Math.abs(uv.at(-1)) < 0.001, 'outer end point retains v=0');

  const {options} = mesh.material;
  assert.equal(options.color, '#abc');
  assert.equal(options.transparent, true);
  assert.equal(options.side, THREE.DoubleSide);
  const texture = options.map;
  assert.equal(texture.wrapS, THREE.ClampToEdgeWrapping);
  assert.equal(texture.wrapT, THREE.ClampToEdgeWrapping);
  assert.equal(texture.minFilter, THREE.LinearFilter);
  assert.equal(texture.magFilter, THREE.LinearFilter);
  assert.deepEqual(texture.repeat.values, [1, 1]);
  assert.deepEqual(texture.offset.values, [0, 0]);
  assert.deepEqual(texture.center.values, [0.5, 0.5]);
  assert.equal(texture.rotation, 0);
});

test('invalid textured arcs reject input without requesting an image', () => {
  for (const args of [
    [NaN, 30, 1, 2],
    [0, 30, -1, 2],
    [0, 30, 1, Infinity],
  ]) {
    sampleCounts.length = 0;
    textureRequests.length = 0;
    assert.throws(
      () => Renderer.getSemiArcoGrosso(...args, '#abc', 'synthetic/checkerboard.png'),
      {name: 'RangeError'},
    );
    assert.equal(sampleCounts.length, 0);
    assert.equal(textureRequests.length, 0);
  }
});


test('all 12 zodiac wedges at rotated ascendants preserve finite UVs and 30 segments', () => {
  // Synthetic inputs only: exercise wraparound at 0/360 and negative offsets.
  // Wedges are still sampled from their original (unmodded) source angles.
  for (const ascendantOffset of [-375, -15, 0, 75, 345, 735]) {
    for (let sign = 0; sign < 12; sign++) {
      const start = ascendantOffset + sign * 30;
      sampleCounts.length = 0;
      const mesh = Renderer.getSemiArcoGrosso(start, start + 30, 1.5, 2, '#abc');
      assert.deepEqual(Array.from(sampleCounts), [30, 30],
        'Expected 30 segments for sign ' + sign + ' at offset ' + ascendantOffset);
      assertFiniteUv(mesh);
    }
  }
});

test('extreme valid radii and exact upper subdivision bound remain finite', () => {
  for (const [start, end, inner, outer, segments] of [
    [0, 720, 1, 2, 720],
    [0, 360, 0, 2, 360],
    [90, 90, 2, 2, 2],
    [0, 30, 1e-8, 1e-7, 30],
  ]) {
    sampleCounts.length = 0;
    const mesh = Renderer.getSemiArcoGrosso(start, end, inner, outer, '#abc');
    assert.deepEqual(Array.from(sampleCounts), [segments, segments]);
    assertFiniteUv(mesh);
  }
});


test('tiny reversed arcs sweep clockwise, not almost a full circle', () => {
  ellipseInputs.length = 0;
  const arc = Renderer.getSemiArcoGrosso(10, 9.8, 1, 2, '#abc');
  assertFiniteUv(arc);
  assert.equal(ellipseInputs.length, 2);
  for (const ellipse of ellipseInputs) {
    assert.equal(ellipse.clockwise, true);
    const deltaDegrees = (ellipse.end - ellipse.start) * 180 / Math.PI;
    assert.ok(Math.abs(deltaDegrees + 0.2) < 1e-8);
  }
});

test('huge angular inputs are reduced before entering Three.js loops', () => {
  for (const [start, end] of [
    [-1e8, 1e8],
    [1e12, 1e12 + 30],
    [-360e9 - 15, -360e9 + 15],
    [0, 720],
    [360, 0],
  ]) {
    ellipseInputs.length = 0;
    const arc = Renderer.getSemiArcoGrosso(start, end, 1, 2, '#abc');
    assertFiniteUv(arc);
    assert.equal(ellipseInputs.length, 2);
    for (const ellipse of ellipseInputs) {
      assert.ok(ellipse.start >= 0 && ellipse.start <= 2 * Math.PI);
      assert.ok(Math.abs(ellipse.end) <= 4 * Math.PI + 1e-10);
      assert.equal(ellipse.clockwise, end < start);
    }
  }
});
