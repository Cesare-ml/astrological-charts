import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAssetServer } from '../scripts/serve-local-assets.mjs';
import { generateSyntheticPack } from '../scripts/generate-synthetic-pack.mjs';

test('CORS preflight only advertises approved existing local asset paths', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'chart-preflight-'));
  let server;
  try {
    const { root, manifest } = generateSyntheticPack(join(dir, 'pack'));
    server = createAssetServer({ root, manifest });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const url = 'http://127.0.0.1:' + server.address().port;
    const request = path => fetch(url + path, {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:4200' }
    });
    const approved = await request('/assets/img/simboli-bianchi/segni/01.png');
    assert.equal(approved.status, 204);
    assert.equal(approved.headers.get('access-control-allow-origin'), 'http://localhost:4200');
    assert.equal(approved.headers.get('access-control-allow-methods'), 'GET, HEAD, OPTIONS');
    for (const path of ['/assets/img/unapproved.png', '/assets/img/../missing.png', '/__preview']) {
      assert.equal((await request(path)).status, 404, path);
    }
    // Mutating a previously approved file must invalidate both OPTIONS and GET.
    writeFileSync(join(root, 'img/simboli-bianchi/segni/01.png'), 'tampered bytes');
    assert.equal((await request('/assets/img/simboli-bianchi/segni/01.png')).status, 409);
    assert.equal((await fetch(url + '/assets/img/simboli-bianchi/segni/01.png')).status, 409);
    const forbidden = await fetch(url + '/assets/img/simboli-bianchi/segni/01.png', {
      method: 'OPTIONS', headers: { Origin: 'https://example.org' }
    });
    assert.equal(forbidden.status, 403);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});
