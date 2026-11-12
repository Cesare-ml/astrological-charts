import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Exercises the actual TypeScript helper without Angular, Three.js or assets.
const source = readFileSync(
  new URL('../src/lib/renderers/virgostars-astro-image-preview.ts', import.meta.url), 'utf8'
);
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { getVirgoStarsAstroImageOverride: substitute } = await import(
  'data:text/javascript;base64,' + Buffer.from(transpiled).toString('base64')
);

const signs = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];
const bodies = [
  ['Sun','sun'], ['Moon','moon'], ['Mercury','mercury'], ['Venus','venus'],
  ['Mars','mars'], ['Jupiter','jupiter'], ['Saturn','saturn'],
  ['Uranus','uranus'], ['Neptune','neptune'], ['Pluto','pluto'],
];

test('all 12 legacy zodiac refs map in the exact required order', () => {
  for (let i = 0; i < signs.length; i++) {
    const input = `simboli-bianchi/segni/${String(i+1).padStart(2, '0')}.png`;
    assert.equal(substitute(input), `virgostars-astro/masks/${signs[i]}.png`);
  }
});

test('only the 10 canonical normal-motion body refs map', () => {
  for (const [original, slug] of bodies) {
    assert.equal(substitute(`simboli-bianchi/elementi-celesti/${original}.png`),
      `virgostars-astro/masks/${slug}.png`);
  }
});

test('preserves supported host path prefixes for the existing URL resolver', () => {
  const prefixes = [
    '', 'img/', 'assets/img/', '/assets/img/', '../../../assets/img/',
  ];
  for (const prefix of prefixes) {
    assert.equal(substitute(prefix + 'simboli-bianchi/segni/01.png'),
      prefix + 'virgostars-astro/masks/aries.png');
    assert.equal(substitute(prefix + 'simboli-bianchi/elementi-celesti/Pluto.png'),
      prefix + 'virgostars-astro/masks/pluto.png');
  }
});

test('leaves retrogrades, decans, axis glyphs, asteroids and latitudes alone', () => {
  for (const input of [
    'simboli-bianchi/segni/00.png',
    'simboli-bianchi/segni/13.png',
    'simboli-bianchi/segni/01-r.png',
    'simboli-bianchi/elementi-celesti/Saturn-r.png',
    'simboli-bianchi/elementi-celesti/AS.png',
    'simboli-bianchi/elementi-celesti/MC.png',
    'simboli-bianchi/elementi-celesti/Chiron.png',
    'simboli-bianchi/case/01.png',
    'simboli/segni/light/785x610/01.png',
    'simboli/elementi-celesti/light/cerchio/Sun.png',
    'symbols/planets/light/_circle/Sun.png',
    'grafici/light/cartaastrale-segni.png',
  ]) assert.equal(substitute(input), null, input);
});

test('rejects guessed paths, URLs, traversal, uppercase aliases and suffixes', () => {
  for (const input of [
    'http://example.com/assets/img/simboli-bianchi/segni/01.png',
    '/assets/img/../simboli-bianchi/segni/01.png',
    'assets/img/%2e%2e/simboli-bianchi/segni/01.png',
    '../../assets/img/simboli-bianchi/segni/01.png',
    'simboli-bianchi/elementi-celesti/SUN.png',
    'simboli-bianchi/segni/01.PNG',
    'simboli-bianchi/segni/01.png?version=1',
    'simboli-bianchi/segni/01.png#foo',
    'virgostars-astro/masks/aries.png',
    'simboli-bianchi/segni/01.png/extra',
  ]) assert.equal(substitute(input), null, input);
});

test('accepts no unexpected mapping for a nonsensical input', () => {
  assert.equal(substitute(''), null);
  assert.equal(substitute('some-other-file.png'), null);
  assert.equal(substitute(undefined), null);
});
