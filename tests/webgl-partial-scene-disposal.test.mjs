import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import ts from 'typescript';
import * as THREE from 'three';

// Exercise the *real* chart builder, module loop and shared disposal helper.
// Only their graphics-producing collaborators are replaced by deterministic
// meshes; no GPU, astrology calculations or private assets are required.
function functionSource(path, name) {
  const file = new URL(path, import.meta.url);
  const ast = ts.createSourceFile(file.pathname, readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest, true);
  const fn = ast.statements.find(node =>
    ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(fn, `${name} must exist`);
  return fn.getText(ast).replace(/^export\s+/, '');
}
const source = [
  functionSource('../src/lib/renderers/scene-resources.ts', 'disposeSceneResources'),
  functionSource('../src/lib/renderers/@carta-astrale/carta-astrale.renderer.ts', 'aggiornaModuli'),
  functionSource('../src/lib/renderers/@carta-astrale/carta-astrale.renderer.ts', 'CartaAstraleCreaScena'),
].join('\n');
const compiled = ts.transpileModule(source,
  {compilerOptions: {target: ts.ScriptTarget.ES2022}}).outputText;

function createHarness({failAfterFirstModule = false, backdrop = false} = {}) {
  const counts = {geometry: 0, material: 0, texture: 0, animationStops: 0};
  const geometry = new THREE.PlaneGeometry(1, 1);
  const texture = new THREE.Texture();
  const material = new THREE.MeshBasicMaterial({map: texture});
  for (const [resource, key] of [
    [geometry, 'geometry'], [material, 'material'], [texture, 'texture'],
  ]) {
    const original = resource.dispose.bind(resource);
    resource.dispose = () => { counts[key]++; original(); };
  }
  const createTransits = async () => {
    const group = new THREE.Group();
    // Both meshes deliberately share all three resources. The scene disposer
    // must not release a shared resource twice.
    group.add(new THREE.Mesh(geometry, material));
    group.add(new THREE.Mesh(geometry, material));
    return group;
  };
  const createSigns = async () => {
    if (failAfterFirstModule) throw new Error('later chart module failed');
    return null;
  };
  const nothing = async () => null;
  const exported = new Function(
    'THREE', 'stopSceneAnimations', 'creaStatoCartaAstrale', 'SkinManager',
    'OggettiSempliciRender', 'creaTransiti', 'creaSegni', 'creaElementiCelesti',
    'creaCase', 'creaAspetti', 'creaMarcatoriAssi', 'creaSinastria',
    `${compiled}\nreturn {CartaAstraleCreaScena, disposeSceneResources};`,
  )(
    THREE,
    () => { counts.animationStops++; },
    (opzioni, temaRender) => ({
      opzioni, temaRender, diametri: {diametroAnelloSegni: 4},
    }),
    {skins: {light: {sfondoRuota: backdrop, bgColor: '#fff'}}},
    {getAnello: () => new THREE.Group()},
    createTransits, createSigns, nothing, nothing, nothing, nothing, nothing,
  );
  const options = {settaggi: {skin_id: 'light'}, mostraSinastria: false};
  return {
    counts,
    render: () => exported.CartaAstraleCreaScena(options, {}, null, null),
    dispose: exported.disposeSceneResources,
  };
}

test('failed partial chart releases resources and stops animations', async () => {
  const {counts, render} = createHarness({failAfterFirstModule: true});
  await assert.rejects(render(), {message: 'later chart module failed'});
  assert.deepEqual(
    [counts.geometry, counts.material, counts.texture], [1, 1, 1],
    'all resources owned by the abandoned partial chart must be disposed once',
  );
  assert.equal(counts.animationStops, 4,
    'the parent, module and both meshes must have their animations stopped');
});

test('successful chart remains intact until its owner disposes it', async () => {
  const {counts, render, dispose} = createHarness();
  const chart = await render();
  assert.ok(chart instanceof THREE.Group);
  assert.equal(chart.children.length, 1);
  assert.deepEqual([counts.geometry, counts.material, counts.texture], [0, 0, 0]);
  dispose(chart);
  assert.deepEqual([counts.geometry, counts.material, counts.texture], [1, 1, 1]);
});
