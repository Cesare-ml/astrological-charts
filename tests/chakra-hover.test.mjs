import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import * as THREE from 'three';

const bundle=await build({stdin:{contents:[
  "export { ChakraHoverController } from './src/lib/services/chakra-hover';",
  "export { creaChakra } from './src/lib/renderers/@carta-astrale/carta-astrale.renderer';",
].join('\n'),resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const {ChakraHoverController,creaChakra}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
function target(){const handlers=new Map();return {handlers,addEventListener(k,fn){handlers.set(k,fn);},
  removeEventListener(k){handlers.delete(k);},fire(k,event={}){handlers.get(k)?.(event);}};}

test('chakra sectors follow their numbered orientation and pointer listeners are disposed',async()=>{
  const original=globalThis.window; globalThis.window=target();
  const canvas=Object.assign(target(),{getBoundingClientRect:()=>({left:0,top:0,width:200,height:200})});
  const camera=new THREE.OrthographicCamera(-2,2,2,-2,.1,100);camera.position.z=5;camera.updateProjectionMatrix();
  const scene=new THREE.Scene(), group=await creaChakra({opzioni:{chakramAttivi:true,chakram:'Vishuddha'},
    diametri:{diametroCerchioAspetti:2,diametroInternoAnelloCase:3}});scene.add(group);
  const seen=[], controller=new ChakraHoverController(canvas,()=>scene,()=>camera,v=>seen.push(v));
  try {
    const highlight=group.getObjectByName('chakra-highlight');
    assert.equal(highlight.visible,false);
    // First petal points left, second one runs clockwise in chart coordinates.
    canvas.fire('mousemove',{clientX:75,clientY:100});assert.deepEqual(seen.at(-1),{chakra:'Vishuddha',sector:1});
    assert.equal(highlight.visible,true);
    assert.ok(highlight.geometry.drawRange.count>0);
    const angle=Math.PI+2*Math.PI/16;
    canvas.fire('mousemove',{clientX:100+Math.cos(angle)*25,clientY:100-Math.sin(angle)*25});
    assert.deepEqual(seen.at(-1),{chakra:'Vishuddha',sector:2});
    canvas.fire('mouseleave');assert.equal(seen.at(-1),null);assert.equal(highlight.visible,false);
  } finally {controller.dispose();assert.equal(canvas.handlers.size,0);globalThis.window=original;}
});

test('the complete inner circle is pickable and the highlighted wedge follows the pointer',async()=>{
  const original=globalThis.window;globalThis.window=target();
  const canvas=Object.assign(target(),{getBoundingClientRect:()=>({left:0,top:0,width:200,height:200})});
  const camera=new THREE.OrthographicCamera(-2,2,2,-2,.1,100);camera.position.z=5;camera.updateProjectionMatrix();
  const scene=new THREE.Scene(),group=await creaChakra({opzioni:{chakramAttivi:true,chakram:'Swadhisthana'},
    diametri:{diametroCerchioAspetti:2,diametroInternoAnelloCase:3}});scene.add(group);
  const seen=[],controller=new ChakraHoverController(canvas,()=>scene,()=>camera,value=>seen.push(value));
  try {
    const highlight=group.getObjectByName('chakra-highlight');
    // Radius 1.4 lies beyond the old radius-1 polygon, but inside the visible circle.
    canvas.fire('mousemove',{clientX:170,clientY:100});
    assert.deepEqual(seen.at(-1),{chakra:'Swadhisthana',sector:3});
    assert.equal(highlight.visible,true);
    assert.equal(highlight.geometry.drawRange.start,2*8*3);
    // Mirroring the wheel must not disconnect its visible wedge from picking.
    group.rotation.y=Math.PI;controller.sceneChanged();
    assert.deepEqual(seen.at(-1),{chakra:'Swadhisthana',sector:1});
    assert.equal(highlight.geometry.drawRange.start,0);
    canvas.fire('mousemove',{clientX:180,clientY:100});
    assert.equal(seen.at(-1),null);assert.equal(highlight.visible,false);
  } finally {controller.dispose();globalThis.window=original;}
});
