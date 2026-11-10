import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { portInUse, reachable } from '../scripts/latitude-local-readiness.mjs';

async function withLocalServer(handler, run) {
  const server = createServer(handler);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  try { return await run(port); }
  finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

test('latitude runner detects an occupied localhost port and a freed one', async () => {
  let port;
  await withLocalServer((_req, res) => res.end('ok'), async assigned => {
    port = assigned;
    assert.equal(await portInUse(port), true);
  });
  assert.equal(await portInUse(port), false);
});

test('latitude runner accepts the expected identity and rejects unrelated HTTP 200', async () => {
  await withLocalServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<title>Astrological Charts demo</title>');
  }, async port => {
    const url = `http://127.0.0.1:${port}/`;
    assert.equal(await reachable(url, 'Astrological Charts demo'), true);
    assert.equal(await reachable(url, 'approved asset preview'), false);
  });
});

test('latitude runner rejects an HTTP error even if the expected marker appears', async () => {
  await withLocalServer((_req, res) => {
    res.statusCode = 503;
    res.end('approved asset preview');
  }, async port => {
    assert.equal(await reachable(`http://127.0.0.1:${port}/__preview`, 'approved asset preview'), false);
  });
});

test('latitude runner recognizes a marker split across real HTTP chunks', async () => {
  await withLocalServer((_req, res) => {
    res.write('<h1>approved asset ');
    res.end('preview</h1>');
  }, async port => {
    assert.equal(await reachable(`http://127.0.0.1:${port}/__preview`, 'approved asset preview'), true);
  });
});
