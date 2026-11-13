import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { generateDemoPack } from '../scripts/generate-demo-pack.mjs';
import { sourcePreloadPaths } from '../scripts/generate-synthetic-pack.mjs';
import { verifyApprovedAssetPack } from '../scripts/verified-asset-pack.mjs';

test('demo pack has independently generated, verified PNG, JPEG and WebP fixtures', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'chart-demo-pack-'));
  try {
    const pack = await generateDemoPack(join(dir, 'pack'));
    assert.equal(pack.manifest.assets.length, 452);
    assert.equal(verifyApprovedAssetPack(pack.root, pack.manifest).count, 452);
    for (const [path, format] of [
      ['img/risuonatore-solare-bn.png','png'],
      ['img/symbols/planets/light/_circle/Sun.png','png'],
      ['img/textures/texture-oro-1.jpg','jpeg'],
      ['img/textures/texture-oro-3.webp','webp'],
    ]) {
      const bytes = readFileSync(join(pack.root, ...path.split('/')));
      assert.equal((await sharp(bytes).metadata()).format, format);
    }
    assert.equal(pack.manifest.source.repository, 'synthetic-local-fixtures');
    await assert.rejects(generateDemoPack(join(dir, 'pack')), /already exists/);
  } finally { rmSync(dir, {recursive:true, force:true}); }
});


const sourcePreload = readFileSync(
  new URL('../src/lib/renderers/gestore-immagini.ts', import.meta.url), 'utf8'
);
const originalCase01 = '"/assets/img/simboli-bianchi/case/01.png"';
const originalCase02 = '"/assets/img/simboli-bianchi/case/02.png"';
const originalLast = '"/assets/img/simboli-bianchi/segni/12.png"';
function mutatePreload(find, replace) {
  assert.ok(sourcePreload.includes(find), 'Expected source fixture prefix: '+find);
  return sourcePreload.replace(find, replace);
}

test('synthetic preview covers exactly the real 78 static preload symbols', () => {
  const paths = sourcePreloadPaths(sourcePreload);
  assert.equal(paths.length,78);
  assert.equal(new Set(paths).size,78);
  assert.ok(paths.includes('img/simboli-bianchi/elementi-celesti/mean Node Sud.png'));
  assert.ok(paths.includes('img/simboli-bianchi/segni/12.png'));
  assert.deepEqual(paths,[...paths].sort(), 'Manifest input must be deterministic');
});

test('synthetic preload rejects later mutations or aliases outside its literal declaration', () => {
  // The current source has one reviewed read in getPreloadArray():
  // .concat(this.preloadArraySimboli). New write/alias references require
  // manual review before a synthetic manifest may claim full coverage.
  const mutations = [
    'GestoreImmagini.preloadArraySimboli.push("/assets/img/extra.png");',
    'this.preloadArraySimboli = ["/assets/img/changed.png"];',
    'const alias = this.preloadArraySimboli; alias.push("/assets/img/extra.png");',
    'this.preloadArraySimboli.splice(0, 1);',
    'const another = this.preloadArraySimboli;',
  ];
  for (const mutation of mutations) {
    assert.throws(
      () => sourcePreloadPaths(sourcePreload + '\n' + mutation),
      /Unreviewed dynamic preloadArraySimboli reference/,
      mutation
    );
  }
  assert.equal(sourcePreloadPaths(sourcePreload).length, 78);
});

test('synthetic preload refuses computed, spread, interpolated or appended source entries', () => {
  const edits = [
    [originalLast, originalLast + ',\n    ...dynamicAssets'],
    [originalLast, originalLast + ',\n    dynamicAssetPath'],
    [originalLast, originalLast + ' + suffix'],
    [originalLast, String.fromCharCode(96) + '/assets/img/simboli-bianchi/segni/$' + '{month}.png' + String.fromCharCode(96)],
    ['  ]\n}', '  ].concat(dynamicAssets)\n}'],
  ];
  for (const [from,to] of edits) {
    assert.throws(() => sourcePreloadPaths(mutatePreload(from,to)),
      /static quoted|nonliteral expression|standalone literal/i, from);
  }
});

test('synthetic preload rejects unsafe and unsupported paths, even with 78 entries', () => {
  for (const replacement of [
    '"/assets/img/simboli-bianchi/case/../01.png"',
    '"/assets/img/simboli-bianchi//case/01.png"',
    '"/assets/img/simboli-bianchi/case/%30%31.png"',
    '"https://example.com/malicious.png"',
    '"../../private.png"',
    '"//assets/img/simboli-bianchi/case/01.png"',
    '"/assets/img/simboli-bianchi/case/01.png?version=2"',
    '"\\u002fassets/img/simboli-bianchi/case/01.png"',
  ]) {
    assert.throws(() => sourcePreloadPaths(mutatePreload(originalCase01,replacement)),
      /Invalid preload|Unsafe preload|Escaped or multiline/, replacement);
  }
});

test('synthetic preload fails closed on missing, duplicate or malformed array declarations', () => {
  const errors = [
    mutatePreload(originalCase02,originalCase01),
    mutatePreload(originalCase01,''),
    mutatePreload('public static preloadArraySimboli','public static assetsPreloaded'),
    mutatePreload(originalLast, originalLast + ',\n    notActuallyALiteral'),
    mutatePreload(originalCase01,originalCase01 + ' /* unfinished comment'),
  ];
  for (const input of errors)
    assert.throws(() => sourcePreloadPaths(input), /78 unique|declaration|static quoted|comment|nonliteral/i);
});

test('synthetic preload preserves existing missing-list diagnostic and refuses duplicate declarations', () => {
  // tests/serve-local-assets.test.mjs already depends on this diagnostic.
  // This regression protects the legacy local asset smoke suite, not only
  // the tests added alongside the strict parser.
  assert.throws(() => sourcePreloadPaths('no preload here'), /Preload list missing/);
  assert.throws(
    () => sourcePreloadPaths(sourcePreload + '\n' + sourcePreload),
    /exactly one static preloadArraySimboli declaration/
  );
});

test('synthetic preload tolerates comments but does not treat their URLs as entries', () => {
  const mutated=mutatePreload(originalCase02,
    '// "/assets/img/comment-should-not-count.png"\n    ' + originalCase02);
  assert.deepEqual(sourcePreloadPaths(mutated),sourcePreloadPaths(sourcePreload));
});
