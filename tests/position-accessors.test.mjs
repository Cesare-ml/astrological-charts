import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

// Import the actual TypeScript model without Angular, DOM, location APIs or
// sensitive/real natal data. The fixture uses invented coordinates and IDs.
const path = new URL('../src/lib/models/posizione.model.ts', import.meta.url);
const compiled = ts.transpileModule(readFileSync(path, 'utf8'), {
  fileName: 'posizione.model.ts',
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true
});
assert.deepEqual((compiled.diagnostics ?? []).filter(d =>
  d.category === ts.DiagnosticCategory.Error), [], 'Position model transpiles');
const { Posizione, Citta, Stato } = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled.outputText).toString('base64')
);

function example() {
  const city = new Citta({
    id: 101,
    nome: 'Example City',
    lat: 41.25,
    lng: 12.5,
    tz: 'Europe/Rome',
    stato: new Stato({ id: 9, nome: 'Example State', iso2: 'EX' }),
  });
  const manual = { nome: 'Manual', lat: -33.5, lng: 151.75, tz: 'Australia/Sydney' };
  const position = new Posizione({
    id: 7, citta_id: city.id, citta: city,
    posizione_manuale: manual, usa_posizione_manuale: false
  });
  return {position, city, manual};
}

test('reading a city never deletes the stored manual coordinates', () => {
  const {position, city, manual} = example();
  for (let i = 0; i < 3; i++) {
    assert.equal(position.getLat(), 41.25);
    assert.equal(position.getLng(), 12.5);
    assert.equal(position.getTz(), 'Europe/Rome');
  }
  assert.strictEqual(position.citta, city);
  assert.equal(position.citta_id, 101);
  assert.strictEqual(position.posizione_manuale, manual);
  assert.equal(position.usa_posizione_manuale, false);
});

test('manual reads preserve city metadata for later mode switches', () => {
  const {position, city, manual} = example();
  position.usa_posizione_manuale = true;
  for (let i = 0; i < 3; i++) {
    assert.equal(position.getLng(), 151.75);
    assert.equal(position.getLat(), -33.5);
    assert.equal(position.getTz(), 'Australia/Sydney');
  }
  assert.strictEqual(position.citta, city);
  assert.equal(position.citta_id, city.id);
  assert.strictEqual(position.posizione_manuale, manual);
  position.usa_posizione_manuale = false;
  assert.deepEqual([position.getLat(), position.getLng(), position.getTz()],
    [41.25, 12.5, 'Europe/Rome']);
  position.usa_posizione_manuale = true;
  assert.deepEqual([position.getLat(), position.getLng(), position.getTz()],
    [-33.5, 151.75, 'Australia/Sydney']);
});

test('coordinate accessors are safe to call on a frozen position', () => {
  const {position} = example();
  Object.freeze(position);
  assert.deepEqual([position.getLat(), position.getLng(), position.getTz()],
    [41.25, 12.5, 'Europe/Rome']);
  const {position: manual} = example();
  manual.usa_posizione_manuale = true;
  Object.freeze(manual);
  assert.deepEqual([manual.getLat(), manual.getLng(), manual.getTz()],
    [-33.5, 151.75, 'Australia/Sydney']);
});

test('defaults and explicit resets still behave as before', () => {
  const empty = new Posizione();
  assert.deepEqual([empty.getLat(),empty.getLng(),empty.getTz()], [0,0,'utc']);
  empty.usa_posizione_manuale = true;
  assert.deepEqual([empty.getLat(),empty.getLng(),empty.getTz()], [0,0,'UTC']);

  const {position} = example();
  position.resetPosManuale();
  assert.equal(position.posizione_manuale, undefined);
  position.usa_posizione_manuale = true;
  assert.deepEqual([position.getLat(),position.getLng(),position.getTz()], [0,0,'UTC']);
  position.resetCitta();
  assert.equal(position.citta, undefined);
  assert.equal(position.citta_id, undefined);
  position.usa_posizione_manuale = false;
  assert.deepEqual([position.getLat(),position.getLng(),position.getTz()], [0,0,'UTC']);
});
