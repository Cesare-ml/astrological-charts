import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

// Execute the actual LocalDB models with a narrow moment-timezone spy.
// This tests hydration/side effects and timezone forwarding, NOT Moment's
// astronomical/UTC offset arithmetic or any real user's chart data.
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const calls = [];
const momentSpy = {
  tz(input, zone) {
    const record = { input, zone, utcCalls: 0, format: null };
    calls.push(record);
    return {
      utc() {
        record.utcCalls++;
        return {
          format(pattern) {
            record.format = pattern;
            return 'synthetic-utc-result';
          },
        };
      },
    };
  },
};

function executeModel(path, dependencies = {}) {
  const compiled = ts.transpileModule(read(path), {
    fileName: path,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
    reportDiagnostics: true,
  });
  assert.deepEqual((compiled.diagnostics ?? []).filter(d =>
    d.category === ts.DiagnosticCategory.Error), [], path + ' transpiles');
  const exports = {};
  const module = { exports };
  const requireLocal = name => {
    assert.ok(Object.hasOwn(dependencies, name), path + ': unapproved dependency ' + name);
    return dependencies[name];
  };
  new Function('require', 'module', 'exports', compiled.outputText)(
    requireLocal, module, exports);
  return module.exports;
}

const positionModels = executeModel('src/lib/models/posizione-localdb.model.ts');
const { CittaLocalDB, PosizioneLocalDB } = positionModels;
const { TemaLocalDB } = executeModel('src/lib/models/tema-localdb.model.ts', {
  './posizione-localdb.model': positionModels,
  'moment-timezone': momentSpy,
});

const city = () => ({
  _ObjId: 7744,
  citta: 'Synthetic city',
  iso2: 'XX',
  label: 'Synthetic city',
  lat: 42.375,
  lng: 12.875,
  tz: 'Europe/Rome',
  tz_offs: 1,
  stato: 'Synthetic state',
});
const manual = () => ({
  nome: 'Synthetic manual',
  lat: -34.5,
  lng: 151.25,
  tz: 'Australia/Sydney',
});
const record = () => ({
  id: 17,
  nome: 'Synthetic fixture',
  data: '2026-01-15',
  ora: '10:30',
  posizione_id: 23,
  posizione: {
    id: 23,
    citta_id: 7744,
    citta: city(),
    posizione_manuale: manual(),
    usa_posizione_manuale: false,
  },
});

function assertPreserved(position) {
  assert.equal(position.citta_id, 7744);
  assert.ok(position.citta instanceof CittaLocalDB);
  assert.equal(position.citta._ObjId, 7744);
  assert.deepEqual([position.citta.lat, position.citta.lng, position.citta.tz],
    [42.375, 12.875, 'Europe/Rome']);
  assert.deepEqual(position.posizione_manuale, manual());
}

function assertMomentCall(index, zone) {
  const call = calls[index];
  assert.deepEqual(call, {
    input: '2026-01-15 10:30',
    zone,
    utcCalls: 1,
    format: 'YYYY-MM-DD HH:mm:ss',
  });
}

test('TemaLocalDB hydrates nested city identity and both coordinate sources', () => {
  const theme = new TemaLocalDB(record());
  assert.equal(theme.id, 17);
  assert.equal(theme.posizione_id, 23);
  assert.ok(theme.posizione instanceof PosizioneLocalDB);
  assertPreserved(theme.posizione);
});

test('city timezone lookup does not mutate dormant manual location', () => {
  const theme = new TemaLocalDB(record());
  const before = JSON.stringify(theme);
  const index = calls.length;
  assert.equal(theme.getDataoraUtc(), 'synthetic-utc-result');
  assertMomentCall(index, 'Europe/Rome');
  assert.equal(JSON.stringify(theme), before, 'UTC lookup mutated saved theme');
  assertPreserved(theme.posizione);
});

test('manual/city timezone switching preserves IDs and fields across calls', () => {
  const theme = new TemaLocalDB(record());
  const start = calls.length;
  theme.posizione.usa_posizione_manuale = true;
  assert.equal(theme.getDataoraUtc(), 'synthetic-utc-result');
  assertMomentCall(start, 'Australia/Sydney');
  assertPreserved(theme.posizione);
  theme.posizione.usa_posizione_manuale = false;
  assert.equal(theme.getDataoraUtc(), 'synthetic-utc-result');
  assertMomentCall(start + 1, 'Europe/Rome');
  assertPreserved(theme.posizione);
});

test('JSON-reloaded TemaLocalDB preserves city ID and inactive location on UTC lookup', () => {
  const original = new TemaLocalDB(record());
  original.posizione.usa_posizione_manuale = true;
  const hydrated = new TemaLocalDB(JSON.parse(JSON.stringify(original)));
  assert.ok(hydrated.posizione instanceof PosizioneLocalDB);
  assertPreserved(hydrated.posizione);
  const saved = JSON.stringify(hydrated);
  const index = calls.length;
  assert.equal(hydrated.getDataoraUtc(), 'synthetic-utc-result');
  assertMomentCall(index, 'Australia/Sydney');
  assert.equal(JSON.stringify(hydrated), saved);
  hydrated.posizione.usa_posizione_manuale = false;
  assertPreserved(hydrated.posizione);
  assert.equal(hydrated.posizione.getTz(), 'Europe/Rome');
});
