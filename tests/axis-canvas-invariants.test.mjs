import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

/** Execute the actual browser acceptance-gate invariant functions using
 * synthetic snapshots. No Chromium, Angular server, assets or screenshots
 * are needed for this fast Node regression. Real browser checks stay separate.
 */
const path = 'axis-focus-canvas.browser.test.mjs';
const source = ts.createSourceFile(path,
  readFileSync(new URL('./' + path, import.meta.url), 'utf8'),
  ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
const method = name => {
  const fn = source.statements.find(item =>
    ts.isFunctionDeclaration(item) && item.name?.text === name);
  assert.ok(fn?.body, 'missing browser invariant: ' + name);
  return fn.getText(source);
};
const code = [method('assertCameraAvailable'), method('assertViewInvariants')].join('\n');
const {assertCameraAvailable, assertViewInvariants} = new Function('assert',
  code + '\nreturn {assertCameraAvailable, assertViewInvariants};')(assert);

const snapshot = () => ({state:{
  canvasWidth:800, canvasHeight:800, clientWidth:800, clientHeight:800,
  drawingBuffer:[800,800], hasWebGL:true, renderRevision:7,
  sceneId:'scene-123',
  camera:{
    uuid:'camera-456', zoom:1.25,
    position:[0,0,3], quaternion:[0,0,0,1],
    projection:[1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]
  }
}});

test('unmodified camera and canvas states satisfy the actual browser gate',()=>{
  const first=snapshot(), second=structuredClone(first);
  assert.doesNotThrow(()=>assertCameraAvailable(first.state,'baseline'));
  assert.doesNotThrow(()=>assertViewInvariants(first,second,'stable'));
});

for(const [name, mutate] of [
  ['missing camera from later snapshot', state => {state.camera=null;}],
  ['missing scene identity from later snapshot', state => {state.sceneId=null;}],
  ['missing original camera', state => {state.camera=undefined;}],
  ['missing original scene identity', state => {state.sceneId='';}],
  ['invalid baseline zoom', state => {state.camera.zoom=NaN;}],
  ['zero camera zoom', state => {state.camera.zoom=0;}],
  ['changed focus zoom', state => {state.camera.zoom=1.5;}],
  ['changed camera UUID', state => {state.camera.uuid='camera-999';}],
  ['changed camera projection', state => {state.camera.projection[2]=0.2;}],
  ['nonfinite camera matrix value', state => {state.camera.projection[4]=Infinity;}],
  ['truncated camera quaternion', state => {state.camera.quaternion=[0,0,0];}],
  ['changed scene identity', state => {state.sceneId='other-scene';}],
  ['changed render revision', state => {state.renderRevision++;}],
  ['changed canvas drawing buffer', state => {state.drawingBuffer=[900,800];}],
  ['missing WebGL', state => {state.hasWebGL=false;}]
]) {
  test('browser gate rejects ' + name,()=>{
    const before=snapshot(), after=structuredClone(before);
    if(name.startsWith('missing original') || name==='invalid baseline zoom')
      mutate(before.state);
    else mutate(after.state);
    assert.throws(()=>assertViewInvariants(before,after,name),
      'browser gate must fail instead of silently skipping '+name);
  });
}
