import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import ts from 'typescript';

// Test the actual TypeScript methods instead of maintaining a second renderer
// implementation. Browser/GPU and PNG pixel parity require separate QA.
const source = readFileSync(new URL('../src/lib/services/grafico-render.service.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('grafico-render.service.ts', source, ts.ScriptTarget.ES2022, true);
const helper = ast.statements.find(item =>
  ts.isFunctionDeclaration(item) && item.name?.text === 'disposeAndClearScene');
const service = ast.statements.find(item =>
  ts.isClassDeclaration(item) && item.name?.text === 'GraficoRenderService');
assert.ok(helper && service, 'Expected scene helper and Angular renderer service');
const method = name => {
  const node = service.members.find(item =>
    ts.isMethodDeclaration(item) && item.name.getText(ast) === name);
  assert.ok(node, `Missing renderer method: ${name}`);
  return node.getText(ast);
};
const transpile = text => ts.transpileModule(text, {
  compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext},
}).outputText;
const makeHelper = new Function('disposeSceneResources',
  transpile(helper.getText(ast)) + '\nreturn disposeAndClearScene;');
const makeClass = new Function(
  'THREE', 'OggettiSempliciRender', 'LatitudiniRender', 'CartaAstraleCreaScena',
  'waitForSceneTextures', 'disposeSceneResources', 'disposeAndClearScene',
  'SkinManager', 'document',
  transpile(`class GraficoRenderService {
    static runExclusive(operation) { return Promise.resolve().then(operation); }
    ${method('disegnaScena')}
    ${method('generaImmagineInterna')}
  }`) + '\nreturn GraficoRenderService;',
);

function fixture({create, wait, dispose, clear, render, rendererDispose, png, sceneCreateError, add} = {}) {
  const events = [];
  const renderers = [];
  let constructedScenes = 0;
  class Scene {
    constructor() {
      if (sceneCreateError && ++constructedScenes > 1) throw sceneCreateError;
    }
    kind = 'scene';
    children = [];
    add(child) { events.push(`add:${child.kind}`); add?.(child, this); this.children.push(child); }
    clear() { events.push('clear'); clear?.(); this.children = []; }
  }
  class Renderer {
    constructor({canvas}) { this.domElement = canvas; renderers.push(this); }
    setPixelRatio() {}
    setSize() {}
    render() { events.push('render'); render?.(); }
    dispose() { events.push('renderer-dispose'); rendererDispose?.(); }
  }
  const cleanup = object => {
    events.push(`dispose:${object.kind}`);
    dispose?.(object);
  };
  const disposeAndClearScene = makeHelper(cleanup);
  const THREE = {
    Scene,
    WebGLRenderer: Renderer,
    PerspectiveCamera: class { position = {z: 0}; kind = 'camera'; },
    Color: class { constructor(value) { this.value = value; } },
  };
  const document = {createElement(type) {
    assert.equal(type, 'canvas');
    return {width: 0, height: 0, toDataURL(mime) {
      assert.equal(mime, 'image/png');
      events.push('png');
      return png?.() ?? 'data:image/png;base64,fixture';
    }};
  }};
  const Harness = makeClass(THREE, {setDimensioniCanvas() {}},
    {creaScena: async () => create ? create() : {kind: 'candidate'}},
    async () => create ? create() : {kind: 'candidate'},
    async scene => { events.push('wait'); await wait?.(scene); },
    cleanup, disposeAndClearScene, {skins: {light: {bgColor: '#fff'}}}, document);
  const makeService = () => Object.assign(new Harness(), {
    drawGeneration: 0, dimensioni: {x: 100, y: 100}, scene: new Scene(),
    camera: {kind: 'camera'}, render() {events.push('draw-render');},
  });
  const options = {settaggi: {skin_id: 'light'}};
  return {events, renderers, makeService, options, disposeAndClearScene, Scene};
}

test('redraw installs a new scene after disposing and clearing the old scene', async () => {
  const f = fixture();
  const service = f.makeService();
  await service.disegnaScena({}, null, null, 'carta-astrale', f.options);
  assert.deepEqual(f.events, ['wait', 'dispose:scene', 'clear',
    'add:camera', 'add:candidate', 'draw-render']);
  assert.equal(f.events.includes('dispose:candidate'), false);
});

test('old-scene cleanup failure still clears the old scene and disposes the candidate', async () => {
  const failure = new Error('old scene cleanup');
  const f = fixture({dispose: object => {
    if (object.kind === 'scene') throw failure;
  }});
  const service = f.makeService();
  await assert.rejects(
    service.disegnaScena({}, null, null, 'carta-astrale', f.options),
    error => error === failure,
  );
  assert.deepEqual(f.events, ['wait', 'dispose:scene', 'clear', 'dispose:candidate']);
});

test('texture wait failure and candidate cleanup error both reach caller', async () => {
  const waitError = new Error('texture wait');
  const disposeError = new Error('candidate dispose');
  const f = fixture({
    wait: async () => { throw waitError; },
    dispose: object => { if (object.kind === 'candidate') throw disposeError; },
  });
  const service = f.makeService();
  await assert.rejects(
    service.disegnaScena({}, null, null, 'carta-astrale', f.options),
    error => {
      assert.ok(error instanceof AggregateError);
      assert.deepEqual(error.errors, [waitError, disposeError]);
      return true;
    },
  );
  assert.deepEqual(f.events, ['wait', 'dispose:candidate']);
});

test('obsolete redraw disposes newly built scene without touching the old scene', async () => {
  let service;
  const f = fixture({wait: async () => { service.drawGeneration += 1; }});
  service = f.makeService();
  await service.disegnaScena({}, null, null, 'carta-astrale', f.options);
  assert.deepEqual(f.events, ['wait', 'dispose:candidate']);
});

test('successful PNG render still releases offscreen scene and renderer', async () => {
  const f = fixture();
  const result = await f.makeService().generaImmagineInterna(
    {}, null, null, 'carta-astrale', f.options, {x: 20, y: 20}, 2,
  );
  assert.equal(result, 'data:image/png;base64,fixture');
  assert.deepEqual(f.events, ['add:camera', 'add:candidate', 'wait',
    'render', 'png', 'dispose:scene', 'clear', 'renderer-dispose']);
  assert.equal(f.renderers.length, 1);
});

test('PNG render failure retains original error and releases offscreen renderer', async () => {
  const renderError = new Error('render failed');
  const cleanupError = new Error('scene cleanup failed');
  const f = fixture({
    render: () => { throw renderError; },
    dispose: object => { if (object.kind === 'scene') throw cleanupError; },
  });
  await assert.rejects(
    f.makeService().generaImmagineInterna(
      {}, null, null, 'carta-astrale', f.options, {x: 20, y: 20}, 1,
    ),
    error => {
      assert.ok(error instanceof AggregateError);
      assert.deepEqual(error.errors, [renderError, cleanupError]);
      return true;
    },
  );
  assert.deepEqual(f.events.slice(-3), ['dispose:scene', 'clear', 'renderer-dispose']);
});

test('PNG cleanup attempts offscreen renderer disposal even when scene cleanup throws', async () => {
  const sceneError = new Error('scene');
  const rendererError = new Error('renderer');
  const f = fixture({
    dispose: object => { if (object.kind === 'scene') throw sceneError; },
    rendererDispose: () => { throw rendererError; },
  });
  await assert.rejects(
    f.makeService().generaImmagineInterna(
      {}, null, null, 'carta-astrale', f.options, {x: 20, y: 20}, 1,
    ),
    error => {
      assert.ok(error instanceof AggregateError);
      assert.deepEqual(error.errors, [sceneError, rendererError]);
      return true;
    },
  );
  assert.deepEqual(f.events.slice(-3), ['dispose:scene', 'clear', 'renderer-dispose']);
});

test('dispose-and-clear helper attempts clear even if resource disposal fails', () => {
  const disposedError = new Error('dispose');
  const clearError = new Error('clear');
  const f = fixture({
    dispose: () => { throw disposedError; },
    clear: () => { throw clearError; },
  });
  assert.throws(() => f.disposeAndClearScene(new f.Scene()), error => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors, [disposedError, clearError]);
    return true;
  });
  assert.deepEqual(f.events, ['dispose:scene', 'clear']);
});

