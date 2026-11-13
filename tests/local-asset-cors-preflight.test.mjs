import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { generateSyntheticPack } from '../scripts/generate-synthetic-pack.mjs';
import { createAssetServer } from '../scripts/serve-local-assets.mjs';

test('CORS preflight only authorizes configured local origins', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'charts-cors-'));
  let server;
  try {
    const { root, manifest } = generateSyntheticPack(join(directory, 'pack'));
    server = createAssetServer({ root, manifest });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const url = 'http://127.0.0.1:' + server.address().port +
      '/assets/img/simboli-bianchi/segni/01.png';

    const allowed = await fetch(url, {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:4200', 'Access-Control-Request-Method': 'GET' },
    });
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:4200');
    assert.match(allowed.headers.get('access-control-allow-methods') ?? '', /GET/);
    assert.equal(await allowed.text(), '');

    const denied = await fetch(url, {
      method: 'OPTIONS',
      headers: { Origin: 'https://untrusted.example', 'Access-Control-Request-Method': 'GET' },
    });
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.get('access-control-allow-origin'), null);

    const noOrigin = await fetch(url, { method: 'OPTIONS' });
    assert.equal(noOrigin.status, 204);
    assert.equal(noOrigin.headers.get('access-control-allow-origin'), null);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    rmSync(directory, { recursive: true, force: true });
  }
});
