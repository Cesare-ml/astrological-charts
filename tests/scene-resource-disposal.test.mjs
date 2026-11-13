import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Run the *actual* private service disposal helper without constructing Angular/WebGL.
// This test fails if the helper is removed or renamed; no duplicate disposal algorithm.
const serviceSource = readFileSync(new URL('../src/lib/services/grafico-render.service.ts', import.meta.url), 'utf8');
const file = ts.createSourceFile('grafico-render.service.ts', serviceSource, ts.ScriptTarget.ES2022, true);
const helper = file.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'disposeSceneResources');
assert.ok(helper, 'GraficoRenderService must still define disposeSceneResources');

const animationSource = readFileSync(new URL('../src/lib/renderers/scene-animations.ts', import.meta.url), 'utf8');
const moduleText = ts.transpileModule(animationSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { registerSceneAnimation, stopSceneAnimations } = await import(
  'data:text/javascript;base64,' + Buffer.from(moduleText).toString('base64')
);

class FakeTexture {
  disposeCalls = 0;
  dispose() { this.disposeCalls++; }
}
class FakeMaterial {
  disposeCalls = 0;
  constructor(map, extra = {}) { this.map = map; Object.assign(this, extra); }
  dispose() { this.disposeCalls++; }
}
class FakeGeometry {
  disposeCalls = 0;
  dispose() { this.disposeCalls++; }
}

const helperText = ts.transpileModule(helper.getText(file), {
  compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 },
}).outputText;
const disposeSceneResources = new Function(
  'THREE', 'stopSceneAnimations', helperText + '\nreturn disposeSceneResources;'
)({ Texture: FakeTexture }, stopSceneAnimations);

function scene(...children) {
  return {
    children,
    traverse(visitor) {
      function walk(object) {
        visitor(object);
        for (const child of object.children ?? []) walk(child);
      }
      walk(this);
    },
  };
}

test('deduplicates shared geometry, materials and textures across nested meshes', () => {
  const texture = new FakeTexture();
  const otherTexture = new FakeTexture();
  const material = new FakeMaterial(texture, { roughnessMap: otherTexture, notATexture: {} });
  const multiMaterial = new FakeMaterial(texture);
  const geometry = new FakeGeometry();
  const root = scene(
    { geometry, material, children: [] },
    { children: [{ geometry, material: [material, multiMaterial], children: [] }] },
  );

  disposeSceneResources(root);
  assert.equal(geometry.disposeCalls, 1);
  assert.equal(material.disposeCalls, 1);
  assert.equal(multiMaterial.disposeCalls, 1);
  assert.equal(texture.disposeCalls, 1);
  assert.equal(otherTexture.disposeCalls, 1);
});

test('failing animation kill cannot block cleanup of another animation or GPU resources', () => {
  const root = scene({ geometry: new FakeGeometry(), material: new FakeMaterial(new FakeTexture()), children: [] });
  const mesh = root.children[0];
  let successfulKills = 0;
  registerSceneAnimation(mesh, { kill() { throw new Error('synthetic GSAP failure'); } });
  registerSceneAnimation(mesh, { kill() { successfulKills++; } });
  const warn = console.warn;
  const warnings = [];
  console.warn = (message) => warnings.push(message);
  try {
    assert.doesNotThrow(() => disposeSceneResources(root));
  } finally {
    console.warn = warn;
  }
  assert.equal(successfulKills, 1);
  assert.equal(mesh.geometry.disposeCalls, 1);
  assert.equal(mesh.material.disposeCalls, 1);
  assert.equal(mesh.material.map.disposeCalls, 1);
  assert.deepEqual(warnings, ['Failed to stop 1 scene animation(s) during cleanup.']);
});

test('cleans animations attached to nested scene nodes, not just the root', () => {
  const root = scene({ children: [{ children: [] }] });
  const calls = [];
  registerSceneAnimation(root, { kill() { calls.push('root'); } });
  registerSceneAnimation(root.children[0].children[0], { kill() { calls.push('leaf'); } });
  disposeSceneResources(root);
  assert.deepEqual(calls, ['root', 'leaf']);
  // The timelines' registry has been cleared and cannot be killed again.
  stopSceneAnimations(root);
  stopSceneAnimations(root.children[0].children[0]);
  assert.deepEqual(calls, ['root', 'leaf']);
});

test('disposes an empty scene without requiring a renderer or material', () => {
  assert.doesNotThrow(() => disposeSceneResources(scene({ children: [] })));
});

test('disposal of one chart does not affect a second active chart or PNG export scene', () => {
  const active = scene({ geometry: new FakeGeometry(), material: new FakeMaterial(new FakeTexture()), children: [] });
  const exportScene = scene({ geometry: new FakeGeometry(), material: new FakeMaterial(new FakeTexture()), children: [] });
  const calls = [];
  registerSceneAnimation(active.children[0], { kill() { calls.push('active'); } });
  registerSceneAnimation(exportScene.children[0], { kill() { calls.push('export'); } });

  disposeSceneResources(exportScene);
  assert.deepEqual(calls, ['export']);
  assert.equal(exportScene.children[0].geometry.disposeCalls, 1);
  assert.equal(active.children[0].geometry.disposeCalls, 0);
  assert.equal(active.children[0].material.disposeCalls, 0);
  assert.equal(active.children[0].material.map.disposeCalls, 0);

  disposeSceneResources(active);
  assert.deepEqual(calls, ['export', 'active']);
  assert.equal(active.children[0].geometry.disposeCalls, 1);
  assert.equal(active.children[0].material.disposeCalls, 1);
  assert.equal(active.children[0].material.map.disposeCalls, 1);
});
