import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

/**
 * Execute the REAL getImg() method extracted from renderer TypeScript with
 * deferred texture loads. No Angular, WebGL, private image or network needed.
 *
 * A preview toggle while a texture is pending must not mix a legacy texture
 * with square geometry, or a square mask with distorted legacy geometry.
 */
const path = new URL('../src/lib/renderers/oggetti-semplici.renderer.ts', import.meta.url);
const source = readFileSync(path, 'utf8');
const ast = ts.createSourceFile('oggetti-semplici.renderer.ts', source, ts.ScriptTarget.Latest, true);
let actualMethod;
function find(node) {
  if (ts.isClassDeclaration(node) && node.name?.text === 'OggettiSempliciRender') {
    actualMethod = node.members.find(member =>
      ts.isMethodDeclaration(member) && member.name.getText(ast) === 'getImg'
    );
  }
  ts.forEachChild(node, find);
}
find(ast);
assert.ok(actualMethod, 'Could not locate the real OggettiSempliciRender.getImg method');
const compiled = ts.transpileModule(
  'class OggettiSempliciRender {\n' + actualMethod.getText(ast) + '\n}',
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }
).outputText;

function deferred() {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
}
function harness(initialPreviewEnabled) {
  let previewEnabled = initialPreviewEnabled;
  const pending = [];
  const geometryChecks = [];
  const imageManager = {
    isVirgoStarsAstroPreviewAsset(reference, allowed) {
      return allowed && previewEnabled &&
        reference === 'simboli-bianchi/elementi-celesti/Sun.png';
    },
  };
  const THREE = {
    PlaneGeometry: class {
      constructor(width, height) {
        this.width = width;
        this.height = height;
        geometryChecks.push({ width, height });
      }
    },
    Mesh: class {
      constructor(geometry, material) {
        this.geometry = geometry;
        this.material = material;
      }
    },
  };
  const Renderer = new Function('GestoreImmagini', 'THREE',
    compiled + '\nreturn OggettiSempliciRender;'
  )(imageManager, THREE);
  Renderer.getMaterial = (reference, flipY, color, allowed) => {
    const request = deferred();
    const material = { reference, flipY, color, allowed, texturePreview: allowed && previewEnabled };
    pending.push({ ...request, material });
    return request.promise;
  };
  return {
    Renderer, pending, geometryChecks,
    setPreview(value) { previewEnabled = value; },
  };
}
const ref = 'simboli-bianchi/elementi-celesti/Sun.png';
const width = 875;
const height = 605;
const scale = 1 / width;
const legacy = { width: 1, height: height / width };
const square = { width: height / width, height: height / width };
function assertGeometry(mesh, expected) {
  assert.equal(mesh.geometry.width, expected.width);
  assert.equal(mesh.geometry.height, expected.height);
}

test('turning preview ON mid-load cannot stretch a previously requested legacy texture', async () => {
  const { Renderer, pending, setPreview } = harness(false);
  const image = Renderer.getImg(ref, width, height, scale, false, 'white', true);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].material.texturePreview, false);
  setPreview(true); // changing after URL selection must not change geometry
  pending[0].resolve(pending[0].material);
  const mesh = await image;
  assert.equal(mesh.material.texturePreview, false);
  assertGeometry(mesh, legacy);
});

test('turning preview OFF mid-load cannot distort a previously requested square mask', async () => {
  const { Renderer, pending, setPreview } = harness(true);
  const image = Renderer.getImg(ref, width, height, scale, false, 'white', true);
  assert.equal(pending[0].material.texturePreview, true);
  setPreview(false);
  pending[0].resolve(pending[0].material);
  const mesh = await image;
  assert.equal(mesh.material.texturePreview, true);
  assertGeometry(mesh, square);
});

test('a drawing slot that did not opt in always keeps legacy geometry', async () => {
  const { Renderer, pending, setPreview } = harness(true);
  const image = Renderer.getImg(ref, width, height, scale, false, 'white', false);
  assert.equal(pending[0].material.texturePreview, false);
  setPreview(false);
  pending[0].resolve(pending[0].material);
  const mesh = await image;
  assert.equal(mesh.material.allowed, false);
  assertGeometry(mesh, legacy);
});
