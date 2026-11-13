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

test('animation-frame cancellation error does not skip scene and renderer teardown', () => {
  const events = [];
  const failure = new Error('cancel failed');
  const Harness = destroyFactory(() => events.push('resources'), () => {
    events.push('cancel');
    throw failure;
  });
  const instance = Object.assign(new Harness(), {
    drawGeneration: 1, frameId: 7,
    resizeSub: {unsubscribe() {events.push('unsubscribe');}},
    scene: {clear() {events.push('clear');}},
    renderer: {dispose() {events.push('renderer');}},
    camera: {}, isInizializzato: true,
  });
  assert.throws(() => instance.ngOnDestroy(), error => error === failure);
  assert.deepEqual(events, ['cancel', 'unsubscribe', 'resources', 'clear', 'renderer']);
  assert.equal(instance.frameId, null);
  assert.equal(instance.resizeSub, null);
  assert.equal(instance.renderer, null);
  assert.equal(instance.scene, null);
  assert.equal(instance.camera, null);
  assert.equal(instance.isInizializzato, false);
});

test('repeated ngOnDestroy does not cancel the same frame or unsubscribe twice', () => {
  const events = [];
  const Harness = destroyFactory(() => events.push('resources'), () => events.push('cancel'));
  const instance = Object.assign(new Harness(), {
    drawGeneration: 0, frameId: 11,
    resizeSub: {unsubscribe() {events.push('unsubscribe');}},
    scene: {clear() {events.push('clear');}},
    renderer: {dispose() {events.push('renderer');}},
    camera: {}, isInizializzato: true,
  });
  instance.ngOnDestroy();
  instance.ngOnDestroy();
  assert.deepEqual(events, ['cancel', 'unsubscribe', 'resources', 'clear', 'renderer']);
  assert.equal(instance.frameId, null);
  assert.equal(instance.resizeSub, null);
  assert.equal(instance.isInizializzato, false);
});

test('cancel, cleanup, and renderer failures are all reported in order', () => {
  const events = [];
  const cancelError = new Error('cancel');
  const cleanupError = new Error('cleanup');
  const rendererError = new Error('renderer');
  const Harness = destroyFactory(() => {events.push('resources'); throw cleanupError;}, () => {
    events.push('cancel'); throw cancelError;
  });
  const instance = Object.assign(new Harness(), {
    drawGeneration: 0, frameId: 1,
    scene: {clear() {events.push('clear');}},
    renderer: {dispose() {events.push('renderer'); throw rendererError;}},
    isInizializzato: true,
  });
  assert.throws(() => instance.ngOnDestroy(), error => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors, [cancelError, cleanupError, rendererError]);
    return true;
  });
  assert.deepEqual(events, ['cancel', 'resources', 'clear', 'renderer']);
  assert.equal(instance.frameId, null);
  assert.equal(instance.renderer, null);
});

test('animation kill cannot hide material and geometry from disposal', () => {
  const events = [];
  const texture = new FakeTexture(() => events.push('texture'));
  const node = {
    geometry: resource('geometry', events),
    material: {...resource('material', events), map: texture},
  };
  const dispose = makeDispose(object => {
    if (object === node) {
      events.push('kill');
      node.geometry = null;
      node.material = null;
    }
  });
  dispose(root(node));
  assert.deepEqual(events, ['kill', 'texture', 'material', 'geometry']);
});

test('animation kill detaching a sibling cannot skip its resource disposal', () => {
  const events = [];
  const first = {
    geometry: resource('geometry first', events),
    material: resource('material first', events),
  };
  const second = {
    geometry: resource('geometry second', events),
    material: resource('material second', events),
  };
  const scene = {
    children: [first, second],
    traverse(visitor) {
      visitor(this);
      for (let i = 0; i < this.children.length; i++) visitor(this.children[i]);
    },
  };
  const dispose = makeDispose(object => {
    if (object === first) {
      events.push('kill first');
      scene.children.splice(1, 1);
    } else if (object === second) events.push('kill second');
  });
  dispose(scene);
  assert.deepEqual(events, [
    'kill first', 'kill second',
    'material first', 'material second', 'geometry first', 'geometry second',
  ]);
});

test('throwing geometry getter reports error but releases materials and other nodes', () => {
  const events = [];
  const failure = new Error('geometry read failed');
  const broken = {get geometry() {throw failure;}, material: resource('material broken', events)};
  const normal = {geometry: resource('geometry normal', events), material: resource('material normal', events)};
  const dispose = makeDispose(object => events.push(object === broken ? 'stop broken' : 'stop normal'));
  assert.throws(() => dispose(root(broken, normal)), error => error === failure);
  assert.deepEqual(events, [
    'stop broken', 'stop normal', 'material broken', 'material normal', 'geometry normal',
  ]);
});

test('throwing material getter reports error but releases geometries and siblings', () => {
  const events = [];
  const failure = new Error('material read failed');
  const broken = {geometry: resource('geometry broken', events), get material() {throw failure;}};
  const normal = {geometry: resource('geometry normal', events), material: resource('material normal', events)};
  const dispose = makeDispose(object => events.push(object === broken ? 'stop broken' : 'stop normal'));
  assert.throws(() => dispose(root(broken, normal)), error => error === failure);
  assert.deepEqual(events, [
    'stop broken', 'stop normal', 'material normal', 'geometry broken', 'geometry normal',
  ]);
});

test('throwing texture property getter retains material cleanup and other texture scans', () => {
  const events = [];
  const failure = new Error('material texture read failed');
  const broken = {...resource('material broken', events), get map() {throw failure;}};
  const good = {...resource('material good', events), map: new FakeTexture(() => events.push('texture good'))};
  const node = {geometry: resource('geometry', events), material: [broken, good]};
  const dispose = makeDispose(() => events.push('stop'));
  assert.throws(() => dispose(root(node)), error => error === failure);
  assert.deepEqual(events, ['stop', 'texture good', 'material broken', 'material good', 'geometry']);
});

test('traversal failure still stops captured animations and disposes known resources', () => {
  const events = [];
  const failure = new Error('traverse failed');
  const node = {geometry: resource('geometry', events), material: resource('material', events)};
  const scene = {traverse(visitor) {visitor(node); throw failure;}};
  const dispose = makeDispose(() => events.push('stop'));
  assert.throws(() => dispose(scene), error => error === failure);
  assert.deepEqual(events, ['stop', 'material', 'geometry']);
});
