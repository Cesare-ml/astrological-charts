import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { generateSyntheticPack } from '../scripts/generate-synthetic-pack.mjs';
import { createAssetServer, resolveAssetRequest } from '../scripts/serve-local-assets.mjs';

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

    // Origin matching must be exact: neither host suffixes nor alternate ports
    // may inherit the demo's cross-origin permission.
    for (const spoofedOrigin of [
      'http://localhost.evil.example:4200',
      'http://localhost:4201',
      'http://127.0.0.1:4201',
      'null',
    ]) {
      const response = await fetch(url, {
        method: 'OPTIONS',
        headers: { Origin: spoofedOrigin, 'Access-Control-Request-Method': 'GET' },
      });
      assert.equal(response.status, 403, spoofedOrigin);
      assert.equal(response.headers.get('access-control-allow-origin'), null, spoofedOrigin);
      assert.equal(response.headers.get('access-control-allow-methods'), null, spoofedOrigin);
    }

    // A missing Origin is a same-origin/non-CORS request and must remain usable.
    // In contrast, an untrusted Origin must not bypass checks on the preview route.
    const sameOriginGet = await fetch(url);
    assert.equal(sameOriginGet.status, 200);
    assert.equal(sameOriginGet.headers.get('access-control-allow-origin'), null);
    assert.equal(sameOriginGet.headers.get('cache-control'), 'no-store');

    const previewDenied = await fetch(new URL('/__preview', url), {
      headers: { Origin: 'https://untrusted.example' },
    });
    assert.equal(previewDenied.status, 403);
    assert.equal(previewDenied.headers.get('access-control-allow-origin'), null);

    // Denied preview HEAD must not leak page metadata or an HTML body.
    const previewDeniedHead = await fetch(new URL('/__preview', url), {
      method: 'HEAD', headers: { Origin: 'https://untrusted.example' },
    });
    assert.equal(previewDeniedHead.status, 403);
    assert.equal(previewDeniedHead.headers.get('access-control-allow-origin'), null);
    assert.equal(previewDeniedHead.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(previewDeniedHead.headers.get('cache-control'), 'no-store');
    assert.equal(await previewDeniedHead.text(), '');

    // Preview HEAD must mirror GET metadata without exposing an HTML body.
    const previewUrl = new URL('/__preview', url);
    const previewGet = await fetch(previewUrl, {
      headers: { Origin: 'http://localhost:4200' },
    });
    assert.equal(previewGet.status, 200);
    assert.equal(previewGet.headers.get('referrer-policy'), 'no-referrer');
    assert.match(previewGet.headers.get('content-type') ?? '', /^text\/html/);
    assert.match(previewGet.headers.get('content-security-policy') ?? '', /default-src 'none'/);
    const previewBody = await previewGet.text();
    assert.match(previewBody, /Approved astrology assets/);
    assert.match(previewBody, /<a class="skip" href="#assets">Skip to asset gallery<\/a>/);
    assert.match(previewBody, /<main id="assets" class="grid" tabindex="-1" aria-label="Approved asset gallery">/);
    assert.match(previewBody, /\.skip:focus\{position:static/);
    assert.ok(previewBody.includes('<a href="https://www.virgostars.it/" rel="noopener noreferrer">Powered by VirgoStars</a>'));

    const previewHead = await fetch(previewUrl, {
      method: 'HEAD', headers: { Origin: 'http://localhost:4200' },
    });
    assert.equal(previewHead.status, 200);
    assert.equal(previewHead.headers.get('content-type'), previewGet.headers.get('content-type'));
    assert.equal(previewHead.headers.get('content-length'), previewGet.headers.get('content-length'));
    assert.equal(previewHead.headers.get('content-security-policy'), previewGet.headers.get('content-security-policy'));
    assert.equal(await previewHead.text(), '');

    const allowedGet = await fetch(url, {
      headers: { Origin: 'http://127.0.0.1:4200' },
    });
    assert.equal(allowedGet.status, 200);
    assert.equal(allowedGet.headers.get('access-control-allow-origin'), 'http://127.0.0.1:4200');
    assert.equal(allowedGet.headers.get('vary'), 'Origin');
    assert.equal(allowedGet.headers.get('cache-control'), 'no-store');
    assert.equal(allowedGet.headers.get('x-content-type-options'), 'nosniff');

    // GET must return the exact validated synthetic bytes, while HEAD advertises
    // their size without transmitting the body. This checks actual HTTP payloads.
    const expectedBytes = readFileSync(join(root, 'img/simboli-bianchi/segni/01.png'));
    const payloadGet = await fetch(url, { headers: { Origin: 'http://localhost:4200' } });
    assert.equal(payloadGet.status, 200);
    assert.equal(Number(payloadGet.headers.get('content-length')), expectedBytes.length);
    assert.deepEqual(Buffer.from(await payloadGet.arrayBuffer()), expectedBytes);

    const allowedHead = await fetch(url, {
      method: 'HEAD',
      headers: { Origin: 'http://localhost:4200' },
    });
    assert.equal(allowedHead.status, 200);
    assert.equal(allowedHead.headers.get('access-control-allow-origin'), 'http://localhost:4200');
    assert.equal(allowedHead.headers.get('content-type'), allowedGet.headers.get('content-type'));
    assert.equal(allowedHead.headers.get('content-length'), allowedGet.headers.get('content-length'));
    assert.equal(Number(allowedHead.headers.get('content-length')), expectedBytes.length);
    assert.equal(await allowedHead.text(), '');

    // A file outside the approved manifest must remain inaccessible even when
    // the request has a permitted CORS origin. No filesystem fallback is allowed.
    const unlisted = await fetch(new URL('/assets/img/not-approved.png', url), {
      headers: { Origin: 'http://localhost:4200' },
    });
    assert.equal(unlisted.status, 404);
    assert.equal(unlisted.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(unlisted.headers.get('cache-control'), 'no-store');
    assert.equal(unlisted.headers.get('x-content-type-options'), 'nosniff');

    // HEAD must not bypass the manifest allowlist or return file bytes.
    const unlistedHead = await fetch(new URL('/assets/img/not-approved.png', url), {
      method: 'HEAD',
      headers: { Origin: 'http://localhost:4200' },
    });
    assert.equal(unlistedHead.status, 404);
    assert.equal(unlistedHead.headers.get('cache-control'), 'no-store');
    assert.equal(unlistedHead.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(await unlistedHead.text(), '');

    // The server must recheck bytes after startup, not just trust the manifest.
    // This test only mutates a disposable synthetic fixture, never approved artwork.
    writeFileSync(join(root, 'img/simboli-bianchi/segni/01.png'), 'tampered fixture');
    for (const method of ['GET', 'HEAD']) {
      const tampered = await fetch(url, {
        method,
        headers: { Origin: 'http://localhost:4200' },
      });
      assert.equal(tampered.status, 409, method);
      assert.equal(tampered.headers.get('referrer-policy'), 'no-referrer', method);
      assert.equal(tampered.headers.get('cache-control'), 'no-store', method);
      assert.equal(tampered.headers.get('x-content-type-options'), 'nosniff', method);
    }

    const deniedHead = await fetch(url, {
      method: 'HEAD',
      headers: { Origin: 'https://untrusted.example' },
    });
    assert.equal(deniedHead.status, 403);
    assert.equal(deniedHead.headers.get('access-control-allow-origin'), null);
    assert.equal(deniedHead.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(await deniedHead.text(), '');

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

test('asset server rejects non-loopback and non-canonical CORS allowlists', () => {
  const directory = mkdtempSync(join(tmpdir(), 'charts-cors-config-'));
  try {
    const { root, manifest } = generateSyntheticPack(join(directory, 'pack'));
    for (const origin of [
      'https://untrusted.example',
      'ftp://localhost:4200',
      'file://localhost/assets',
      'http://localhost.evil.example:4200',
      'http://localhost:4200/path',
      'http://localhost:4200/',
      'http://user@localhost:4200',
      'null',
    ]) {
      assert.throws(
        () => createAssetServer({ root, manifest, origins: [origin] }),
        /Only local development origins may be allowed|Invalid URL/,
        origin,
      );
    }
    const server = createAssetServer({
      root, manifest, origins: ['http://localhost:4200'],
    });
    server.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('asset resolver rejects encoded traversal and malformed paths', () => {
  const directory = mkdtempSync(join(tmpdir(), 'charts-asset-path-'));
  try {
    const { root } = generateSyntheticPack(join(directory, 'pack'));
    const valid = resolveAssetRequest(root, '/assets/img/simboli-bianchi/segni/01.png');
    assert.equal(valid?.path, 'img/simboli-bianchi/segni/01.png');

    for (const unsafePath of [
      '/assets/img/../simboli-bianchi/segni/01.png',
      '/assets/img/%2e%2e/simboli-bianchi/segni/01.png',
      '/assets/img/%2Fsimboli-bianchi/segni/01.png',
      '/assets/img/%5Csimboli-bianchi/segni/01.png',
      '/assets/img/%252e%252e/simboli-bianchi/segni/01.png',
      '/assets/img/%ZZ.png',
      '/assets/img/simboli-bianchi/segni/01.png%00',
      '/assets/img/simboli-bianchi/segni/01.png:stream',
    ]) {
      assert.equal(resolveAssetRequest(root, unsafePath), null, unsafePath);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
