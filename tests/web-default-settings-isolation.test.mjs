import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const source = fileURLToPath(new URL('../src/lib/models/settaggi.model.ts', import.meta.url));
let outputDir;
let settings;
let positions;

before(() => {
  outputDir = mkdtempSync(join(tmpdir(), 'charts-web-settings-'));
  // Compile the real model and its relative imports rather than a hand-written mock.
  execFileSync(process.execPath, [
    require.resolve('typescript/bin/tsc'),
    '--pretty', 'false',
    '--module', 'commonjs',
    '--moduleResolution', 'node',
    '--target', 'ES2022',
    '--strict', 'false',
    '--skipLibCheck', 'true',
    '--outDir', outputDir,
    source,
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  settings = require(resolve(outputDir, 'settaggi.model.js'));
  positions = require(resolve(outputDir, 'posizione.model.js'));
});

after(() => {
  if (outputDir) rmSync(outputDir, { recursive: true, force: true });
});

test('web settings factory preserves all legacy defaults and model methods', () => {
  const original = settings.settaggiDefault;
  const fresh = settings.createDefaultSettaggi();
  assert.equal(fresh instanceof settings.Settaggi, true);
  assert.deepEqual(JSON.parse(JSON.stringify(fresh)), JSON.parse(JSON.stringify(original)));
  assert.equal(fresh.modalita_adesso_posizione instanceof positions.Posizione, true);
  assert.equal(fresh.modalita_adesso_posizione.citta instanceof positions.Citta, true);
  assert.equal(fresh.modalita_adesso_posizione.citta.stato instanceof positions.Stato, true);
  assert.equal(typeof fresh.modalita_adesso_posizione.getLat, 'function');
  assert.equal(typeof fresh.modalita_adesso_posizione.getTz, 'function');
});

test('separate web charts cannot mutate each other or the exported defaults', () => {
  const original = settings.settaggiDefault;
  const baseline = JSON.stringify(original);
  const first = settings.createDefaultSettaggi();
  const second = settings.createDefaultSettaggi();

  for (const key of ['aspetti_attivi', 'aspetti_orbite', 'elementi_celesti', 'modalita_adesso_posizione']) {
    assert.notStrictEqual(first[key], second[key], key);
    assert.notStrictEqual(first[key], original[key], key);
  }
  assert.notStrictEqual(first.elementi_celesti.Sun, second.elementi_celesti.Sun);
  assert.notStrictEqual(first.modalita_adesso_posizione.citta, second.modalita_adesso_posizione.citta);
  assert.notStrictEqual(first.modalita_adesso_posizione.citta.stato, second.modalita_adesso_posizione.citta.stato);
  assert.notStrictEqual(first.modalita_adesso_posizione.posizione_manuale, second.modalita_adesso_posizione.posizione_manuale);

  first.skin_id = 'dark';
  first.aspetti_attivi.congiunzione = false;
  first.aspetti_orbite.quintile = 200;
  first.elementi_celesti.Sun.orb = 90;
  first.modalita_adesso_posizione.posizione_manuale.lat = 12;
  first.modalita_adesso_posizione.citta.lat = 13;
  first.modalita_adesso_posizione.citta.stato.nome = 'changed';

  assert.deepEqual(JSON.parse(JSON.stringify(second)), JSON.parse(baseline));
  assert.equal(JSON.stringify(original), baseline);
});

test('creating new web settings after a mutation retains baseline values', () => {
  const first = settings.createDefaultSettaggi();
  first.elementi_celesti.Moon.att = false;
  first.modalita_adesso_posizione.citta.stato.iso2 = 'ZZ';
  const next = settings.createDefaultSettaggi();
  assert.equal(next.elementi_celesti.Moon.att, settings.settaggiDefault.elementi_celesti.Moon.att);
  assert.equal(next.modalita_adesso_posizione.citta.stato.iso2,
    settings.settaggiDefault.modalita_adesso_posizione.citta.stato.iso2);
});
