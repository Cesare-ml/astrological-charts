/* Browser-free safety checks for explicitly selected external assets.
 * Copyright (c) 2026 Cesare-ml (VirgoStars project); CPAL-1.0.
 * All bytes are generated test fixtures; no real artwork is committed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateSyntheticPack } from '../scripts/generate-synthetic-pack.mjs';
import { loadVerifiedExternalRenderPack } from '../scripts/approved-render-assets.mjs';

test('external mode accepts only a manifest that matches every local binary file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'chart-approved-render-'));
  try {
    const fixture = generateSyntheticPack(join(dir, 'fixture'));
    const external = {...fixture.manifest,
      source: {repository: 'local-test-approved-pack'}};
    const manifestPath = join(dir, 'external-manifest.json');
    writeFileSync(manifestPath, JSON.stringify(external));
    const {verified, manifest} = loadVerifiedExternalRenderPack(fixture.root, manifestPath);
    assert.equal(verified.count, fixture.manifest.assets.length);
    assert.equal(manifest.source.repository, 'local-test-approved-pack');

    const first = external.assets[0].path;
    const assetPath = join(fixture.root, ...first.split('/'));
    const original = readFileSync(assetPath);
    writeFileSync(assetPath, Buffer.from('MODIFIED FIXTURE BYTES'));
    assert.throws(() => loadVerifiedExternalRenderPack(fixture.root, manifestPath),
      /Asset differs from approved manifest/);
    writeFileSync(assetPath, original);

    const invalid = {...external, source:{repository:'synthetic-local-fixtures'}};
    writeFileSync(manifestPath, JSON.stringify(invalid));
    assert.throws(() => loadVerifiedExternalRenderPack(fixture.root, manifestPath),
      /separately approved, non-synthetic/);
    writeFileSync(manifestPath, JSON.stringify({...external, source:{}}));
    assert.throws(() => loadVerifiedExternalRenderPack(fixture.root, manifestPath),
      /separately approved, non-synthetic/);
    assert.throws(() => loadVerifiedExternalRenderPack('', manifestPath),
      /Both external asset root/);
    assert.throws(() => loadVerifiedExternalRenderPack(fixture.root, join(dir,'missing.json')),
      /ENOENT/);
  } finally {
    rmSync(dir, {recursive:true, force:true});
  }
});
