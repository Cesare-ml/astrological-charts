import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

// Load the actual standalone LocalDB TypeScript model: no Angular, WebGL,
// browser APIs, external locations or user natal data.
const source = readFileSync(
  new URL('../src/lib/models/posizione-localdb.model.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  fileName: 'posizione-localdb.model.ts',
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
});
assert.deepEqual((compiled.diagnostics ?? []).filter(d =>
  d.category === ts.DiagnosticCategory.Error), [], 'LocalDB model transpiles');
const { CittaLocalDB, PosizioneLocalDB } = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled.outputText).toString('base64')
);

function fixture() {
  const city = new CittaLocalDB({
    citta: 'Synthetic city', iso2: 'XX', label: 'Example',
    lat: 42.25, lng: 11.5, tz: 'Europe/Rome', tz_offs: 1,
    stato: 'Synthetic state'
  });
  const manual = { nome: 'Synthetic manual', lat: -34.75,
    lng: 151.5, tz: 'Australia/Sydney' };
  const position = new PosizioneLocalDB({
    id: 7, citta_id: 202, citta: city,
    posizione_manuale: manual, usa_posizione_manuale: false
  });
  return { position, city, manual };
}

test('repeated city coordinate and timezone reads preserve manual data', () => {
  const { position, city, manual } = fixture();
  for (let i = 0; i < 3; i++) {
    assert.deepEqual([position.getLat(), position.getLng(), position.getTz()],
      [42.25, 11.5, 'Europe/Rome']);
  }
  assert.strictEqual(position.citta, city);
  assert.strictEqual(position.posizione_manuale, manual);
  assert.equal(position.citta_id, 202);
  assert.equal(position.usa_posizione_manuale, false);
});

test('switching between LocalDB city and manual modes restores both sources', () => {
  const { position, city, manual } = fixture();
  position.usa_posizione_manuale = true;
  for (let i = 0; i < 3; i++) {
    assert.deepEqual([position.getLat(), position.getLng(), position.getTz()],
      [-34.75, 151.5, 'Australia/Sydney']);
  }
  assert.strictEqual(position.citta, city);
  assert.strictEqual(position.posizione_manuale, manual);
  assert.equal(position.citta_id, 202);

  position.usa_posizione_manuale = false;
  assert.deepEqual([position.getLat(), position.getLng(), position.getTz()],
    [42.25, 11.5, 'Europe/Rome']);
  position.usa_posizione_manuale = true;
  assert.deepEqual([position.getLat(), position.getLng(), position.getTz()],
    [-34.75, 151.5, 'Australia/Sydney']);
});

test('getters are safe on immutable LocalDB position objects', () => {
  const { position: cityPosition } = fixture();
  Object.freeze(cityPosition);
  assert.deepEqual([cityPosition.getLat(), cityPosition.getLng(), cityPosition.getTz()],
    [42.25, 11.5, 'Europe/Rome']);

  const { position: manualPosition } = fixture();
  manualPosition.usa_posizione_manuale = true;
  Object.freeze(manualPosition);
  assert.deepEqual(
    [manualPosition.getLat(), manualPosition.getLng(), manualPosition.getTz()],
    [-34.75, 151.5, 'Australia/Sydney']);
});

test('fallbacks and explicit LocalDB reset methods retain their contracts', () => {
  const empty = new PosizioneLocalDB();
  assert.deepEqual([empty.getLat(), empty.getLng(), empty.getTz()], [0, 0, 'utc']);
  empty.usa_posizione_manuale = true;
  assert.deepEqual([empty.getLat(), empty.getLng(), empty.getTz()], [0, 0, 'UTC']);

  const { position } = fixture();
  position.resetCitta();
  assert.equal(position.citta, undefined);
  assert.equal(position.citta_id, undefined);
  position.usa_posizione_manuale = false;
  assert.deepEqual([position.getLat(), position.getLng(), position.getTz()],
    [0, 0, 'UTC']);

  position.resetPosManuale();
  assert.equal(position.posizione_manuale, undefined);
  position.usa_posizione_manuale = true;
  assert.deepEqual([position.getLat(), position.getLng(), position.getTz()],
    [0, 0, 'UTC']);
});
