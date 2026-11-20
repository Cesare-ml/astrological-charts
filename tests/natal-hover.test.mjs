import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import * as THREE from 'three';

const bundle = await build({entryPoints:['src/lib/services/natal-hover.ts'], bundle:true, platform:'node',
  format:'esm', write:false});
const {NatalHoverController} = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
function target() {
  const handlers = new Map();
  return {addEventListener(k, fn) { handlers.set(k, fn); }, removeEventListener(k) { handlers.delete(k); },
    fire(k, event={}) { handlers.get(k)?.(event); }, handlers};
}
test('picks only natal glyphs, tracks zoom/redraw, and detaches listeners', () => {
  const previous = globalThis.window;
  const window = globalThis.window = target();
  const canvas = Object.assign(target(), {getBoundingClientRect:()=>({left:0,top:0,width:200,height:200})});
  const camera = new THREE.PerspectiveCamera(75,1,.1,100); camera.position.z = 5; camera.updateProjectionMatrix();
  let scene = new THREE.Scene();
  const natal = new THREE.Group(); natal.userData.chartInteractionRole = 'natal-planets';
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  sun.userData = {planet:'Sun',trueLongitude:359.75}; natal.add(sun); scene.add(natal);
  // A foreground non-natal glyph must not intercept the natal hit.
  const transit = sun.clone(); transit.userData = {planet:'Mars',trueLongitude:10}; transit.position.z = 1; scene.add(transit);
  const seen = [];
  const controller = new NatalHoverController(canvas, () => scene, () => camera, value => seen.push(value));
  try {
    canvas.fire('mousemove',{clientX:100,clientY:100});
    assert.deepEqual(seen, [{name:'Sun',longitude:359.75}]);
    canvas.fire('mousemove',{clientX:100,clientY:100}); assert.equal(seen.length,1);
    scene = new THREE.Scene(); controller.sceneChanged(); assert.equal(seen.at(-1),null);
    scene.add(natal); controller.sceneChanged(); assert.equal(seen.at(-1).name,'Sun');
    canvas.fire('mouseleave'); assert.equal(seen.at(-1),null);
    assert.equal(window.handlers.size,1);
    controller.dispose(); assert.equal(window.handlers.size,0); assert.equal(canvas.handlers.size,0);
  } finally { controller.dispose(); globalThis.window = previous; }
});

test('picks a projected dodecatemorion with its own longitude and distinguishes it from the natal point', () => {
  const previous = globalThis.window;
  globalThis.window = target();
  const canvas=Object.assign(target(),{getBoundingClientRect:()=>({left:0,top:0,width:200,height:200})});
  const camera=new THREE.PerspectiveCamera(75,1,.1,100);camera.position.z=5;camera.updateProjectionMatrix();
  const scene=new THREE.Scene(), natal=new THREE.Group();natal.userData.chartInteractionRole='natal-planets';scene.add(natal);
  const point=new THREE.Mesh(new THREE.CircleGeometry(.5,24),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  point.userData={dodecatemoria:'Sun',trueLongitude:130};natal.add(point);
  const seen=[],controller=new NatalHoverController(canvas,()=>scene,()=>camera,value=>seen.push(value));
  try {
    canvas.fire('mousemove',{clientX:100,clientY:100});
    assert.deepEqual(seen.at(-1),{name:'Sun',longitude:130,projection:'dodecatemoria'});
    point.userData={planet:'Sun',trueLongitude:130};controller.refresh();
    assert.deepEqual(seen.at(-1),{name:'Sun',longitude:130});
    assert.equal(seen.length,2);
  } finally {controller.dispose();globalThis.window=previous;}
});
