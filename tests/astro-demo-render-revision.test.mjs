import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

// Exercise the *actual* DemoComponent.draw() TypeScript without loading Angular,
// browsers, private graphics or WebGL. This detects request-cancellation races.
const source = readFileSync(new URL('../demo/main.ts', import.meta.url), 'utf8');
const file = ts.createSourceFile('demo/main.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const component = file.statements.find(node =>
  ts.isClassDeclaration(node) && node.name?.text === 'DemoComponent'
);
assert.ok(component, 'DemoComponent not found');
const draw = component.members.find(node =>
  ts.isMethodDeclaration(node) && node.name.getText(file) === 'draw'
);
assert.ok(draw, 'DemoComponent.draw() not found');
const output = ts.transpileModule(
  'class DrawHarness {\n' + draw.getText(file) + '\n}',
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }
).outputText;
const Harness = new Function(output + '\nreturn DrawHarness;')();

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function createHarness() {
  const instance = new Harness();
  const pending = [];
  let markCount = 0;
  instance.renderer = { disegnaScena: () => {
    const item = deferred();
    pending.push(item);
    return item.promise;
  }};
  instance.changes = { markForCheck: () => { markCount++; }};
  instance.drawRequest = 0;
  instance.renderRevision = 0;
  instance.busy = false;
  instance.error = '';
  instance.status = '';
  instance.mode = 'natal';
  instance.radix = { fixture: 'private-free' };
  instance.transit = null;
  instance.synastry = null;
  instance.options = () => ({});
  instance.showError = error => {
    instance.error = error instanceof Error ? error.message : String(error);
    instance.status = 'Rendering failed: ' + instance.error;
  };
  return { instance, pending, marks: () => markCount };
}

test('an obsolete completed draw must not advance the visible revision or unlock controls', async () => {
  const { instance, pending, marks } = createHarness();
  const earlier = instance.draw();
  const latest = instance.draw();
  assert.equal(instance.busy, true);
  assert.equal(pending.length, 2);
  pending[0].resolve();
  await earlier;
  assert.equal(instance.renderRevision, 0);
  assert.equal(instance.busy, true);
  assert.equal(instance.status, 'Rendering…');
  pending[1].resolve();
  await latest;
  assert.equal(instance.renderRevision, 1);
  assert.equal(instance.busy, false);
  assert.match(instance.status, /^Rendered/);
  assert.ok(marks() >= 3);
});

test('an obsolete rejected draw does not overwrite the latest status with an error', async () => {
  const { instance, pending } = createHarness();
  const old = instance.draw();
  const current = instance.draw();
  pending[0].reject(new Error('old chart asset missing'));
  await old;
  assert.equal(instance.error, '');
  assert.equal(instance.busy, true);
  pending[1].resolve();
  await current;
  assert.equal(instance.renderRevision, 1);
  assert.equal(instance.error, '');
  assert.equal(instance.busy, false);
});

test('a latest rejected draw unlocks controls, reports its error, and does not advance revision', async () => {
  const { instance, pending } = createHarness();
  const run = instance.draw();
  pending[0].reject(new Error('current private mask rejected'));
  await run;
  assert.equal(instance.renderRevision, 0);
  assert.equal(instance.busy, false);
  assert.match(instance.status, /current private mask rejected/);
});
