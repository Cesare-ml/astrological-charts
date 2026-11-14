import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

/**
 * Small service/controller method regression. It executes the actual
 * TypeScript method bodies in synthetic classes, without a real WebGL canvas.
 * Browser visual, scene and GPU tests remain separate mandatory gates.
 */
function method(path, className, methodName) {
  const src = ts.createSourceFile(path,
    readFileSync(new URL('../' + path, import.meta.url), 'utf8'),
    ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const declaration = src.statements.find(node =>
    ts.isClassDeclaration(node) && node.name?.text === className);
  assert.ok(declaration, className + ' is present in ' + path);
  const found = declaration.members.find(node =>
    ts.isMethodDeclaration(node) && node.name.getText(src) === methodName);
  assert.ok(found?.body, className + '.' + methodName + ' must have a body');
  return found.getText(src);
}

const servicePath = 'src/lib/services/grafico-render.service.ts';
const controllerPath = 'src/lib/renderers/planet-interaction.controller.ts';
const setZoom = method(servicePath, 'GraficoRenderService', 'setZoom');
const focusService = method(servicePath, 'GraficoRenderService', 'highlightPlanet');
const focusController = method(controllerPath, 'PlanetInteractionController', 'highlight');
const modeService = method(servicePath, 'GraficoRenderService', 'setNatalAspectPresentation');
const modeController = method(controllerPath, 'PlanetInteractionController', 'setNatalAspectPresentation');

const validRef = p => !!p && typeof p === 'object' &&
  ['natal', 'transit', 'synastry'].includes(p.layer) &&
  typeof p.name === 'string' && p.name.length > 0;

const serviceCode = ts.transpileModule(`class CameraProbe {
  zoomValue = 1;
  minZoom = 0.05;
  maxZoom = 5;
  projectionCalls = 0;
  requestedFrames = 0;
  selections = [];
  paletteUpdates = [];
  pinnedPlanet = null;
  natalAspectPresentation = 'all';
  camera = {zoom:1, updateProjectionMatrix: () => {this.projectionCalls++;}};
  planetController = {
    highlight: value => {this.selections.push(value);},
    setNatalAspectPresentation: value => {this.paletteUpdates.push(value);}
  };
  requestInteractiveFrame() {this.requestedFrames++;}
  ${setZoom}
  ${focusService}
  ${modeService}
}`, {compilerOptions: {module:ts.ModuleKind.None, target:ts.ScriptTarget.ES2022}}).outputText;
const CameraProbe = new Function('isChartPlanetRef',
  serviceCode + '\nreturn CameraProbe;')(validRef);

const sameRef = (a, b) => a === b || (!!a && !!b &&
  a.layer === b.layer && a.name === b.name);
const controllerCode = ts.transpileModule(`class ControllerProbe {
  disposed = false;
  pinned = null;
  hovered = null;
  scene = {};
  sceneRevision = 0;
  visualRevision = 0;
  natalAspectPresentation = 'all';
  camera = {zoom:1.75, projectionMatrix:{revision:7}};
  painted = 0;
  frames = 0;
  updateVisuals() {this.painted++;this.visualRevision++;}
  requestRender() {this.frames++;}
  ${focusController}
  ${modeController}
}`, {compilerOptions: {module:ts.ModuleKind.None, target:ts.ScriptTarget.ES2022}}).outputText;
const ControllerProbe = new Function('sameChartPlanet', 'isChartPlanetRef',
  controllerCode + '\nreturn ControllerProbe;')(sameRef, validRef);

test('nonfinite zoom requests never corrupt the camera projection', () => {
  const probe = new CameraProbe();
  for (const value of [NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    probe.setZoom(value);
    assert.equal(probe.zoomValue, 1);
    assert.equal(probe.camera.zoom, 1);
    assert.equal(probe.projectionCalls, 0);
    assert.equal(probe.requestedFrames, 0);
  }
});

test('valid finite zoom values keep existing clamping behavior', () => {
  const probe = new CameraProbe();
  for (const [requested, expected] of [[1.5, 1.5], [10, 5], [-8, 0.05], [0.9, 0.9]]) {
    probe.setZoom(requested);
    assert.equal(probe.camera.zoom, expected);
    assert.equal(probe.zoomValue, expected);
  }
  assert.equal(probe.projectionCalls, 4);
  assert.equal(probe.requestedFrames, 4);
});

test('service focus of natal/transit/synastry axes and planets preserves camera state', () => {
  const probe = new CameraProbe();
  probe.setZoom(1.25);
  const projectionBefore = probe.projectionCalls;
  const framesBefore = probe.requestedFrames;
  const refs = ['AS','DS','MC','IC','Sun','Moon'].flatMap(name => [
    {layer:'natal',name}, {layer:'transit',name}, {layer:'synastry',name}
  ]);
  for (const ref of refs) {
    probe.highlightPlanet(ref);
    assert.equal(probe.zoomValue, 1.25, ref.name + ': zoom value changed');
    assert.equal(probe.camera.zoom, 1.25, ref.name + ': camera zoom changed');
    assert.equal(probe.projectionCalls, projectionBefore, 'focus updated camera projection');
    assert.equal(probe.requestedFrames, framesBefore, 'focus called the zoom render path');
    assert.deepEqual(probe.pinnedPlanet, ref);
    assert.notEqual(probe.pinnedPlanet, ref, 'selection must copy host ref');
  }
  assert.equal(probe.selections.length, refs.length);
  probe.highlightPlanet(null);
  assert.equal(probe.pinnedPlanet, null);
  assert.equal(probe.camera.zoom, 1.25);
});

test('controller focus schedules paint but never adjusts zoom or projection', () => {
  const probe = new ControllerProbe();
  const initialCamera = JSON.stringify(probe.camera);
  const refs = ['AS','DS','MC','IC'].flatMap(name => [
    {layer:'natal',name}, {layer:'synastry',name}
  ]);
  for (const ref of refs) probe.highlight(ref);
  assert.equal(probe.painted, refs.length);
  assert.equal(probe.frames, refs.length);
  assert.equal(JSON.stringify(probe.camera), initialCamera);
  probe.highlight({...refs.at(-1)});
  assert.equal(probe.painted, refs.length, 'identical focus must not repaint');
  probe.highlight(null);
  assert.equal(JSON.stringify(probe.camera), initialCamera);
});

test('focus method source bodies do not directly call zoom/projection operations', () => {
  for (const body of [focusService, focusController]) {
    assert.doesNotMatch(body, /\bsetZoom\s*\(|\bzoom(In|Out)\s*\(|\.camera\.zoom\s*=|\.updateProjectionMatrix\s*\(/);
  }
});

test('invalid JavaScript focus payloads preserve service selection across reinitialization', () => {
  const probe = new CameraProbe();
  const valid = {layer:'natal',name:'AS'};
  probe.highlightPlanet(valid);
  assert.deepEqual(probe.pinnedPlanet,valid);
  assert.notEqual(probe.pinnedPlanet,valid,'service snapshots valid host input');
  const previous = probe.pinnedPlanet;
  const initialCalls = probe.selections.length;
  const cameraBefore = JSON.stringify(probe.camera);
  for (const bad of [
    undefined, 0, 42, '', 'natal:AS', false, {},
    {layer:'none',name:'AS'}, {layer:'natal',name:''},
    {layer:'natal',name:23}, {layer:'transit'}, {layer:null,name:'Moon'}
  ]) {
    probe.highlightPlanet(bad);
    assert.equal(probe.pinnedPlanet,previous,'invalid host input cannot clear focus');
    assert.equal(probe.selections.length,initialCalls,'invalid focus must not reach controller');
    assert.equal(JSON.stringify(probe.camera),cameraBefore);
  }
  const replay=[];
  probe.planetController={highlight:value=>replay.push(value)};
  probe.planetController.highlight(probe.pinnedPlanet);
  assert.deepEqual(replay,[valid],'a new controller receives last valid selection');
  probe.highlightPlanet(null);
  assert.equal(probe.pinnedPlanet,null,'explicit null still clears focus');
  assert.equal(replay.at(-1),null);
});

test('invalid focus requests cannot erase the controller selection or repaint', () => {
  const probe=new ControllerProbe();
  const ref={layer:'transit',name:'MC'};
  probe.highlight(ref);
  const paints=probe.painted,frames=probe.frames,cameraBefore=JSON.stringify(probe.camera);
  for (const bad of [
    undefined,false,'Moon',{}, {layer:'natal',name:''},
    {layer:'invalid',name:'Sun'}, {layer:'natal',name:123}
  ]) {
    probe.highlight(bad);
    assert.deepEqual(probe.pinned,ref);
    assert.equal(probe.painted,paints);
    assert.equal(probe.frames,frames);
    assert.equal(JSON.stringify(probe.camera),cameraBefore);
  }
  probe.highlight(null);
  assert.equal(probe.pinned,null,'explicit null still clears focus');
  assert.equal(probe.painted,paints+1);
  assert.equal(probe.frames,frames+1);
});

test('invalid palette modes cannot poison saved service state for the next chart', () => {
  const probe=new CameraProbe();
  probe.setNatalAspectPresentation('focused');
  assert.equal(probe.natalAspectPresentation,'focused');
  const calls=probe.paletteUpdates.length;
  for (const bad of [null,undefined,'',0,'gray','FOCUSED',false,{}]) {
    probe.setNatalAspectPresentation(bad);
    assert.equal(probe.natalAspectPresentation,'focused');
    assert.equal(probe.paletteUpdates.length,calls);
  }
  const replay=[];
  probe.planetController={setNatalAspectPresentation:value=>replay.push(value)};
  probe.planetController.setNatalAspectPresentation(probe.natalAspectPresentation);
  assert.deepEqual(replay,['focused'],'new chart receives last valid palette mode');
  probe.setNatalAspectPresentation('muted');
  probe.setNatalAspectPresentation('all');
  assert.deepEqual(replay,['focused','muted','all']);
});

test('controller ignores invalid palette modes without muting natal aspects', () => {
  const probe=new ControllerProbe();
  const cameraBefore=JSON.stringify(probe.camera);
  for (const valid of ['focused','muted','all']) {
    probe.setNatalAspectPresentation(valid);
    assert.equal(probe.natalAspectPresentation,valid);
  }
  const paints=probe.painted,frames=probe.frames;
  for (const bad of [undefined,null,0,'gray','none','Muted',false,{}]) {
    probe.setNatalAspectPresentation(bad);
    assert.equal(probe.natalAspectPresentation,'all');
    assert.equal(probe.painted,paints);
    assert.equal(probe.frames,frames);
  }
  assert.equal(JSON.stringify(probe.camera),cameraBefore);
  probe.disposed=true;
  probe.setNatalAspectPresentation('muted');
  assert.equal(probe.natalAspectPresentation,'all');
});
