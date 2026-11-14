import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

class TestPosition {
  constructor(value = {}) { this.id = value?.id ?? -1; }
}
class TestLocalPosition {
  constructor(value = {}) { this.id = value?.id ?? -1; }
}

function loadSource(path, modules) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const sandbox = {
    exports: {},
    require(id) {
      assert.ok(Object.hasOwn(modules, id), 'Unexpected import: ' + id);
      return modules[id];
    },
  };
  vm.runInNewContext(compiled, sandbox, { filename: path });
  return sandbox.exports;
}

const momentStub = () => { throw new Error('Date conversion is outside this test'); };
const { Tema } = loadSource('../src/lib/models/tema.model.ts', {
  './posizione.model': { Posizione: TestPosition },
  'moment-timezone': momentStub,
});
const { TemaLocalDB } = loadSource('../src/lib/models/tema-localdb.model.ts', {
  './posizione-localdb.model': { PosizioneLocalDB: TestLocalPosition },
  'moment-timezone': momentStub,
});
const { TemaForm } = loadSource('../src/lib/models/tema-form.model.ts', {
  './tema.model': { Tema },
});

test('Tema preserves optional sesso during plain-object hydration', () => {
  const saved = { id: 11, nome: 'Synthetic', sesso: 'F', posizione: { id: 12 } };
  const theme = new Tema(saved);
  assert.equal(theme.sesso, 'F');
  assert.equal(theme.nome, 'Synthetic');
  assert.ok(theme.posizione instanceof TestPosition);
  assert.equal(theme.posizione.id, 12);
  assert.deepEqual(saved.posizione, { id: 12 }, 'Caller input remains untouched');
  assert.equal(new Tema({}).sesso, undefined);
  assert.equal(new Tema({ sesso: '' }).sesso, '');
});

test('TemaLocalDB preserves optional sesso and nested offline position', () => {
  const saved = { id: 21, sesso: 'M', posizione: { id: 22 } };
  const theme = new TemaLocalDB(saved);
  assert.equal(theme.sesso, 'M');
  assert.ok(theme.posizione instanceof TestLocalPosition);
  assert.equal(theme.posizione.id, 22);
  assert.equal(new TemaLocalDB().sesso, undefined);
  assert.equal(new TemaLocalDB({ sesso: '' }).sesso, '');
});

test('TemaForm preserves its own stato and the inherited sesso field', () => {
  const input = { id: 31, nome: 'Synthetic form', sesso: 'X', stato: 'draft', posizione: { id: 32 } };
  const form = new TemaForm(input);
  assert.equal(form.stato, 'draft');
  assert.equal(form.sesso, 'X');
  assert.equal(form.nome, 'Synthetic form');
  assert.equal(form.posizione.id, 32);
  assert.equal(new TemaForm({}).stato, undefined);
  assert.equal(new TemaForm({ stato: '' }).stato, '');
});
