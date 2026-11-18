import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { assetPath, extractStaticReferences, deriveSelection } from '../scripts/derive-chart-asset-selection.mjs';

function source(text) { return ts.createSourceFile('fixture.ts', text, ts.ScriptTarget.Latest, true); }
function fixture(callback) {
  const dir = mkdtempSync(join(tmpdir(), 'chart-family-test-'));
  const src = join(dir, 'src', 'lib', 'renderers');
  const assets = join(dir, 'public', 'assets');
  try {
    mkdirSync(src, { recursive: true });
    mkdirSync(join(assets, 'img', 'simboli-bianchi', 'segni'), { recursive: true });
    mkdirSync(join(assets, 'img', 'textures'), { recursive: true });
    writeFileSync(join(src, '@skin-manager.ts'), "export class SkinManager {static skins={dark:{texture:'assets/img/textures/texture-oro-1.jpg',imgRisuonatoreSolare:'risuonatore-solare-bianco.png'}};}");
    writeFileSync(join(src, 'gestore-immagini.ts'), "export class GestoreImmagini {static preloadArraySimboli=['/assets/img/simboli-bianchi/segni/01.png'];}");
    writeFileSync(join(assets, 'img', 'textures', 'texture-oro-1.jpg'), 'texture');
    writeFileSync(join(assets, 'img', 'simboli-bianchi', 'segni', '01.png'), 'zodiac');
    return callback({ assets, src: join(dir, 'src') });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
test('extracts active literals rather than commented historic assets', () => {
  const skins = source("const skin={texture:'assets/img/textures/t.webp',imgRisuonatoreSolare:'x.png'}; // texture:'fake.png'");
  const images = source("class GI {static preloadArraySimboli=['/assets/img/simboli-bianchi/segni/01.png'];}");
  assert.deepEqual(extractStaticReferences(skins, images).map(x => x.reference), [
    'assets/img/textures/t.webp', 'x.png', '/assets/img/simboli-bianchi/segni/01.png',
  ]);
});
test('normalizes original renderer paths without accepting remote URLs', () => {
  for (const ref of ['../../../assets/img/simboli-bianchi/segni/01.png', '/assets/img/simboli-bianchi/segni/01.png', 'simboli-bianchi/segni/01.png'])
    assert.equal(assetPath(ref), 'img/simboli-bianchi/segni/01.png');
  assert.throws(() => assetPath('https://example.org/image.png'), /External/);
  assert.throws(() => assetPath('../private.png'), /relative path/);
});
test('detects missing skin asset without collecting unrelated site art', () => {
  fixture(({ assets, src }) => {
    writeFileSync(join(assets, 'img', 'logo.png'), 'site');
    const { files, report } = deriveSelection(assets, src);
    assert.equal(report.unresolved.length, 1);
    assert.equal(report.unresolved[0].expected, 'img/risuonatore-solare-bianco.png');
    assert.deepEqual(files, ['img/simboli-bianchi/segni/01.png', 'img/textures/texture-oro-1.jpg']);
  });
});
test('passes when asset owner supplies all referenced images', () => {
  fixture(({ assets, src }) => {
    writeFileSync(join(assets, 'img', 'risuonatore-solare-bianco.png'), 'image');
    const { files, report } = deriveSelection(assets, src);
    assert.equal(report.unresolved.length, 0);
    assert.equal(files.length, 3);
  });
});
test('selects the latitude circle family without unrelated site symbols', () => {
  fixture(({assets,src}) => {
    const circle=join(assets,'img','symbols','planets','dark','_circle');
    mkdirSync(circle,{recursive:true});
    writeFileSync(join(circle,'Sun.png'),'circle');
    writeFileSync(join(assets,'img','symbols','planets','dark','Sun.png'),'unrelated');
    const {files}=deriveSelection(assets,src);
    assert.ok(files.includes('img/symbols/planets/dark/_circle/Sun.png'));
    assert.ok(!files.includes('img/symbols/planets/dark/Sun.png'));
  });
});

test('rejects URI-encoded or ambiguous static asset references before selection', () => {
  for (const ref of [
    'assets/img/%2e%2e/Sun.png',
    'img/symbols/Sun%20.png',
    'img/textures/a?.png',
    'img/textures/a#.png',
    'img/textures/Sun:alt.png',
    'img/textures/a\n.png',
  ]) assert.throws(() => assetPath(ref), /Invalid asset path/);
  assert.equal(assetPath('img/simboli/mean Apogee.png'), 'img/simboli/mean Apogee.png');
});

test('reports nonliteral skin expressions but ignores intentionally absent null textures', () => {
  const skins = source(`const skins = {
    dark: { texture: null, imgRisuonatoreSolare: 'known.png' },
    dynamic: { texture: chooseTexture(), imgRisuonatoreSolare: root + '/art.png' }
  };`);
  const images = source(`class GI {
    static preloadArraySimboli = ['/assets/img/ok.png', ...extraImages, chooseSymbol()];
  }`);
  const refs = extractStaticReferences(skins, images);
  assert.equal(refs.filter(ref => !ref.problem).length, 2);
  const unsafe = refs.filter(ref => ref.problem);
  assert.equal(unsafe.length, 4);
  assert.equal(unsafe.filter(ref => ref.origin === 'skin').length, 2);
  assert.equal(unsafe.filter(ref => ref.origin === 'preload').length, 2);
  assert.ok(unsafe.every(ref => /Non-literal asset reference at .*:[0-9]+:[0-9]+;/.test(ref.problem)));
  assert.ok(unsafe.filter(ref => ref.origin === 'skin').every(ref => ref.problem.includes('@skin-manager.ts:')));
  assert.ok(unsafe.filter(ref => ref.origin === 'preload').every(ref => ref.problem.includes('gestore-immagini.ts:')));
  assert.ok(unsafe.every(ref => !ref.problem.includes('chooseTexture') && !ref.problem.includes('/private/')));
});

test('reports a non-array preload initializer instead of treating selection as complete', () => {
  const skins = source('const skins = {dark:{texture:null}};');
  const images = source('class GI { static preloadArraySimboli = buildImageList(); }');
  const refs = extractStaticReferences(skins, images);
  assert.equal(refs.length, 1);
  assert.equal(refs[0].origin, 'preload');
  assert.match(refs[0].problem, /Non-literal asset reference/);
  assert.match(refs[0].reference, /preloadArraySimboli/);
});

test('dynamic asset references block selection with a diagnostic report and no output file', () => {
  fixture(({ assets, src }) => {
    writeFileSync(join(assets, 'img', 'risuonatore-solare-bianco.png'), 'image');
    const sourceDir = join(src, 'lib', 'renderers');
    writeFileSync(join(sourceDir, '@skin-manager.ts'),
      "const skins={dark:{texture:'assets/img/textures/texture-oro-1.jpg', imgRisuonatoreSolare:dynamicArtwork()}};");
    writeFileSync(join(sourceDir, 'gestore-immagini.ts'),
      "class GI {static preloadArraySimboli=['/assets/img/simboli-bianchi/segni/01.png', ...extraImages];}");

    const { files, report } = deriveSelection(assets, src);
    assert.equal(report.totalLiteralReferences, 2);
    assert.equal(report.nonLiteralExpressions, 2);
    assert.equal(report.unresolved.length, 2);
    assert.ok(report.unresolved.every(issue => /Non-literal asset reference/.test(issue.problem)));
    assert.deepEqual(files, [
      'img/simboli-bianchi/segni/01.png',
      'img/textures/texture-oro-1.jpg',
    ], 'Non-referenced artwork outside chart families must stay excluded');

    const out = join(assets, 'selection.json');
    const reportFile = join(assets, 'selection.report.json');
    const program = fileURLToPath(new URL('../scripts/derive-chart-asset-selection.mjs', import.meta.url));
    const completed = spawnSync(process.execPath, [program,
      '--root', assets, '--source', src, '--out', out, '--report', reportFile,
    ], { encoding: 'utf8' });
    assert.equal(completed.status, 2, completed.stderr);
    assert.equal(existsSync(out), false, 'No incomplete selection file may be written');
    const diagnostics = JSON.parse(readFileSync(reportFile, 'utf8'));
    assert.equal(diagnostics.unresolved.length, 2);
    assert.equal(diagnostics.nonLiteralExpressions, 2);
    assert.match(completed.stderr, /unresolved or non-literal/);
  });
});
