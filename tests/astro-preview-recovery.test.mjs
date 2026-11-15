import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

// Run the actual Angular demo's TypeScript preview-recovery method in a pure
// Node harness. No browser, Angular, private artwork or network is required.
const source = readFileSync(new URL('../demo/main.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('demo/main.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const component = ast.statements.find(node =>
  ts.isClassDeclaration(node) && node.name?.text === 'DemoComponent'
);
assert.ok(component, 'DemoComponent not found');
const recovery = component.members.find(node =>
  ts.isMethodDeclaration(node) && node.name.getText(ast) === 'drawWithPreviewRecovery'
);
assert.ok(recovery, 'No private preview recovery method exists');
const compiled = ts.transpileModule(
  'class RecoveryHarness {\n' + recovery.getText(ast) + '\n}',
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }
).outputText;

const maskError = 'Rendering failed: Unable to load chart asset: http://127.0.0.1:4177/assets/img/virgostars-astro/masks/aries.png';

function harness(outcomes) {
  let configCalls = [];
  let marks = 0;
  const controller = {
    configureVirgoStarsAstroPreview: state => configCalls.push(state),
  };
  const Harness = new Function('GestoreImmagini',
    compiled + '\nreturn RecoveryHarness;'
  )(controller);
  const instance = new Harness();
  instance.drawRequest = 0;
  instance.renderRevision = 0;
  instance.astroPreviewEnabled = true;
  instance.error = '';
  instance.previewNotice = '';
  instance.changes = { markForCheck: () => { marks++; } };
  let draws = 0;
  instance.draw = async () => {
    instance.drawRequest++;
    instance.previewNotice = '';
    instance.error = outcomes[draws++] ?? '';
    if (!instance.error) instance.renderRevision++;
  };
  return { instance, calls: () => configCalls, draws: () => draws, marks: () => marks };
}

test('missing private mask automatically disables preview and redraws original assets', async () => {
  const { instance, calls, draws, marks } = harness([maskError, '']);
  await instance.drawWithPreviewRecovery();
  assert.equal(draws(), 2);
  assert.equal(instance.astroPreviewEnabled, false);
  assert.deepEqual(calls(), [false]);
  assert.equal(instance.error, '');
  assert.match(instance.previewNotice, /original symbols have been restored/);
  assert.equal(marks(), 1);
});

test('an unrelated missing asset remains an error and must not change preview', async () => {
  const other = 'Rendering failed: Unable to load chart asset: /assets/img/simboli-bianchi/case/01.png';
  const { instance, calls, draws } = harness([other]);
  await instance.drawWithPreviewRecovery();
  assert.equal(draws(), 1);
  assert.equal(instance.astroPreviewEnabled, true);
  assert.equal(instance.error, other);
  assert.equal(instance.previewNotice, '');
  assert.deepEqual(calls(), []);
});

test('successful preview retains the owner-approved masks and makes no second draw', async () => {
  const { instance, calls, draws } = harness(['']);
  await instance.drawWithPreviewRecovery();
  assert.equal(draws(), 1);
  assert.equal(instance.astroPreviewEnabled, true);
  assert.equal(instance.previewNotice, '');
  assert.deepEqual(calls(), []);
});

test('failed fallback preserves its real error and never falsely claims recovery', async () => {
  const fallback = 'Rendering failed: Unable to load chart asset: /assets/img/original-missing.png';
  const { instance, calls, draws } = harness([maskError, fallback]);
  await instance.drawWithPreviewRecovery();
  assert.equal(draws(), 2);
  assert.equal(instance.astroPreviewEnabled, false);
  assert.equal(instance.error, fallback);
  assert.equal(instance.previewNotice, '');
  assert.deepEqual(calls(), [false]);
});

test('recovery is skipped when a newer draw supersedes the preview request', async () => {
  const { instance, calls, draws } = harness([maskError]);
  instance.draw = async () => {
    instance.drawRequest += 2; // a later request superseded this one
    instance.error = maskError;
  };
  await instance.drawWithPreviewRecovery();
  assert.equal(instance.astroPreviewEnabled, true);
  assert.deepEqual(calls(), []);
});

test('demo shows a visible notice and routes initial, toggle and mode draws to recovery', () => {
  assert.match(source, /\{\{error \|\| previewNotice \|\| status\}\}/);
  assert.match(source, /void this\.drawWithPreviewRecovery\(\)/);
  assert.match(source, /configureVirgoStarsAstroPreview\(this\.astroPreviewEnabled\)/);
});

test('superseding a pending legacy fallback cannot falsely claim restoration', async () => {
  const { instance, calls, marks } = harness([maskError]);
  let resolveFallback;
  let draws = 0;
  instance.draw = async () => {
    instance.drawRequest++;
    if (++draws === 1) {
      instance.error = maskError;
      return;
    }
    await new Promise(resolve => { resolveFallback = resolve; });
  };
  const pending = instance.drawWithPreviewRecovery();
  // The first draw fails immediately; the legacy redraw is now waiting.
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(typeof resolveFallback, 'function');
  instance.drawRequest++;
  instance.renderRevision++;
  instance.error = ''; // a NEWER draw happened to render successfully
  resolveFallback(); // obsolete legacy redraw completes without throwing
  await pending;
  assert.equal(instance.astroPreviewEnabled, false);
  assert.deepEqual(calls(), [false]);
  assert.equal(instance.previewNotice, '',
    'The outdated fallback cannot claim that its own restoration succeeded');
  assert.equal(marks(), 0);
});

test('cancelled fallback without a replacement render cannot claim recovery', async () => {
  const { instance, calls } = harness([maskError]);
  instance.draw = async () => {
    instance.drawRequest++;
    if (instance.drawRequest === 1) {
      instance.error = maskError;
    } else {
      instance.error = '';
      // Like GraficoRenderService's cancelled draw: returns without rendering,
      // therefore renderRevision must remain unchanged.
    }
  };
  await instance.drawWithPreviewRecovery();
  assert.deepEqual(calls(), [false]);
  assert.equal(instance.previewNotice, '');
  assert.equal(instance.renderRevision, 0);
});
