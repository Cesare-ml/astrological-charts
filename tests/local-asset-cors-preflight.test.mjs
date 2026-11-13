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

    const rejectedPreflight = await fetch(url, {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:4200', 'Access-Control-Request-Method': 'POST' },
    });
    assert.equal(rejectedPreflight.status, 405);
    assert.equal(rejectedPreflight.headers.get('allow'), 'GET, HEAD, OPTIONS');
    assert.equal(rejectedPreflight.headers.get('access-control-allow-methods'), null);

    const allowedHeadPreflight = await fetch(url, {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:4200', 'Access-Control-Request-Method': 'HEAD' },
    });
    assert.equal(allowedHeadPreflight.status, 204);
    assert.equal(allowedHeadPreflight.headers.get('access-control-allow-origin'), 'http://localhost:4200');
    assert.match(allowedHeadPreflight.headers.get('access-control-allow-methods') ?? '', /(?:^|, )HEAD(?:,|$)/);
    assert.equal(await allowedHeadPreflight.text(), '');

    const rejectedLowercaseMethod = await fetch(url, {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:4200', 'Access-Control-Request-Method': 'post' },
    });
    assert.equal(rejectedLowercaseMethod.status, 405);
    assert.equal(rejectedLowercaseMethod.headers.get('access-control-allow-methods'), null);

    const denied = await fetch(url, {
      method: 'OPTIONS',
      headers: { Origin: 'https://untrusted.example', 'Access-Control-Request-Method': 'GET' },
    });
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.get('access-control-allow-origin'), null);

    const allowedGet = await fetch(url, {
      headers: { Origin: 'http://127.0.0.1:4200' },
    });
    assert.equal(allowedGet.status, 200);
    assert.equal(allowedGet.headers.get('access-control-allow-origin'), 'http://127.0.0.1:4200');
    assert.equal(allowedGet.headers.get('vary'), 'Origin');
    assert.equal(allowedGet.headers.get('cache-control'), 'no-store');
    assert.equal(allowedGet.headers.get('x-content-type-options'), 'nosniff');

    const allowedHead = await fetch(url, {
      method: 'HEAD',
      headers: { Origin: 'http://localhost:4200' },
    });
    assert.equal(allowedHead.status, 200);
    assert.equal(allowedHead.headers.get('access-control-allow-origin'), 'http://localhost:4200');
    assert.equal(allowedHead.headers.get('content-type'), allowedGet.headers.get('content-type'));
    assert.equal(allowedHead.headers.get('content-length'), allowedGet.headers.get('content-length'));
    assert.equal(await allowedHead.text(), '');

    const deniedHead = await fetch(url, {
      method: 'HEAD',
      headers: { Origin: 'https://untrusted.example' },
    });
    assert.equal(deniedHead.status, 403);
    assert.equal(deniedHead.headers.get('access-control-allow-origin'), null);

    const deniedGet = await fetch(url, {
      headers: { Origin: 'https://untrusted.example' },
    });
    assert.equal(deniedGet.status, 403);
    assert.equal(deniedGet.headers.get('access-control-allow-origin'), null);

    const deniedMethod = await fetch(url, {
      method: 'POST',
      headers: { Origin: 'http://localhost:4200' },
    });
    assert.equal(deniedMethod.status, 405);
    assert.equal(deniedMethod.headers.get('allow'), 'GET, HEAD, OPTIONS');

    const noOrigin = await fetch(url, { method: 'OPTIONS' });
    assert.equal(noOrigin.status, 204);
    assert.equal(noOrigin.headers.get('access-control-allow-origin'), null);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    rmSync(directory, { recursive: true, force: true });
  }
});
