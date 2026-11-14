import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Execute the real TypeScript constructors without a browser or timezone service.
// Timezone conversion is deliberately out of scope for these hydration tests.
const loaded = new Map();
function loadModel(filename) {
  if (loaded.has(filename)) return loaded.get(filename);
  const source = readFileSync(new URL('../src/lib/models/' + filename, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const module = { exports: {} };
  loaded.set(filename, module.exports);
  const localRequire = (request) => {
    if (request === 'moment-timezone') return { tz: () => { throw new Error('Timezone conversion not exercised here'); } };
    if (/^\.\/[a-z-]+\.model$/.test(request)) return loadModel(request.slice(2) + '.ts');
    throw new Error('Unexpected model dependency: ' + request);
  };
  new Function('require', 'module', 'exports', outputText)(localRequire, module, module.exports);
  return module.exports;
}

const { Tema } = loadModel('tema.model.ts');
const { TemaLocalDB } = loadModel('tema-localdb.model.ts');
const { TemaForm } = loadModel('tema-form.model.ts');
const { Posizione } = loadModel('posizione.model.ts');
const { PosizioneLocalDB } = loadModel('posizione-localdb.model.ts');

test('Tema keeps optional sesso when hydrating a synthetic saved record', () => {
  const record = { id: 0, nome: 'Synthetic chart', sesso: 'test-value', posizione: { usa_posizione_manuale: true } };
  const tema = new Tema(record);
  assert.equal(tema.sesso, 'test-value');
  assert.equal(tema.id, 0);
  assert.ok(tema.posizione instanceof Posizione);
  assert.equal(new Tema(JSON.parse(JSON.stringify(tema))).sesso, 'test-value');
});

test('TemaLocalDB keeps optional sesso while hydrating offline records', () => {
  const tema = new TemaLocalDB({ id: 0, sesso: 'offline-value', posizione: { usa_posizione_manuale: true } });
  assert.equal(tema.sesso, 'offline-value');
  assert.ok(tema.posizione instanceof PosizioneLocalDB);
  assert.equal(new TemaLocalDB(JSON.parse(JSON.stringify(tema))).sesso, 'offline-value');
});

test('TemaForm preserves both inherited metadata and its own optional stato', () => {
  const form = new TemaForm({ nome: 'Synthetic form', sesso: 'test-value', stato: 'draft' });
  assert.ok(form instanceof Tema);
  assert.equal(form.sesso, 'test-value');
  assert.equal(form.stato, 'draft');
  assert.deepEqual({ sesso: form.sesso, stato: form.stato },
    { sesso: 'test-value', stato: 'draft' });
});

test('missing optional fields remain undefined and do not leak across instances', () => {
  const empty = [new Tema(), new TemaLocalDB(), new TemaForm()];
  for (const entry of empty) assert.equal(entry.sesso, undefined);
  assert.equal(empty[2].stato, undefined);
  assert.equal(new Tema({ sesso: '' }).sesso, '');
  assert.equal(new TemaLocalDB({ sesso: '' }).sesso, '');
  assert.equal(new TemaForm({ stato: '' }).stato, '');
});
