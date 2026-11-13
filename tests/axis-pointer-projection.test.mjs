import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

/** Fast source-level contract for the REAL pointer projection callback in
 * the opt-in Playwright test. Never substitutes for actual Chromium/Firefox.
 */
const src=ts.createSourceFile('axis-pointer-hit.browser.test.mjs',
  readFileSync(new URL('./axis-pointer-hit.browser.test.mjs',import.meta.url),'utf8'),
  ts.ScriptTarget.ES2022,true,ts.ScriptKind.JS);
const method=src.statements.find(node=>
  ts.isFunctionDeclaration(node)&&node.name?.text==='axisPoint');
assert.ok(method?.body,'actual browser test axisPoint function missing');
const returned=method.body.statements.find(ts.isReturnStatement);
assert.ok(returned?.expression && ts.isCallExpression(returned.expression),
  'axisPoint must use the Playwright page.evaluate callback');
const callback=returned.expression.arguments[0];
assert.ok(ts.isArrowFunction(callback),'the actual projected-mesh callback is required');
const factory=new Function('document','globalThis',
  'return ('+callback.getText(src)+');');

function sceneProbe({
  requested='AS', candidates=[{}], cameraMask=1, hasDebug=true,
  hasCanvas=true
}={}){
  const rect={left:100,top:200,width:400,height:300};
  const camera={layers:{mask:cameraMask},updateMatrixWorld(){}};
  const scene={visible:true,parent:null,updateMatrixWorld(){},
    traverse(fn){for(const object of objects)fn(object);}};
  const objects=candidates.map((row,index)=>({
    isMesh:true,
    userData:{chartPlanet:{layer:row.layer??'natal',name:row.name??'AS'}},
    visible:row.visible??true,
    parent:row.hiddenAncestor?{visible:false,parent:scene}:scene,
    layers:{mask:row.mask??1,test(other){return (this.mask&other.mask)!==0;}},
    material:row.material??{visible:true,transparent:false,opacity:1},
    uuid:'mesh-'+index,
    position:{clone(){return {x:0,y:0,z:0,project(){return this;}};}},
    getWorldPosition(out){
      out.x=row.x??-0.5;out.y=row.y??0.25;out.z=row.z??0;
      return out;
    }
  }));
  const canvas={getBoundingClientRect(){return rect;}};
  const document={querySelector(selector){
    if(selector==='chart-demo')return {id:'demo'};
    if(selector==='canvas[data-testid=chart]')return hasCanvas?canvas:null;
    return null;
  }};
  const globalThis={ng:hasDebug?{getComponent(){return {renderer:{scene,camera}};}}:{}};
  const locate=factory(document,globalThis);
  return locate(requested);
}

test('real callback projects current natal glyph origin into CSS canvas coordinates',()=>{
  const point=sceneProbe();
  assert.deepEqual(point,{x:200,y:312.5,uuid:'mesh-0'});
});

test('real callback does not select a mesh in a disabled camera layer',()=>{
  assert.equal(sceneProbe({candidates:[{mask:2}]}),null);
  assert.deepEqual(sceneProbe({candidates:[{mask:2},{mask:1}]}),
    {x:200,y:312.5,uuid:'mesh-1'});
});

test('real callback skips hidden ancestors and materials',()=>{
  assert.equal(sceneProbe({candidates:[{hiddenAncestor:true}]}),null);
  assert.equal(sceneProbe({candidates:[{material:{visible:false}}]}),null);
  assert.deepEqual(sceneProbe({candidates:[{hiddenAncestor:true},{visible:true}]}),
    {x:200,y:312.5,uuid:'mesh-1'});
});

test('real callback rejects fully transparent material but permits visible alpha',()=>{
  assert.equal(sceneProbe({candidates:[{material:{
    visible:true,transparent:true,opacity:0
  }}]}),null);
  assert.deepEqual(sceneProbe({candidates:[{material:{
    visible:true,transparent:true,opacity:0.2
  }}]}),{x:200,y:312.5,uuid:'mesh-0'});
});

test('real callback rejects unrelated planet, wrong layer or out-of-view targets',()=>{
  assert.equal(sceneProbe({requested:'DS',candidates:[{name:'AS'}]}),null);
  assert.equal(sceneProbe({candidates:[{layer:'transit'}]}),null);
  for(const bad of [{x:1.2},{y:-1.2},{z:2},{x:Infinity}]){
    assert.equal(sceneProbe({candidates:[bad]}),null);
  }
});

test('missing Angular dev debug component or canvas cannot fake a pointer target',()=>{
  assert.equal(sceneProbe({hasDebug:false}),null);
  assert.equal(sceneProbe({hasCanvas:false}),null);
});
