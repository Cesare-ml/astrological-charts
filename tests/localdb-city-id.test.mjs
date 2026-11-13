import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

// Compile the repository's actual TypeScript model, without Angular/WebGL,
// production database access or user location records.
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

const cityRecord = () => ({
  _ObjId: 7744,
  citta: 'Synthetic town',
  iso2: 'XX',
  label: 'Synthetic town, example country',
  lat: 42.375,
  lng: 12.875,
  tz: 'Europe/Rome',
  tz_offs: 1,
  stato: 'Synthetic country',
});

test('CittaLocalDB preserves the stored _ObjId and other city data', () => {
  const saved = cityRecord();
  const city = new CittaLocalDB(saved);
  assert.equal(city._ObjId, 7744);
  for (const [key, value] of Object.entries(saved)) {
    assert.deepEqual(city[key], value, key + ' changed during hydration');
  }
});

test('valid zero city ID survives; missing and null IDs use a sentinel', () => {
  assert.equal(new CittaLocalDB({ _ObjId: 0 })._ObjId, 0);
  assert.equal(new CittaLocalDB()._ObjId, -1);
  assert.equal(new CittaLocalDB({ _ObjId: null })._ObjId, -1);
});

test('nested position hydration preserves both city identity fields', () => {
  const plain = {
    id: 23, citta_id: 7744,
    citta: cityRecord(),
    usa_posizione_manuale: false,
  };
  const position = new PosizioneLocalDB(plain);
  assert.ok(position.citta instanceof CittaLocalDB);
  assert.equal(position.citta_id, 7744);
  assert.equal(position.citta._ObjId, 7744);
  assert.deepEqual([position.getLat(), position.getLng(), position.getTz()],
    [42.375, 12.875, 'Europe/Rome']);
  assert.equal(position.citta._ObjId, position.citta_id);
});

test('JSON save/restore keeps LocalDB identity and dormant manual position', () => {
  const manual = { nome: 'Manual', lat: -34.5, lng: 151.25, tz: 'Australia/Sydney' };
  const original = new PosizioneLocalDB({
    id: 23, citta_id: 7744, citta: new CittaLocalDB(cityRecord()),
    usa_posizione_manuale: true, posizione_manuale: manual,
  });
  const restored = new PosizioneLocalDB(JSON.parse(JSON.stringify(original)));
  assert.equal(restored.citta_id, 7744);
  assert.equal(restored.citta._ObjId, 7744);
  assert.deepEqual(restored.posizione_manuale, manual);
  assert.equal(restored.getTz(), 'Australia/Sydney');
  restored.usa_posizione_manuale = false;
  assert.deepEqual([restored.getLat(), restored.getLng(), restored.getTz()],
    [42.375, 12.875, 'Europe/Rome']);
  assert.equal(restored.citta._ObjId, 7744);
});
