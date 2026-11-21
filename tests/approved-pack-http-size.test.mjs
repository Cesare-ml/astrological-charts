import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createAssetServer } from '../scripts/serve-local-assets.mjs';

// Synthetic local bytes only; no live VirgoStars or private chart artwork.
async function withApprovedServer(run) {
  const dir = mkdtempSync(join(tmpdir(), 'chart-http-size-'));
  const root = join(dir, 'assets');
  const path = 'img/synthetic.png';
  const file = join(root, 'img', 'synthetic.png');
  const original = Buffer.from('synthetic image bytes for local verification');
  mkdirSync(join(root, 'img'), { recursive: true });
  writeFileSync(file, original);
  const manifest = {
    schemaVersion: 1,
    assets: [{
      path,
      bytes: original.length,
      sha256: createHash('sha256').update(original).digest('hex'),
      rightsHolder: 'Synthetic fixture',
      permissionBasis: 'Generated in test, without external artwork',
      approvalEvidence: 'tests/approved-pack-http-size.test.mjs',
      status: 'approved',
    }],
  };
  let server;
  try {
    server = createAssetServer({root, manifest});
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const url = `http://127.0.0.1:${server.address().port}/assets/${path}`;
    await run({url, file, original});
  } finally {
    if (server?.listening) await new Promise((resolve, reject) =>
      server.close(error => error ? reject(error) : resolve()));
    rmSync(dir, { recursive: true, force: true });
  }
}

test('HTTP GET and HEAD reject changed lengths and recover after file restoration', async () => {
  await withApprovedServer(async ({url, file, original}) => {
    const initial = await fetch(url);
    assert.equal(initial.status, 200);
    assert.deepEqual(Buffer.from(await initial.arrayBuffer()), original);

    // The server was initialized with the original manifest; both HTTP
    // methods must still enforce its approved byte count after startup.
    writeFileSync(file, Buffer.concat([original, Buffer.alloc(1024 * 1024)]));
    const originalRead = fs.readFileSync;
    let oversizedFileReads = 0;
    // syncBuiltinESMExports propagates this spy to the helper's ESM named
    // fs.readFileSync import, proving that rejection happens BEFORE reading.
    fs.readFileSync = (path, ...args) => {
      if (String(path).endsWith(join('img', 'synthetic.png')))
        oversizedFileReads++;
      return originalRead(path, ...args);
    };
    syncBuiltinESMExports();
    try {
      for (const method of ['GET', 'HEAD']) {
        const response = await fetch(url, {method});
        assert.equal(response.status, 409, `${method} must reject changed size`);
        if (method === 'HEAD')
          assert.equal((await response.arrayBuffer()).byteLength, 0);
      }
      assert.equal(oversizedFileReads, 0,
        'an oversized approved file must be rejected before readFileSync');
    } finally {
      fs.readFileSync = originalRead;
      syncBuiltinESMExports();
    }

    writeFileSync(file, original);
    const restored = await fetch(url);
    assert.equal(restored.status, 200);
    assert.deepEqual(Buffer.from(await restored.arrayBuffer()), original);
    const restoredHead = await fetch(url, {method: 'HEAD'});
    assert.equal(restoredHead.status, 200);
    assert.equal(Number(restoredHead.headers.get('content-length')), original.length);
  });
});

test('HTTP GET and HEAD retain SHA-256 checks for modified same-size files', async () => {
  await withApprovedServer(async ({url, file, original}) => {
    const modified = Buffer.from(original);
    modified[0] ^= 1;
    writeFileSync(file, modified);
    assert.equal((await fetch(url)).status, 409);
    assert.equal((await fetch(url, {method: 'HEAD'})).status, 409);
  });
});
