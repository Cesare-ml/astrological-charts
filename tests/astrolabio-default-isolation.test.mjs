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
