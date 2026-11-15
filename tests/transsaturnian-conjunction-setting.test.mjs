import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const rendererSource = readFileSync(
  new URL('../src/lib/renderers/moduli/elementi-celesti.renderer.ts', import.meta.url),
  'utf8',
);
const settingsSource = readFileSync(
  new URL('../src/lib/models/settaggi.model.ts', import.meta.url),
  'utf8',
);

// Load the real renderer module while replacing only unused visual dependencies.
// These tests exercise its real planet-selection method, not a copied predicate.
const { outputText } = ts.transpileModule(rendererSource, {
  fileName: 'elementi-celesti.renderer.ts',
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
});
const jsModule = { exports: {} };
const allowedImports = new Set([
  'three', 'gsap', '../oggetti-semplici.renderer',
  '../_colori.config', '../@skin-manager', '../scene-animations',
]);
new Function('require', 'module', 'exports', outputText)(
  dependency => {
    if (!allowedImports.has(dependency)) {
      throw new Error('Unexpected renderer dependency: ' + dependency);
    }
    return {};
  },
  jsModule,
  jsModule.exports,
);
const { ElementiCelestiRender } = jsModule.exports;

function options(flag) {
  return {
    mostraEffemeridi: false,
    effemeridiGrafiche: false,
    mostraMonomeri: false,
    partiArabe: { modalita: 'essenziali' },
    settaggi: {
      domificazione_selezionata: 'placido',
      transaturnini_se_congiunti: flag,
      elementi_celesti: {
        Sun: { att: true, orb: 6 },
        Uranus: { att: false, orb: 4 },
        Neptune: { att: false, orb: 4 },
        Pluto: { att: false, orb: 4 },
        AS: { att: false, orb: 6 },
        DS: { att: false, orb: 6 },
        MC: { att: false, orb: 6 },
        IC: { att: false, orb: 6 },
      },
    },
  };
}
function chart(sunLongitude = 359) {
  return {
    houses: {},
    planets: {
      Sun: { longitude: sunLongitude },
      Uranus: { longitude: 2 },
      Neptune: { longitude: 56 },
      Pluto: { longitude: 122 },
    },
  };
}
function selected(data, settings, parts = false) {
  return ElementiCelestiRender.getElementiCelesti(
    data, settings, false, 'longitude', parts,
  );
}

test('renderer uses the declared Settaggi snake_case field', () => {
  assert.match(settingsSource, /transaturnini_se_congiunti:\s*boolean\s*=\s*true/);
  assert.match(rendererSource, /opzioni\.settaggi\.transaturnini_se_congiunti/);
  assert.doesNotMatch(rendererSource, /transaturniniSeCongiunti/);
});

test('enabled setting includes hidden Uranus conjunct across the 0/360 boundary', () => {
  const result = selected(chart(), options(true));
  assert.deepEqual(Object.keys(result), ['Sun', 'Uranus']);
  assert.equal(result.Uranus.longitude, 2);
});

test('disabled setting keeps hidden outer planets excluded', () => {
  const result = selected(chart(), options(false));
  assert.deepEqual(Object.keys(result), ['Sun']);
});

test('enabled setting excludes non-conjunct outer planets and keeps chart immutable', () => {
  const input = chart(200);
  const snapshot = structuredClone(input);
  const result = selected(input, options(true));
  assert.deepEqual(Object.keys(result), ['Sun']);
  assert.deepEqual(input, snapshot);
});

test('explicitly enabled Uranus remains visible when conjunction setting is disabled', () => {
  const settings = options(false);
  settings.settaggi.elementi_celesti.Uranus.att = true;
  assert.deepEqual(Object.keys(selected(chart(), settings)), ['Sun', 'Uranus']);
});

test('Arabic-parts mode does not implicitly add disabled outer planets', () => {
  const result = selected(chart(), options(true), true);
  assert.deepEqual(Object.keys(result), ['Sun']);
});
