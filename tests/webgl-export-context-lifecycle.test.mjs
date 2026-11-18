import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import ts from 'typescript';
import * as THREE from 'three';

// Execute the real export method and scene-resource disposer with a fake
// WebGLRenderer. The test does not need a GPU or any original chart artwork.
const file = new URL('../src/lib/services/grafico-render.service.ts', import.meta.url);
const source = readFileSync(file, 'utf8');
const ast = ts.createSourceFile(file.pathname, source, ts.ScriptTarget.Latest, true);
const serviceClass = ast.statements.find(node =>
  ts.isClassDeclaration(node) && node.name?.text === 'GraficoRenderService');
assert.ok(serviceClass);
const exportMethod = serviceClass.members.find(node =>
  ts.isMethodDeclaration(node) && node.name.getText(ast) === 'generaImmagineInterna');
const disposalFile = new URL('../src/lib/renderers/scene-resources.ts', import.meta.url);
const disposalAst = ts.createSourceFile(disposalFile.pathname,
  readFileSync(disposalFile, 'utf8'), ts.ScriptTarget.Latest, true);
const disposalFunction = disposalAst.statements.find(node =>
  ts.isFunctionDeclaration(node) && node.name?.text === 'disposeSceneResources');
assert.ok(exportMethod && disposalFunction);

const executable = ts.transpileModule(`
${disposalFunction.getText(disposalAst).replace(/^export\s+/, '')}
class ExportProbe {
  chartCameraDistance() { return 2.98; }
  ${exportMethod.getText(ast)}
}
`, {compilerOptions: {target: ts.ScriptTarget.ES2022}}).outputText;

function harness({textureFailure = false, pngFailure = false, renderFailure = false} = {}) {
  const calls = {
    created: 0, disposedRenderers: 0, lostContexts: 0, rendered: 0,
    textures: 0, materials: 0, geometries: 0, stoppedAnimations: 0,
    canvases: [],
  };

  class Renderer {
    constructor({canvas}) {
      calls.created++;
      this.domElement = canvas;
      this.disposed = false;
      canvas.toDataURL = () => {
        if (pngFailure) throw new Error('PNG encoding failed');
        return 'data:image/png;base64,eA==';
      };
    }
    setPixelRatio() {}
    setSize() {}
    render() {
      calls.rendered++;
      if (renderFailure) throw new Error('WebGL render failed');
    }
    dispose() {
      assert.equal(this.disposed, false, 'renderer must be disposed once');
      this.disposed = true;
      calls.disposedRenderers++;
    }
    forceContextLoss() {
      assert.equal(this.disposed, true, 'release renderer resources before losing context');
      calls.lostContexts++;
    }
  }

  const doc = {
    createElement(kind) {
      assert.equal(kind, 'canvas');
      const canvas = {};
      calls.canvases.push(canvas);
      return canvas;
    },
  };
  const createDrawing = async () => {
    const group = new THREE.Group();
    const texture = new THREE.Texture();
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({map: texture});
    for (const [resource, name] of [
      [texture, 'textures'], [geometry, 'geometries'], [material, 'materials'],
    ]) {
      const oldDispose = resource.dispose.bind(resource);
      resource.dispose = () => { calls[name]++; oldDispose(); };
    }
    group.add(new THREE.Mesh(geometry, material));
    return group;
  };
  const dependencies = [
    {...THREE, WebGLRenderer: Renderer},
    doc,
    {setDimensioniCanvas() {}},
    {skins: {light: {bgColor: '#ffffff'}}},
    {creaScena: createDrawing},
    createDrawing,
    async () => {
      if (textureFailure) throw new Error('Texture load failed');
    },
    () => { calls.stoppedAnimations++; },
  ];
  const ExportProbe = new Function(
    'THREE', 'document', 'OggettiSempliciRender', 'SkinManager',
    'LatitudiniRender', 'CartaAstraleCreaScena', 'waitForSceneTextures',
    'stopSceneAnimations', `${executable}\nreturn ExportProbe;`,
  )(...dependencies);

  async function exportPng() {
    return new ExportProbe().generaImmagineInterna(
      {}, null, null, 'carta-astrale',
      {settaggi: {skin_id: 'light'}}, {x: 80, y: 40}, 2,
    );
  }
  return {calls, exportPng};
}

test('every successful PNG export releases its independent WebGL context', async () => {
  const {calls, exportPng} = harness();
  for (let i = 0; i < 12; i++) {
    assert.match(await exportPng(), /^data:image\/png;base64,/);
  }
  assert.equal(calls.created, 12);
  assert.equal(calls.disposedRenderers, 12);
  assert.equal(calls.lostContexts, 12);
  assert.equal(new Set(calls.canvases).size, 12, 'each export has a private canvas');
  assert.deepEqual(
    [calls.textures, calls.materials, calls.geometries], [12, 12, 12],
    'generated resources are disposed once per export',
  );
});

for (const [name, conditions, expected] of [
  ['texture load', {textureFailure: true}, 'Texture load failed'],
  ['WebGL draw', {renderFailure: true}, 'WebGL render failed'],
  ['PNG encoding', {pngFailure: true}, 'PNG encoding failed'],
]) {
  test(`${name} failure still closes the offscreen context and disposes resources`, async () => {
    const {calls, exportPng} = harness(conditions);
    await assert.rejects(exportPng(), {message: expected});
    assert.equal(calls.disposedRenderers, 1);
    assert.equal(calls.lostContexts, 1);
    assert.deepEqual([calls.textures, calls.materials, calls.geometries], [1, 1, 1]);
  });
}
