import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

// Run the actual TS URL resolver, glyph mapping and GestoreImmagini code,
// with ONLY unrelated Angular/Three.js imports removed. No private images,
// WebGL, browser globals, network or font sources are needed.
function read(relative) {
  return readFileSync(new URL('../src/lib/renderers/' + relative, import.meta.url), 'utf8');
}
function compile(relative) {
  const code = read(relative)
    .replace(/^import [^\n]+\n/gm, '')
    .replace(/^export /gm, '');
  const result = ts.transpileModule(code, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics ?? []).filter(
    d => d.category === ts.DiagnosticCategory.Error
  );
  assert.deepEqual(errors, [], relative + ' must compile in the isolated test');
  return result.outputText;
}
const compiled = [
  compile('chart-asset-urls.ts'),
  compile('virgostars-astro-image-preview.ts'),
  compile('gestore-immagini.ts'),
].join('\n');
const ImageManager = new Function(
  compiled + '\nreturn GestoreImmagini;'
)();
const root = 'http://127.0.0.1:4177/assets/';
ImageManager.configurePublicAssetsBase(root);

const signs = [
  'aries','taurus','gemini','cancer','leo','virgo',
  'libra','scorpio','sagittarius','capricorn','aquarius','pisces',
];
const bodies = [
  ['Sun','sun'],['Moon','moon'],['Mercury','mercury'],['Venus','venus'],
  ['Mars','mars'],['Jupiter','jupiter'],['Saturn','saturn'],
  ['Uranus','uranus'],['Neptune','neptune'],['Pluto','pluto'],
];
const source = ref => '../../../assets/img/' + ref;
const url = ref => root + 'img/' + ref;

test('22 glyphs use private mask URLs only with both opt-in gates enabled', () => {
  ImageManager.configureVirgoStarsAstroPreview(false);
  for (let i = 0; i < signs.length; i++) {
    const legacy = 'simboli-bianchi/segni/' + String(i + 1).padStart(2,'0') + '.png';
    assert.equal(ImageManager.resolveAssetUrl(source(legacy), true), url(legacy));
  }
  for (const [name] of bodies) {
    const legacy = 'simboli-bianchi/elementi-celesti/' + name + '.png';
    assert.equal(ImageManager.resolveAssetUrl(source(legacy), true), url(legacy));
  }

  ImageManager.configureVirgoStarsAstroPreview(true);
  for (let i = 0; i < signs.length; i++) {
    const legacy = 'simboli-bianchi/segni/' + String(i + 1).padStart(2,'0') + '.png';
    const mask = url('virgostars-astro/masks/' + signs[i] + '.png');
    assert.equal(ImageManager.resolveAssetUrl(source(legacy), false), url(legacy));
    assert.equal(ImageManager.resolveAssetUrl(source(legacy)), url(legacy));
    assert.equal(ImageManager.resolveAssetUrl(source(legacy), true), mask);
    assert.equal(ImageManager.isVirgoStarsAstroPreviewAsset(source(legacy), true), true);
  }
  for (const [name, id] of bodies) {
    const legacy = 'simboli-bianchi/elementi-celesti/' + name + '.png';
    assert.equal(ImageManager.resolveAssetUrl(source(legacy), false), url(legacy));
    assert.equal(ImageManager.resolveAssetUrl(source(legacy), true),
      url('virgostars-astro/masks/' + id + '.png'));
  }
});

test('retrogrades, houses, axes and secondary chart assets cannot be overridden', () => {
  ImageManager.configureVirgoStarsAstroPreview(true);
  for (const legacy of [
    'simboli-bianchi/elementi-celesti/Saturn-r.png',
    'simboli-bianchi/elementi-celesti/Uranus-r.png',
    'simboli-bianchi/elementi-celesti/AS.png',
    'simboli-bianchi/elementi-celesti/Chiron.png',
    'simboli-bianchi/case/01.png',
    'simboli/segni/light/785x610/01.png',
  ]) {
    assert.equal(ImageManager.resolveAssetUrl(source(legacy), true), url(legacy));
    assert.equal(ImageManager.isVirgoStarsAstroPreviewAsset(source(legacy), true), false);
  }
});

test('disabling preview restores all original URLs without rebuilding the renderer', () => {
  ImageManager.configureVirgoStarsAstroPreview(true);
  assert.equal(ImageManager.resolveAssetUrl(source('simboli-bianchi/segni/06.png'), true),
    url('virgostars-astro/masks/virgo.png'));
  ImageManager.configureVirgoStarsAstroPreview(false);
  assert.equal(ImageManager.resolveAssetUrl(source('simboli-bianchi/segni/06.png'), true),
    url('simboli-bianchi/segni/06.png'));
  assert.equal(ImageManager.isVirgoStarsAstroPreviewAsset(
    source('simboli-bianchi/segni/06.png'), true
  ), false);
  assert.throws(() => ImageManager.configureVirgoStarsAstroPreview('true'), TypeError);
});
