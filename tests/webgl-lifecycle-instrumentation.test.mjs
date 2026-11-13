import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Execute the exact WebGL instrumentation callback used by the browser test.
// The fake contexts avoid needing a GPU, Chrome, Angular or native dependencies.
const browserSource = readFileSync(new URL('./webgl-lifecycle.browser.test.mjs', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('webgl-lifecycle.browser.test.mjs', browserSource, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
const callbacks = [];
function visit(node) {
  if (ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'addInitScript') {
    callbacks.push(node.arguments[0]?.getText(parsed));
  }
  ts.forEachChild(node, visit);
}
visit(parsed);
assert.equal(callbacks.length, 1, 'Expected exactly one browser WebGL instrumentation callback');

function instrumentation(overrides = false) {
  const listeners = new Map();
  let id = 0;
  class WebGL1 {
    createTexture() { return { id: ++id }; }
    deleteTexture() {}
  }
  class WebGL2 extends WebGL1 {}
  if (overrides) {
    WebGL2.prototype.createTexture = function() { return { id: ++id, webgl2: true }; };
    WebGL2.prototype.deleteTexture = function() {};
  }
  const sandbox = {
    WebGLRenderingContext: WebGL1,
    WebGL2RenderingContext: WebGL2,
    document: { addEventListener(type, callback) { listeners.set(type, callback); } },
  };
  const init = runInNewContext('(' + callbacks[0] + ')', sandbox);
  init();
  return { WebGL1, WebGL2, stats: sandbox.__webglLife, listeners };
}

test('tracks WebGL1 creation and deletion once per non-null handle', () => {
  const { WebGL1, stats } = instrumentation();
  const gl = new WebGL1();
  const texture = gl.createTexture();
  gl.deleteTexture(texture);
  gl.deleteTexture(null);
  assert.deepEqual({created: stats.created, deleted: stats.deleted}, {created: 1, deleted: 1});
});

test('does not double-wrap WebGL2 inherited texture methods', () => {
  const { WebGL2, stats } = instrumentation();
  const gl = new WebGL2();
  const texture = gl.createTexture();
  gl.deleteTexture(texture);
  assert.equal(stats.created, 1);
  assert.equal(stats.deleted, 1);
});

test('counts WebGL2 own-method overrides once', () => {
  const { WebGL2, stats } = instrumentation(true);
  const gl = new WebGL2();
  const texture = gl.createTexture();
  gl.deleteTexture(texture);
  assert.equal(stats.created, 1);
  assert.equal(stats.deleted, 1);
});

test('records WebGL context lost for the browser acceptance gate', () => {
  const { listeners, stats } = instrumentation();
  assert.equal(stats.contextLost, 0);
  assert.equal(typeof listeners.get('webglcontextlost'), 'function');
  listeners.get('webglcontextlost')();
  assert.equal(stats.contextLost, 1);
});
