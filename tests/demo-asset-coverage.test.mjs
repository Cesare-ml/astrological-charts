import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assetExistsWithExactCase, observedAssetPath } from '../scripts/audit-demo-asset-coverage.mjs';

test('coverage checks real files with exact casing and rejects traversal', () => {
  const dir = mkdtempSync(join(tmpdir(),'chart-coverage-'));
  try {
    mkdirSync(join(dir,'img','symbols'),{recursive:true});
    writeFileSync(join(dir,'img','symbols','Sun.png'),'fixture');
    assert.equal(assetExistsWithExactCase(dir,'img/symbols/Sun.png'),true);
    assert.equal(assetExistsWithExactCase(dir,'img/symbols/sun.png'),false);
    assert.equal(assetExistsWithExactCase(dir,'img/symbols/Moon.png'),false);
    assert.equal(assetExistsWithExactCase(dir,'img/symbols'),false);
    assert.throws(() => assetExistsWithExactCase(dir,'img/../secret.png'),/Unsafe/);
    assert.throws(() => assetExistsWithExactCase(dir,'img/..\\secret.png'),/Unsafe/);

    for (const invalid of [
      'img/%2e%2e/private.png', 'img/symbols/Sun?.png',
      'img/symbols/Sun#.png', 'img/symbols/Sun:other.png',
      'img/symbols/Sun\\n.png', 'img/symbols/Sun\\u007f.png'
    ]) assert.throws(() => assetExistsWithExactCase(dir, invalid), /Unsafe/, invalid);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test('observed demo asset URLs normalize encoded spaces without loading external assets', () => {
  assert.equal(
    observedAssetPath('http://127.0.0.1:4177/assets/img/symbols/mean%20Apogee.png'),
    'img/symbols/mean Apogee.png'
  );
  assert.equal(
    observedAssetPath('http://127.0.0.1:4177/assets/img/symbols/Sun.png?cache=1'),
    'img/symbols/Sun.png'
  );
  for (const outside of [
    'https://127.0.0.1:4177/assets/img/Sun.png',
    'http://127.0.0.1:4178/assets/img/Sun.png',
    'http://localhost:4177/assets/img/Sun.png',
    'http://127.0.0.1:4177/index.html',
    'http://example.com/assets/img/Sun.png'
  ]) assert.equal(observedAssetPath(outside), null, outside);
});

test('observed demo asset URLs fail on encoded delimiters and malformed encodings', () => {
  for (const unsafe of [
    'Sun%2epng', 'Sun%2Falt.png', 'Sun%5calt.png',
    'Sun%252e.png', 'Sun%3falt.png', 'Sun%23alt.png',
    'Sun%3aalt.png', 'Sun%E0%A4%A.png'
  ]) {
    const url = 'http://127.0.0.1:4177/assets/img/symbols/' + unsafe;
    assert.throws(() => observedAssetPath(url), /(?:Ambiguous|Malformed|Noncanonical)/, unsafe);
  }
});
