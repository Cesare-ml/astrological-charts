import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assetExistsWithExactCase } from '../scripts/audit-demo-asset-coverage.mjs';

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
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
