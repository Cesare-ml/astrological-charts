import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Execute the actual model sources without bootstrapping Angular or loading user data.
// The position and timezone imports are isolated test doubles.
function loadModel(filename, dependencies) {
  const source = readFileSync(new URL('../src/lib/models/' + filename, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    reportDiagnostics: true,
  });
  assert.equal(compiled.diagnostics?.length ?? 0, 0, filename + ': TypeScript transpilation diagnostics');

  const module = { exports: {} };
  runInNewContext(compiled.outputText, {
    exports: module.exports,
    module,
    require(specifier) {
      if (!Object.hasOwn(dependencies, specifier)) {
        throw new Error('Unexpected ' + filename + ' dependency: ' + specifier);
      }
      return dependencies[specifier];
    },
  }, { filename });
  return module.exports;
}

class StubPosition {
  constructor(input = {}) { this.id = input?.id ?? -1; }
}
class StubLocalPosition extends StubPosition {}
const timezoneStub = {};

const { Tema } = loadModel('tema.model.ts', {
  './posizione.model': { Posizione: StubPosition },
  'moment-timezone': timezoneStub,
});
const { TemaLocalDB } = loadModel('tema-localdb.model.ts', {
  './posizione-localdb.model': { PosizioneLocalDB: StubLocalPosition },
  'moment-timezone': timezoneStub,
});
const { TemaForm } = loadModel('tema-form.model.ts', {
  './tema.model': { Tema },
});

test('Tema and TemaLocalDB preserve the optional sesso field on plain-object hydration', () => {
  for (const [Model, Position] of [[Tema, StubPosition], [TemaLocalDB, StubLocalPosition]]) {
    const hydrated = new Model({ nome: 'Synthetic fixture', sesso: 'synthetic-value', posizione: { id: 12 } });
    assert.equal(hydrated.nome, 'Synthetic fixture');
    assert.equal(hydrated.sesso, 'synthetic-value');
    assert.ok(hydrated.posizione instanceof Position);
    assert.equal(hydrated.posizione.id, 12);
    assert.equal(new Model({ sesso: '' }).sesso, '', 'empty values must not be discarded');
    assert.equal(new Model().sesso, undefined, 'missing optional values remain optional');
  }
});

test('TemaForm preserves form status while inheriting Tema field hydration', () => {
  const hydrated = new TemaForm({ nome: 'Synthetic fixture', sesso: 'synthetic-value', stato: 'draft' });
  assert.equal(hydrated.nome, 'Synthetic fixture');
  assert.equal(hydrated.sesso, 'synthetic-value');
  assert.equal(hydrated.stato, 'draft');
  assert.ok(hydrated.posizione instanceof StubPosition);
  assert.equal(new TemaForm({ stato: '' }).stato, '');
  assert.equal(new TemaForm().stato, undefined);
});
