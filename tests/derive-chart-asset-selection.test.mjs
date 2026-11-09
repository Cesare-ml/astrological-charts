import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
