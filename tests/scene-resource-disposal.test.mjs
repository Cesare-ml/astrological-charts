import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import ts from 'typescript';

// Extract the actual private helpers and lifecycle method from the Angular service.
// No WebGL context, Angular bootstrap or real image assets are needed for this
// narrow disposal contract regression.
const source = readFileSync(new URL('../src/lib/services/grafico-render.service.ts', import.meta.url), 'utf8');
const file = ts.createSourceFile('grafico-render.service.ts', source, ts.ScriptTarget.ES2022, true);
const helper = file.statements.find(statement =>
  ts.isFunctionDeclaration(statement) && statement.name?.text === 'disposeSceneResources');
assert.ok(helper, 'The source must declare disposeSceneResources');
const transpile = text => ts.transpileModule(text, {
  compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext},
}).outputText;

class FakeTexture {
  constructor(dispose) { this.dispose = dispose; }
}
const factory = new Function('THREE', 'stopSceneAnimations',
  transpile(helper.getText(file)) + '\nreturn disposeSceneResources;');
const makeDispose = stopSceneAnimations => factory({Texture: FakeTexture}, stopSceneAnimations);
const root = (...objects) => ({traverse(visitor) { for (const object of objects) visitor(object); }});
const resource = (name, events, failure) => ({dispose() {
  events.push(name);
  if (failure) throw failure;
}});

test('shared textures, materials and geometries are disposed once', () => {
  const events = [];
  const texture = new FakeTexture(() => events.push('texture'));
  const material = {...resource('material', events), map: texture};
  const geometry = resource('geometry', events);
  const node = {geometry, material};
  makeDispose(object => events.push(object === node ? 'stop' : 'other'))(root(node, node));
  assert.deepEqual(events, ['stop', 'stop', 'texture', 'material', 'geometry']);
});

test('failed animation does not block texture, material or geometry release', () => {
  const events = [];
  const failure = new Error('kill failed');
  const a = {geometry: resource('geometry', events), material: {
    ...resource('material', events), map: new FakeTexture(() => events.push('texture')),
  }};
  const b = {geometry: resource('next geometry', events), material: resource('next material', events)};
  const dispose = makeDispose(object => {events.push(object === a ? 'stop a' : 'stop b'); if (object === a) throw failure;});
  assert.throws(() => dispose(root(a, b)), error => error === failure);
  assert.deepEqual(events, ['stop a', 'stop b', 'texture', 'material', 'next material', 'geometry', 'next geometry']);
});

test('failing resource disposers do not skip later disposers, and report all errors', () => {
  const events = [];
  const stopError = new Error('animation');
  const textureError = new Error('texture');
  const materialError = new Error('material');
  const geometryError = new Error('geometry');
  const object = {geometry: resource('geometry', events, geometryError), material: [
    {...resource('material', events, materialError), map: new FakeTexture(() => {
      events.push('texture'); throw textureError;
    })},
    resource('second material', events),
  ]};
  const dispose = makeDispose(() => {throw stopError;});
  assert.throws(() => dispose(root(object)), error => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors, [stopError, textureError, materialError, geometryError]);
    return true;
  });
  assert.deepEqual(events, ['texture', 'material', 'second material', 'geometry']);
});

test('successful multi-material cleanup includes all direct texture properties', () => {
  const events = [];
  const map = new FakeTexture(() => events.push('map'));
  const normal = new FakeTexture(() => events.push('normal'));
  const m1 = {...resource('m1', events), map, normalMap: normal};
  const m2 = {...resource('m2', events), map};
  makeDispose(() => {})(root({material: [m1, m2]}));
  assert.deepEqual(events, ['map', 'normal', 'm1', 'm2']);
});

// Run the real ngOnDestroy method in a small class, substituting only the
// scene/renderer dependencies. This guards cleanup after a disposal exception.
const service = file.statements.find(statement =>
  ts.isClassDeclaration(statement) && statement.name?.text === 'GraficoRenderService');
assert.ok(service);
const destroy = service.members.find(member =>
  ts.isMethodDeclaration(member) && member.name.getText(file) === 'ngOnDestroy');
assert.ok(destroy);
const destroyFactory = new Function('disposeSceneResources', 'cancelAnimationFrame',
  transpile('class Harness { ' + destroy.getText(file) + ' }') + '\nreturn Harness;');

test('ngOnDestroy releases canvas scene and renderer despite animation failure', () => {
  const events = [];
  const failure = new Error('kill failed');
  const scene = {clear() {events.push('scene clear');}};
  const renderer = {dispose() {events.push('renderer dispose');}};
  const Harness = destroyFactory(() => {events.push('resource cleanup'); throw failure;},
    () => events.push('cancel animation frame'));
  const instance = Object.assign(new Harness(), {drawGeneration: 3, frameId: 12,
    resizeSub: {unsubscribe() {events.push('unsubscribe resize');}},
    scene, renderer, camera: {}, isInizializzato: true});
  assert.throws(() => instance.ngOnDestroy(), error => error === failure);
  assert.deepEqual(events, ['cancel animation frame', 'unsubscribe resize',
    'resource cleanup', 'scene clear', 'renderer dispose']);
  assert.equal(instance.renderer, null);
  assert.equal(instance.scene, null);
  assert.equal(instance.camera, null);
  assert.equal(instance.isInizializzato, false);
  assert.equal(instance.drawGeneration, 4);
});

test('ngOnDestroy reports cleanup and renderer failures after attempting both', () => {
  const events = [];
  const first = new Error('cleanup');
  const second = new Error('renderer');
  const Harness = destroyFactory(() => {throw first;}, () => {});
  const instance = Object.assign(new Harness(), {drawGeneration: 0,
    scene: {clear() {events.push('clear');}},
    renderer: {dispose() {events.push('dispose'); throw second;}},
    isInizializzato: true});
  assert.throws(() => instance.ngOnDestroy(), error => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors, [first, second]);
    return true;
  });
  assert.deepEqual(events, ['clear', 'dispose']);
  assert.equal(instance.renderer, null);
  assert.equal(instance.scene, null);
});

test('errors from animations on separate objects are aggregated in traversal order', () => {
  const events = [];
  const first = new Error('first animation');
  const second = new Error('second animation');
  const a = {geometry: resource('geometry a', events)};
  const b = {geometry: resource('geometry b', events)};
  const dispose = makeDispose(object => {throw object === a ? first : second;});
  assert.throws(() => dispose(root(a, b)), error => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors, [first, second]);
    return true;
  });
  assert.deepEqual(events, ['geometry a', 'geometry b']);
});

test('ngOnDestroy resets state even if resize unsubscribe and scene clear throw', () => {
  const unsubscribeError = new Error('unsubscribe failed');
  const clearError = new Error('clear failed');
  const events = [];
  const Harness = destroyFactory(() => events.push('resources'), () => {});
  const instance = Object.assign(new Harness(), {drawGeneration: 7,
    resizeSub: {unsubscribe() {throw unsubscribeError;}},
    scene: {clear() {events.push('clear'); throw clearError;}},
    renderer: {dispose() {events.push('renderer');}},
    camera: {}, isInizializzato: true});
  assert.throws(() => instance.ngOnDestroy(), error => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors, [unsubscribeError, clearError]);
    return true;
  });
  assert.deepEqual(events, ['resources', 'clear', 'renderer']);
  assert.equal(instance.drawGeneration, 8);
  assert.equal(instance.isInizializzato, false);
  assert.equal(instance.camera, null);
  assert.equal(instance.scene, null);
  assert.equal(instance.renderer, null);
});