test('PNG renderer is released when offscreen scene constructor throws', async () => {
  const failure = new Error('scene constructor failed');
  const f = fixture({sceneCreateError: failure});
  const service = f.makeService();
  await assert.rejects(
    service.generaImmagineInterna(
      {}, null, null, 'carta-astrale', f.options, {x: 20, y: 20}, 1,
    ),
    error => error === failure,
  );
  assert.deepEqual(f.events, ['renderer-dispose']);
  assert.equal(f.renderers.length, 1);
});


test('PNG scene add failure cleans up an unattached drawing and offscreen renderer', async () => {
  const failure = new Error('cannot attach drawing');
  const f = fixture({add(child) { if (child.kind === 'candidate') throw failure; }});
  await assert.rejects(
    f.makeService().generaImmagineInterna(
      {}, null, null, 'carta-astrale', f.options, {x: 20, y: 20}, 1,
    ),
    error => error === failure,
  );
  assert.deepEqual(f.events, [
    'add:camera', 'add:candidate', 'dispose:candidate', 'dispose:scene', 'clear', 'renderer-dispose',
  ]);
});

test('PNG add failure and detached drawing disposal failure preserve both errors', async () => {
  const attachmentError = new Error('cannot attach drawing');
  const cleanupError = new Error('cannot release unattached drawing');
  const f = fixture({
    add(child) { if (child.kind === 'candidate') throw attachmentError; },
    dispose(object) { if (object.kind === 'candidate') throw cleanupError; },
  });
  await assert.rejects(
    f.makeService().generaImmagineInterna(
      {}, null, null, 'carta-astrale', f.options, {x: 20, y: 20}, 1,
    ),
    error => {
      assert.ok(error instanceof AggregateError);
      assert.deepEqual(error.errors, [attachmentError, cleanupError]);
      return true;
    },
  );
  assert.deepEqual(f.events, [
    'add:camera', 'add:candidate', 'dispose:candidate', 'dispose:scene', 'clear', 'renderer-dispose',
  ]);
});

test('PNG partially attached drawing is left for scene cleanup instead of double disposal', async () => {
  const failure = new Error('attachment failed after parenting');
  const f = fixture({add(child, scene) {
    if (child.kind === 'candidate') {
      scene.children.push(child);
      throw failure;
    }
  }});
  await assert.rejects(
    f.makeService().generaImmagineInterna(
      {}, null, null, 'carta-astrale', f.options, {x: 20, y: 20}, 1,
    ),
    error => error === failure,
  );
  assert.deepEqual(f.events, [
    'add:camera', 'add:candidate', 'dispose:scene', 'clear', 'renderer-dispose',
  ]);
});
