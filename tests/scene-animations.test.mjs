import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Execute the committed TypeScript source without a browser or Three.js runtime.
// Three.js is type-only here; production still owns the Object3D lifecycle.
const source = readFileSync(new URL('../src/lib/renderers/scene-animations.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { registerSceneAnimation, stopSceneAnimations } = await import(
  'data:text/javascript;base64,' + Buffer.from(output).toString('base64')
);

test('stops every registered animation once and supports a fresh generation', () => {
  const object = {};
  const calls = [];
  registerSceneAnimation(object, { kill: () => calls.push('first') });
  registerSceneAnimation(object, { kill: () => calls.push('second') });
  stopSceneAnimations(object);
  stopSceneAnimations(object);
  assert.deepEqual(calls, ['first', 'second']);

  registerSceneAnimation(object, { kill: () => calls.push('new generation') });
  stopSceneAnimations(object);
  assert.deepEqual(calls, ['first', 'second', 'new generation']);
});

test('broken kill does not prevent the remaining timeline from stopping', () => {
  const object = {};
  const calls = [];
  const previousWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args);
  try {
    registerSceneAnimation(object, { kill() { calls.push('broken'); throw new Error('failure'); } });
    registerSceneAnimation(object, { kill() { calls.push('working'); } });
    assert.doesNotThrow(() => stopSceneAnimations(object));
    stopSceneAnimations(object);
    assert.deepEqual(calls, ['broken', 'working']);
    assert.deepEqual(warnings, [['Failed to stop 1 scene animation(s) during cleanup.']]);
  } finally {
    console.warn = previousWarn;
  }
});

test('re-entrant stop cannot kill the same animation twice', () => {
  const object = {};
  let calls = 0;
  registerSceneAnimation(object, {
    kill() {
      calls++;
      stopSceneAnimations(object);
    },
  });
  stopSceneAnimations(object);
  assert.equal(calls, 1);
});

test('unregistered objects are safe to stop', () => {
  assert.doesNotThrow(() => stopSceneAnimations({}));
});
