import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

// Execute the real TypeScript module without loading the Angular/Three.js renderer.
// Three.js is imported only as a type, so no browser or WebGL context is needed.
const source = readFileSync(new URL('../src/lib/renderers/scene-animations.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { registerSceneAnimation, stopSceneAnimations } = await import(
  'data:text/javascript;base64,' + Buffer.from(output).toString('base64')
);

test('duplicate registration and repeated stopping kill the timeline exactly once', () => {
  const object = {};
  let kills = 0;
  const timeline = { kill() { kills += 1; } };
  registerSceneAnimation(object, timeline);
  registerSceneAnimation(object, timeline);
  stopSceneAnimations(object);
  stopSceneAnimations(object);
  assert.equal(kills, 1);
});

test('distinct animations on an object are each stopped', () => {
  const object = {};
  const stopped = [];
  registerSceneAnimation(object, { kill() { stopped.push('first'); } });
  registerSceneAnimation(object, { kill() { stopped.push('second'); } });
  stopSceneAnimations(object);
  assert.deepEqual(stopped, ['first', 'second']);
});

test('a timeline on another scene object is not stopped', () => {
  const firstObject = {};
  const secondObject = {};
  const stopped = [];
  registerSceneAnimation(firstObject, { kill() { stopped.push('first'); } });
  registerSceneAnimation(secondObject, { kill() { stopped.push('second'); } });
  stopSceneAnimations(firstObject);
  assert.deepEqual(stopped, ['first']);
  stopSceneAnimations(secondObject);
  assert.deepEqual(stopped, ['first', 'second']);
});

test('a timeline registered during kill remains tracked for the next stop', () => {
  const object = {};
  const stopped = [];
  registerSceneAnimation(object, {
    kill() {
      stopped.push('old');
      registerSceneAnimation(object, { kill() { stopped.push('replacement'); } });
    },
  });
  stopSceneAnimations(object);
  assert.deepEqual(stopped, ['old']);
  stopSceneAnimations(object);
  assert.deepEqual(stopped, ['old', 'replacement']);
});

test('stop called from kill is safe and does not run the same timeline again', () => {
  const object = {};
  let kills = 0;
  registerSceneAnimation(object, { kill() { kills += 1; stopSceneAnimations(object); } });
  stopSceneAnimations(object);
  assert.equal(kills, 1);
});

test('a failing kill does not prevent later animations from being stopped', () => {
  const object = {};
  const calls = [];
  const failure = new Error('first kill failed');
  registerSceneAnimation(object, { kill() { calls.push('first'); throw failure; } });
  registerSceneAnimation(object, { kill() { calls.push('second'); } });
  assert.throws(() => stopSceneAnimations(object), error => error === failure);
  assert.deepEqual(calls, ['first', 'second']);
  stopSceneAnimations(object);
  assert.deepEqual(calls, ['first', 'second']);
});

test('multiple kill failures are reported without skipping other timelines', () => {
  const object = {};
  const calls = [];
  const first = new Error('first');
  const second = new TypeError('second');
  registerSceneAnimation(object, { kill() { calls.push('first'); throw first; } });
  registerSceneAnimation(object, { kill() { calls.push('middle'); } });
  registerSceneAnimation(object, { kill() { calls.push('second'); throw second; } });
  assert.throws(() => stopSceneAnimations(object), error => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors, [first, second]);
    return true;
  });
  assert.deepEqual(calls, ['first', 'middle', 'second']);
});

test('replacement registered during a failing kill survives for next cleanup', () => {
  const object = {};
  const calls = [];
  const failure = new Error('kill failed');
  registerSceneAnimation(object, { kill() {
    calls.push('old');
    registerSceneAnimation(object, { kill() { calls.push('new'); } });
    throw failure;
  } });
  assert.throws(() => stopSceneAnimations(object), error => error === failure);
  assert.deepEqual(calls, ['old']);
  stopSceneAnimations(object);
  assert.deepEqual(calls, ['old', 'new']);
});
