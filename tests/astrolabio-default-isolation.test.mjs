import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const modelFile = fileURLToPath(new URL('../src/lib/models/settaggi-astrolabio.model.ts', import.meta.url));
let outputDir;
let models;

before(() => {
  outputDir = mkdtempSync(join(tmpdir(), 'charts-astrolabio-default-'));
  const tsc = require.resolve('typescript/bin/tsc');
  // Compile the actual model and its relative imports, not a stand-in implementation.
  execFileSync(process.execPath, [
    tsc, '--pretty', 'false', '--module', 'commonjs',
    '--moduleResolution', 'node', '--target', 'ES2022',
    '--strict', 'false', '--skipLibCheck', 'true',
    '--outDir', outputDir, modelFile
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  models = require(resolve(outputDir, 'settaggi-astrolabio.model.js'));
});

after(() => {
  if (outputDir) rmSync(outputDir, { recursive: true, force: true });
});

test('independent defaults retain the legacy option values and methods', () => {
  const fresh = models.createDefaultSettaggiAstrolabio();
  const original = models.settaggiAstrolabioDefault;
  assert.equal(fresh instanceof models.SettaggiAstrolabio, true);
  assert.deepEqual(JSON.parse(JSON.stringify(fresh)), JSON.parse(JSON.stringify(original)));
  assert.equal(typeof fresh.modalita_adesso_posizione.getLat, 'function');
  assert.equal(typeof fresh.modalita_adesso_posizione.getTz, 'function');
  assert.equal(fresh.modalita_adesso_posizione.citta._ObjId, original.modalita_adesso_posizione.citta._ObjId);
});

test('different Astrolabio settings cannot mutate each other or legacy defaults', () => {
  const first = models.createDefaultSettaggiAstrolabio();
  const second = models.createDefaultSettaggiAstrolabio();
  const original = models.settaggiAstrolabioDefault;
  assert.notStrictEqual(first, second);
  assert.notStrictEqual(first.aspetti_attivi, second.aspetti_attivi);
  assert.notStrictEqual(first.aspetti_orbite, second.aspetti_orbite);
  assert.notStrictEqual(first.elementi_celesti, second.elementi_celesti);
  assert.notStrictEqual(first.elementi_celesti.Sun, second.elementi_celesti.Sun);
  assert.notStrictEqual(first.modalita_adesso_posizione, second.modalita_adesso_posizione);
  assert.notStrictEqual(first.modalita_adesso_posizione.citta, second.modalita_adesso_posizione.citta);

  first.skin_id = 'light';
  first.aspetti_attivi.congiunzione = false;
  first.aspetti_orbite.quintile = 99;
  first.elementi_celesti.Sun.orb = 99;
  first.modalita_adesso_posizione.citta.lat = 0;
  first.modalita_adesso_posizione.citta._ObjId = -1;
  first.modalita_adesso_posizione.posizione_manuale = { lat: 12, lng: 13 };
  assert.notEqual(second.skin_id, first.skin_id);
  assert.notEqual(second.aspetti_attivi.congiunzione, first.aspetti_attivi.congiunzione);
  assert.notEqual(second.aspetti_orbite.quintile, first.aspetti_orbite.quintile);
  assert.notEqual(second.elementi_celesti.Sun.orb, first.elementi_celesti.Sun.orb);
  assert.notEqual(second.modalita_adesso_posizione.citta.lat, first.modalita_adesso_posizione.citta.lat);
  assert.notEqual(second.modalita_adesso_posizione.citta._ObjId, first.modalita_adesso_posizione.citta._ObjId);
  assert.equal(original.aspetti_attivi.congiunzione, true);
  assert.equal(original.aspetti_orbite.quintile, 3);
  assert.equal(original.elementi_celesti.Sun.orb, 6);
  assert.notEqual(original.modalita_adesso_posizione.citta.lat, 0);
});

test('a changed manual position stays isolated from subsequent defaults', () => {
  const first = models.createDefaultSettaggiAstrolabio();
  first.modalita_adesso_posizione.posizione_manuale.lat = 42;
  first.modalita_adesso_posizione.posizione_manuale.tz = 'Etc/UTC';
  const next = models.createDefaultSettaggiAstrolabio();
  assert.equal(next.modalita_adesso_posizione.posizione_manuale?.lat, undefined);
  assert.equal(next.modalita_adesso_posizione.posizione_manuale?.tz, undefined);
});

test('legacy shared-default mutations do not contaminate newly created charts', () => {
  const legacy = models.settaggiAstrolabioDefault;
  const oldValues = {
    skin: legacy.skin_id,
    conjunction: legacy.aspetti_attivi.congiunzione,
    quintile: legacy.aspetti_orbite.quintile,
    solarOrb: legacy.elementi_celesti.Sun.orb,
    cityLatitude: legacy.modalita_adesso_posizione.citta.lat,
    manual: legacy.modalita_adesso_posizione.posizione_manuale
  };
  try {
    legacy.skin_id = 'light';
    legacy.aspetti_attivi.congiunzione = false;
    legacy.aspetti_orbite.quintile = 99;
    legacy.elementi_celesti.Sun.orb = 99;
    legacy.modalita_adesso_posizione.citta.lat = 0;
    legacy.modalita_adesso_posizione.posizione_manuale = { lat: 99, tz: 'Etc/UTC' };
    const fresh = models.createDefaultSettaggiAstrolabio();
    assert.equal(fresh.skin_id, oldValues.skin);
    assert.equal(fresh.aspetti_attivi.congiunzione, oldValues.conjunction);
    assert.equal(fresh.aspetti_orbite.quintile, oldValues.quintile);
    assert.equal(fresh.elementi_celesti.Sun.orb, oldValues.solarOrb);
    assert.equal(fresh.modalita_adesso_posizione.citta.lat, oldValues.cityLatitude);
    assert.notEqual(fresh.modalita_adesso_posizione.posizione_manuale?.lat, 99);
  } finally {
    // Preserve the legacy exported object and its nested references for other tests.
    legacy.skin_id = oldValues.skin;
    legacy.aspetti_attivi.congiunzione = oldValues.conjunction;
    legacy.aspetti_orbite.quintile = oldValues.quintile;
    legacy.elementi_celesti.Sun.orb = oldValues.solarOrb;
    legacy.modalita_adesso_posizione.citta.lat = oldValues.cityLatitude;
    legacy.modalita_adesso_posizione.posizione_manuale = oldValues.manual;
  }
});

test('every celestial-body option has a private instance and keeps its original value', () => {
  const a = models.createDefaultSettaggiAstrolabio();
  const b = models.createDefaultSettaggiAstrolabio();
  const legacy = models.settaggiAstrolabioDefault;
  const names = Object.keys(legacy.elementi_celesti);
  assert.ok(names.length >= 20, 'test requires the complete celestial settings list');
  assert.ok(['AS', 'DS', 'MC', 'IC', 'Sun', 'Moon'].every(name => names.includes(name)));
  for (const name of names) {
    assert.deepEqual({ ...a.elementi_celesti[name] }, legacy.elementi_celesti[name], name);
    assert.notStrictEqual(a.elementi_celesti[name], b.elementi_celesti[name], name);
    assert.notStrictEqual(a.elementi_celesti[name], legacy.elementi_celesti[name], name);
  }
  a.elementi_celesti.AS.orb = 0; // valid explicit numeric zero, not a missing option
  assert.equal(a.elementi_celesti.AS.orb, 0);
  assert.equal(b.elementi_celesti.AS.orb, 6);
  assert.equal(legacy.elementi_celesti.AS.orb, 6);
});

test('clone a customized profile without sharing nested state or losing zero coordinates', () => {
  const saved = models.createDefaultSettaggiAstrolabio();
  saved.skin_id = 'sun';
  saved.aspetti_attivi.trigono = false;
  saved.aspetti_orbite.quintile = 0;
  saved.elementi_celesti.Moon.orb = 2;
  saved.modalita_adesso_posizione.usa_posizione_manuale = true;
  saved.modalita_adesso_posizione.posizione_manuale = {
    nome: 'Synthetic', lat: 0, lng: -12.5, tz: 'Etc/UTC'
  };
  const copy = models.cloneAstrolabioSettings(saved);

  assert.notStrictEqual(copy, saved);
  assert.equal(copy instanceof models.SettaggiAstrolabio, true);
  assert.deepEqual(JSON.parse(JSON.stringify(copy)), JSON.parse(JSON.stringify(saved)));
  assert.notStrictEqual(copy.aspetti_attivi, saved.aspetti_attivi);
  assert.notStrictEqual(copy.aspetti_orbite, saved.aspetti_orbite);
  assert.notStrictEqual(copy.elementi_celesti.Moon, saved.elementi_celesti.Moon);
  assert.notStrictEqual(copy.modalita_adesso_posizione, saved.modalita_adesso_posizione);
  assert.notStrictEqual(copy.modalita_adesso_posizione.posizione_manuale, saved.modalita_adesso_posizione.posizione_manuale);
  assert.notStrictEqual(copy.modalita_adesso_posizione.citta, saved.modalita_adesso_posizione.citta);
  assert.equal(copy.modalita_adesso_posizione.posizione_manuale.lat, 0);
  assert.equal(copy.aspetti_orbite.quintile, 0);

  copy.aspetti_attivi.trigono = true;
  copy.aspetti_orbite.quintile = 99;
  copy.elementi_celesti.Moon.orb = 3;
  copy.modalita_adesso_posizione.posizione_manuale.lng = 20;
  copy.modalita_adesso_posizione.citta.label = 'Changed only in copy';

  assert.equal(saved.aspetti_attivi.trigono, false);
  assert.equal(saved.aspetti_orbite.quintile, 0);
  assert.equal(saved.elementi_celesti.Moon.orb, 2);
  assert.equal(saved.modalita_adesso_posizione.posizione_manuale.lng, -12.5);
  assert.notEqual(saved.modalita_adesso_posizione.citta.label, 'Changed only in copy');
  // Current coordinate getters reset the inactive position only in the invoked
  // instance. Cloning must protect the saved profile from that mutation.
  const savedCity = saved.modalita_adesso_posizione.citta;
  const savedCityId = saved.modalita_adesso_posizione.citta_id;
  assert.equal(copy.modalita_adesso_posizione.getLat(), 0);
  assert.strictEqual(saved.modalita_adesso_posizione.citta, savedCity);
  assert.equal(saved.modalita_adesso_posizione.citta_id, savedCityId);
  assert.equal(models.createDefaultSettaggiAstrolabio().aspetti_attivi.trigono, true);
});

test('copying one profile twice does not share the original manual-position data', () => {
  const saved = models.createDefaultSettaggiAstrolabio();
  saved.modalita_adesso_posizione.posizione_manuale = { lat: 37, lng: 11 };
  const a = models.cloneAstrolabioSettings(saved);
  const b = models.cloneAstrolabioSettings(saved);
  a.modalita_adesso_posizione.posizione_manuale.lat = -1;
  assert.equal(b.modalita_adesso_posizione.posizione_manuale.lat, 37);
  assert.equal(saved.modalita_adesso_posizione.posizione_manuale.lat, 37);
});
