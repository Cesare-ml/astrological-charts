import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { generateDemoPack } from '../scripts/generate-demo-pack.mjs';
import { verifyApprovedAssetPack } from '../scripts/verified-asset-pack.mjs';

test('demo pack has independently generated, verified PNG, JPEG and WebP fixtures', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'chart-demo-pack-'));
  try {
    const pack = await generateDemoPack(join(dir, 'pack'));
    assert.equal(pack.manifest.assets.length, 392);
    assert.equal(verifyApprovedAssetPack(pack.root, pack.manifest).count, 392);
    for (const [path, format] of [
      ['img/risuonatore-solare-bianco.png','png'],
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
