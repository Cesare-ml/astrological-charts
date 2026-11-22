import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';

// Exercise the actual service methods without creating Angular or a WebGL context.
// TypeScript's parser extracts the three methods, so renaming/removing one fails
// the test instead of silently testing a duplicated hand-written implementation.
const source = readFileSync(new URL('../src/lib/services/grafico-render.service.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('grafico-render.service.ts', source, ts.ScriptTarget.Latest, true);
const klass = ast.statements.find(node =>
  ts.isClassDeclaration(node) && node.name?.text === 'GraficoRenderService');
assert.ok(klass, 'GraficoRenderService class must exist');

const names = ['setZoom', 'zoomIn', 'zoomOut', 'zoomAt', 'resetFraming', 'chartCameraDistance'];
const methods = names.map(name => {
  const method = klass.members.find(member =>
    ts.isMethodDeclaration(member) && member.name.getText(ast) === name);
  assert.ok(method, `Missing method: ${name}`);
  return method.getText(ast);
});

const probeSource = `
class ZoomProbe {
  private zoomValue = 1;
  private readonly minZoom = 0.05;
  private readonly maxZoom = 5;
  camera: { zoom: number; updateProjectionMatrix(): void } | null = null;
  renderCalls = 0;
  private render(): void { this.renderCalls++; }
  ${methods.join('\n')}
}
ZoomProbe;
`;
const js = ts.transpileModule(probeSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
const ZoomProbe = vm.runInNewContext(js + '\nZoomProbe', {THREE});

function withCamera() {
  const service = new ZoomProbe();
  const camera = {
    zoom: 1,
    projections: 0,
    updateProjectionMatrix() { this.projections++; },
    updateMatrixWorld() {},
  };
  service.camera = camera;
  return { service, camera };
}

test('pointer zoom holds the selected chart point still and fit recentres', () => {
  const service = new ZoomProbe();
  const camera = new THREE.PerspectiveCamera(75,1,0.1,1000);
  camera.position.z=3;
  camera.updateProjectionMatrix();camera.updateMatrixWorld();
  service.camera=camera;
  service.canvas={getBoundingClientRect:()=>({left:20,top:30,width:400,height:400})};
  const target=new THREE.Vector3(0.8,-0.45,0);
  const pixel=()=>{camera.updateMatrixWorld();const p=target.clone().project(camera);return [20+(p.x+1)*200,30+(1-p.y)*200];};
  const before=pixel();
  service.zoomAt(before[0],before[1],2);
  const after=pixel();
  assert.ok(Math.abs(before[0]-after[0])<1e-6 && Math.abs(before[1]-after[1])<1e-6);
  assert.ok(Math.abs(camera.position.x)>0.1);
  service.resetFraming();
  assert.equal(camera.position.x,0);assert.equal(camera.position.y,0);assert.equal(camera.zoom,1);
});

test('NaN, infinite and non-number zoom inputs do not corrupt the camera', () => {
  const { service, camera } = withCamera();
  service.setZoom(1.75);
  assert.equal(camera.zoom, 1.75);
  const initialProjections = camera.projections;
  const initialRenders = service.renderCalls;

  for (const invalid of [NaN, Infinity, -Infinity, undefined, null, '2']) {
    service.setZoom(invalid);
    assert.equal(service.zoomValue, 1.75);
    assert.equal(camera.zoom, 1.75);
    assert.equal(camera.projections, initialProjections);
    assert.equal(service.renderCalls, initialRenders);
  }
});

test('valid zooms retain original bounds and trigger one projection/render update', () => {
  const { service, camera } = withCamera();
  for (const [value, expected] of [[0, 0.05], [-100, 0.05], [0.7, 0.7], [999, 5]]) {
    const before = camera.projections;
    const renders = service.renderCalls;
    service.setZoom(value);
    assert.equal(service.zoomValue, expected);
    assert.equal(camera.zoom, expected);
    assert.equal(camera.projections, before + 1);
    assert.equal(service.renderCalls, renders + 1);
  }
});

test('zoomIn/zoomOut cannot inject NaN through custom steps', () => {
  const { service, camera } = withCamera();
  service.setZoom(2);
  const before = camera.projections;
  service.zoomIn(NaN);
  service.zoomOut(Infinity);
  assert.equal(camera.zoom, 2);
  assert.equal(camera.projections, before);
  service.zoomIn(0.25);
  assert.equal(camera.zoom, 2.25);
  service.zoomOut(0.5);
  assert.equal(camera.zoom, 1.75);
});

test('zoom input validation also preserves finite state before camera initialization', () => {
  const service = new ZoomProbe();
  service.setZoom(NaN);
  assert.equal(service.zoomValue, 1);
  service.setZoom(0.25);
  assert.equal(service.zoomValue, 0.25);
  assert.equal(service.renderCalls, 0);
});

test('latitude framing can be reduced by the host without changing other consumers', () => {
  const service = new ZoomProbe();
  assert.equal(service.chartCameraDistance('latitudini', {}, {}), 2.98);
  assert.equal(service.chartCameraDistance('latitudini', {}, {latitudiniDistanzaCamera:3.25}), 3.25);
  for (const invalid of [NaN, Infinity, 1, 10, '3.25']) {
    assert.equal(service.chartCameraDistance('latitudini', {}, {latitudiniDistanzaCamera:invalid}), 2.98);
  }
});
