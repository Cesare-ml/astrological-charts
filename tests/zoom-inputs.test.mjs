import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the actual service methods without creating Angular or a WebGL context.
// TypeScript's parser extracts the three methods, so renaming/removing one fails
// the test instead of silently testing a duplicated hand-written implementation.
const source = readFileSync(new URL('../src/lib/services/grafico-render.service.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('grafico-render.service.ts', source, ts.ScriptTarget.Latest, true);
const klass = ast.statements.find(node =>
  ts.isClassDeclaration(node) && node.name?.text === 'GraficoRenderService');
assert.ok(klass, 'GraficoRenderService class must exist');

const names = ['setZoom', 'zoomIn', 'zoomOut'];
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
const ZoomProbe = vm.runInNewContext(js + '\nZoomProbe');

function withCamera() {
  const service = new ZoomProbe();
  const camera = {
    zoom: 1,
    projections: 0,
    updateProjectionMatrix() { this.projections++; },
  };
  service.camera = camera;
  return { service, camera };
}

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
