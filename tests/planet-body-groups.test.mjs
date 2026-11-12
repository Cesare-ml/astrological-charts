import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

// Check production TS source so future refactors cannot silently leave
// radial leaders or optional dodecatemores outside their owning body.
const content = readFileSync(
  new URL('../src/lib/renderers/moduli/elementi-celesti.renderer.ts',import.meta.url),
  'utf8'
);
const file = ts.createSourceFile('elementi-celesti.renderer.ts',
  content,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const loops = [];
function find(node) {
  if (ts.isForInStatement(node) &&
      node.expression.getText(file) === 'elementiCelesti') loops.push(node);
  ts.forEachChild(node,find);
}
find(file);
assert.equal(loops.length,1,'the renderer has one per-body visual loop');
const loop = loops[0].getText(file);
const count = (source,pattern) => source.split(pattern).length-1;

test('each body owns one identity-transform scene group',()=>{
  assert.ok(loop.includes('var elGroup = new THREE.Group();'));
  assert.ok(loop.includes("elGroup.userData['chartPlanetBody'] = {layer:interactionLayer,name:nome};"));
  assert.ok(loop.includes("ringId: group.uuid,"),'body layout must track its original wheel');
  assert.ok(loop.includes('group.add(elGroup);'));
  assert.ok(loop.includes('ascendant: ascendente,'));
  assert.ok(loop.includes('degreesOffset: degOffs,'),
    'the inspector must receive the same render rotation provenance');
  assert.equal(count(loop,'elGroup.position.'),0);
  assert.equal(count(loop,'elGroup.rotation.'),0);
  assert.equal(count(loop,'elGroup.scale.'),0);
});

test('every direct visual belongs to its one body, never the outer wheel',()=>{
  const attachments=['cerchietto','lineaCerchietto','lineaB','lineaA','el','frecciaAdArco'];
  for (const name of attachments) {
    assert.ok(loop.includes('elGroup.add('+name+');'),name+' must be owned by its body');
  }
  assert.equal(count(loop,'elGroup.add(eld);'),2,'both dodecatemore paths share the owner');
  assert.equal(count(loop,'elGroup.add('),8);
  assert.equal(count(loop,'group.add('),1,'the outer group adds only each wrapper');
  for (const name of ['glyph','inner-leader','outer-leader','moon-ring',
                      'moon-ring-leader','dodecatemore','dodecatemore-arc']) {
    assert.ok(loop.includes("'chartBodyVisualRole'] = '"+name+"'"),
      name+' must remain discoverable for a future atomic update');
  }
});

test('native picking and guide metadata stay on the glyph mesh',()=>{
  assert.ok(loop.includes("el.userData['chartPlanet'] = { layer: interactionLayer, name: nome };"));
  assert.ok(loop.includes("el.userData['chartAspectAngle'] = THREE.MathUtils.degToRad(elDegDiRender);"));
  assert.ok(loop.includes("el.userData['chartTransitRingRadius'] = raggioEclittica;"));
  assert.equal(count(loop,'registerSceneAnimation(elGroup, tl);'),2);
  assert.equal(count(loop,'registerSceneAnimation(group, tl);'),0);
  assert.ok(content.includes('disposeSceneResources(group);'),
    'failed asynchronous builds must dispose partial nested resources');
});
