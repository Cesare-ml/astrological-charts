import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { readSafeAsset, verifyApprovedAssetPack } from '../scripts/verified-asset-pack.mjs';

function fixture(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'charts-approved-size-'));
  const root = join(dir, 'assets');
  const file = 'img/synthetic.png';
  const fullPath = join(root, 'img', 'synthetic.png');
  const bytes = Buffer.from('original synthetic image bytes');
  mkdirSync(join(root, 'img'), { recursive: true });
  writeFileSync(fullPath, bytes);
  const record = {
    path: file,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    rightsHolder: 'Synthetic fixture',
    permissionBasis: 'Generated inside test, not production artwork',
    approvalEvidence: 'tests/approved-pack-size-gate.test.mjs',
    status: 'approved',
  };
  try { fn({root, file, fullPath, bytes, record}); }
  finally { rmSync(dir, { recursive: true, force: true }); }
}

test('approved file bytes are returned unchanged with and without size hint', () => {
  fixture(({root, file, bytes, record}) => {
    assert.deepEqual(readSafeAsset(root, file), bytes);
    assert.deepEqual(readSafeAsset(root, file, bytes.length), bytes);
    const verified = verifyApprovedAssetPack(root, {schemaVersion: 1, assets: [record]});
    assert.equal(verified.count, 1);
    assert.equal(verified.totalBytes, bytes.length);
  });
});

test('size mismatch is rejected by readSafeAsset before file content is loaded', () => {
  fixture(({root, file, bytes}) => {
    // The third argument is the early size gate; without the guard, this
    // direct call would succeed and return bytes (a red-control regression).
    assert.throws(
      () => readSafeAsset(root, file, bytes.length + 1),
      /Asset differs from approved manifest: img\/synthetic\.png/,
    );
    assert.throws(
      () => readSafeAsset(root, file, 0),
      /Asset differs from approved manifest/,
    );
  });
});

test('manifest size mismatches fail without accepting altered metadata', () => {
  fixture(({root, record}) => {
    assert.throws(
      () => verifyApprovedAssetPack(root, {
        schemaVersion: 1,
        assets: [{...record, bytes: record.bytes + 1}],
      }),
      /Asset differs from approved manifest/,
    );
  });
});

test('same-size tampering still fails the SHA-256 integrity check', () => {
  fixture(({root, fullPath, bytes, record}) => {
    const altered = Buffer.from(bytes);
    altered[0] ^= 1;
    writeFileSync(fullPath, altered);
    assert.equal(readFileSync(fullPath).length, record.bytes);
    assert.throws(
      () => verifyApprovedAssetPack(root, {schemaVersion: 1, assets: [record]}),
      /Asset differs from approved manifest/,
    );
  });
});
