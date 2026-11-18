import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

const bundle = await build({stdin:{contents:`export {createFixedStarRing} from './src/lib/renderers/moduli/fixed-stars.renderer';
  export {stopSceneAnimations} from './src/lib/renderers/scene-animations';`, resolveDir:process.cwd(), loader:'ts'},
  bundle:true, write:false, platform:'node', format:'esm', target:'es2022'});
const {createFixedStarRing, stopSceneAnimations} = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

test('fixed stars retain identities and magnitude affects symbol size', () => {
  const group = createFixedStarRing([{id:1,longitude:0,magnitude:-1,axisContact:false},
    {id:2,longitude:90,magnitude:4,axisContact:true}], 0, 2);
  assert.equal(group.userData.chartInteractionRole, 'fixed-stars');
  assert.deepEqual(group.children.map(item=>item.userData.fixedStarId), [1,2]);
  group.children.forEach(item=>item.geometry.computeBoundingBox());
  const width = item => item.geometry.boundingBox.max.x-item.geometry.boundingBox.min.x;
  assert.ok(width(group.children[0]) > width(group.children[1]));
  assert.ok(Math.abs(group.children[0].position.x + 2) < .2);
  stopSceneAnimations(group);
});

test('conjunct stars use distinct placements without changing their identities', () => {
  const group = createFixedStarRing(Array.from({length:4},(_,i)=>({id:i+1,longitude:45,magnitude:2,axisContact:true})),0,2);
  const positions = new Set(group.children.map(item => `${item.position.x.toFixed(4)},${item.position.y.toFixed(4)}`));
  assert.equal(positions.size,4);
  stopSceneAnimations(group);
});
