import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { compileFunction } from 'node:vm';
import ts from 'typescript';

// Execute the actual TS models in an isolated CommonJS transpilation harness.
// No Angular, DOM, WebGL, third-party chart data or build artifacts required.
const require = createRequire(import.meta.url);
const modelsRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../src/lib/models');
const cache = new Map();

function loadModel(name) {
  const filename = resolve(modelsRoot, name + '.ts');
  assert.ok(filename.startsWith(modelsRoot + sep), 'Only local model files are allowed');
  if (cache.has(filename)) return cache.get(filename).exports;
  const source = readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
    reportDiagnostics: true,
  });
  const errors = (compiled.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error);
  assert.deepEqual(errors, [], `TypeScript transpilation failed: ${name}`);

  const module = { exports: {} };
  cache.set(filename, module);
  const localRequire = specifier => {
    if (!specifier.startsWith('./')) return require(specifier);
    return loadModel(resolve(dirname(filename), specifier).slice(modelsRoot.length + 1));
  };
  compileFunction(compiled.outputText, ['require', 'module', 'exports'], { filename })(
    localRequire, module, module.exports
  );
  return module.exports;
}

const { createDefaultOpzioniGrafico, defaultOpzioniGrafico } = loadModel('opzioni-grafico.model');
const { Settaggi } = loadModel('settaggi.model');

function objectReferences(value, seen = new Set()) {
  if (value && typeof value === 'object' && !seen.has(value)) {
    seen.add(value);
    for (const item of Object.values(value)) objectReferences(item, seen);
  }
  return seen;
}

test('new chart options preserve legacy values and Settaggi instances', () => {
  const fresh = createDefaultOpzioniGrafico();
  assert.deepStrictEqual(fresh, defaultOpzioniGrafico);
  assert.ok(fresh.settaggi instanceof Settaggi);
  assert.notStrictEqual(fresh, defaultOpzioniGrafico);
  assert.notStrictEqual(fresh.settaggi, defaultOpzioniGrafico.settaggi);
});

test('no nested mutable object is shared across charts or legacy defaults', () => {
  const first = createDefaultOpzioniGrafico();
  const second = createDefaultOpzioniGrafico();
  const firstObjects = objectReferences(first);
  const sharedDefaultObjects = objectReferences(defaultOpzioniGrafico);
  for (const item of objectReferences(second)) {
    assert.ok(!firstObjects.has(item), 'Factory returned shared mutable state across charts');
    assert.ok(!sharedDefaultObjects.has(item), 'Factory reused a legacy mutable default');
  }
});

test('mutating one chart does not affect another or the legacy default', () => {
  const first = createDefaultOpzioniGrafico();
  const second = createDefaultOpzioniGrafico();
  first.settaggi.aspetti_attivi.congiunzione = false;
  first.settaggi.elementi_celesti.Sun.orb = 99;
  first.settaggi.modalita_adesso_posizione.usa_posizione_manuale = true;
  first.effemeridiGrafichePianetiAttivi.Sun = false;
  first.sinastria.invertiTemi = true;
  first.ascendenzaInUso.asse = 'MC';
  first.temaRadixElementoCelesteFocusAspetti.nome = 'Moon';
  first.partiArabe.elDestinazione = 'Sun';
  for (const options of [second, defaultOpzioniGrafico]) {
    assert.equal(options.settaggi.aspetti_attivi.congiunzione, true);
    assert.equal(options.settaggi.elementi_celesti.Sun.orb, 6);
    assert.equal(options.settaggi.modalita_adesso_posizione.usa_posizione_manuale, false);
    assert.equal(options.effemeridiGrafichePianetiAttivi.Sun, true);
    assert.equal(options.sinastria.invertiTemi, false);
    assert.equal(options.ascendenzaInUso.asse, undefined);
    assert.equal(options.temaRadixElementoCelesteFocusAspetti.nome, 'Sun');
    assert.equal(options.partiArabe.elDestinazione, undefined);
  }
});
