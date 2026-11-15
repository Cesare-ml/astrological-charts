import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import ts from 'typescript';
import { assetPath, extractStaticReferences } from '../scripts/derive-chart-asset-selection.mjs';
import { generateDemoPack } from '../scripts/generate-demo-pack.mjs';
import { verifyApprovedAssetPack } from '../scripts/verified-asset-pack.mjs';

test('demo pack has independently generated, verified PNG, JPEG and WebP fixtures', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'chart-demo-pack-'));
  try {
    const pack = await generateDemoPack(join(dir, 'pack'));
    assert.equal(pack.manifest.assets.length, 452);
    // Keep the synthetic browser fixture in sync with active SkinManager artwork
    // without copying any host-owned images into the repository.
    const skinSource = readFileSync(new URL('../src/lib/renderers/@skin-manager.ts', import.meta.url), 'utf8');
    const skinAst = ts.createSourceFile('skin-manager.ts', skinSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const emptyAst = ts.createSourceFile('empty.ts', '', ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const skinAssetPaths = new Set(extractStaticReferences(skinAst, emptyAst)
      .filter(entry => entry.origin === 'skin')
      .map(entry => assetPath(entry.reference)));
    const generatedPaths = new Set(pack.manifest.assets.map(entry => entry.path));
    assert.ok(skinAssetPaths.size > 0, 'No active skin artwork was discovered');
    for (const path of skinAssetPaths) {
      assert.ok(generatedPaths.has(path), 'Synthetic demo pack is missing active skin asset: ' + path);
    }
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
