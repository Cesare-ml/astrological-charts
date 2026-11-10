/* Local renderer port-identity tests — dependency-free Node.js.
 * Copyright (c) 2026 Cesare-ml (VirgoStars project); CPAL-1.0.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { matchesLocalChartDemo, matchesSyntheticAssetServer, waitForChartControls }
  from '../scripts/verify-local-render-services.mjs';

const local = 'http://127.0.0.1:4177/';
const html = '<!doctype html><title>Astrological Charts demo</title><chart-demo></chart-demo>';
const images = ['img/example/a.png','img/example/b.png','img/example/c.png'].map((path, i) => {
  const bytes = Buffer.from('generated synthetic chart placeholder ' + i);
  return {
    path, bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    contents: bytes,
  };
});
const manifest = {
  schemaVersion: 1, source: { repository: 'synthetic-local-fixtures' },
  assets: images.map(({path,bytes,sha256})=>({path,bytes,sha256})),
};
function fakeAssetRequest(url) {
  const path = decodeURIComponent(new URL(url).pathname.replace('/assets/',''));
  const found=images.find(entry=>entry.path===path);
  return Promise.resolve(found
    ? new Response(found.contents, {status:200})
    : new Response('not found',{status:404}));
}

test('demo probe verifies expected Angular application, not only an HTTP response', async () => {
  assert.equal(await matchesLocalChartDemo('http://127.0.0.1:4200/',
    async ()=>new Response(html,{status:200})),true);
  assert.equal(await matchesLocalChartDemo('http://127.0.0.1:4200/',
    async ()=>new Response('<title>Another application</title>',{status:200})),false);
  assert.equal(await matchesLocalChartDemo('http://127.0.0.1:4200/',
    async ()=>new Response(html,{status:404})),false);
});

test('synthetic asset probe verifies bytes + size for multiple manifest entries', async () => {
  assert.equal(await matchesSyntheticAssetServer(local,manifest,fakeAssetRequest),true);
  assert.equal(await matchesSyntheticAssetServer(local,manifest,async url=>{
    if (new URL(url).pathname.includes('/b.png')) return new Response('wrong texture', {status:200});
    return fakeAssetRequest(url);
  }),false);
  assert.equal(await matchesSyntheticAssetServer(local,manifest,
    async ()=>new Response('Not in approved manifest', {status:404})),false);
});

test('local probes reject external hosts and unknown production manifests', async () => {
  await assert.rejects(matchesLocalChartDemo('https://virgostars.it/'), /127.0.0.1/);
  await assert.rejects(matchesSyntheticAssetServer('http://192.168.1.1:4177/',manifest), /127.0.0.1/);
  await assert.rejects(matchesSyntheticAssetServer(local,{
    ...manifest, source:{repository:'approved-real-artwork'},
  }), /generated synthetic/);
});

test('mounted Angular controls are checked before JSON import, with bounded timeout', async () => {
  let requestedTimeout;
  const fakePage = {
    async waitForFunction(fn, arg, options) {
      assert.equal(typeof fn, 'function');
      assert.equal(arg, null);
      requestedTimeout = options?.timeout;
    },
  };
  await waitForChartControls(fakePage);
  assert.equal(requestedTimeout, 12_000);
});

test('stale Angular server gives actionable diagnostics instead of a file-input timeout', async () => {
  const fakePage = {
    async waitForFunction() { throw new Error('controls never mounted'); },
    async evaluate() {
      return {title:'Astrological Charts demo',hasChartFile:false,
        hasMode:true,hasSkin:true,hasStatus:true,hasCanvas:true};
    },
  };
  await assert.rejects(waitForChartControls(fakePage, [
    'Cannot load local demo app module (synthetic test message)',
  ]), error => {
    assert.match(error.message, /Port 4200 may host a stale or incompatible Angular demo/);
    assert.match(error.message, /Import your computed chart/);
    assert.match(error.message, /"hasChartFile":false/);
    assert.match(error.message, /browser errors: Cannot load local demo app module/);
    return true;
  });
});

test('DOM readiness probe tolerates failed page inspection without hiding original problem', async () => {
  const fakePage = {
    async waitForFunction() { throw new Error('timeout'); },
    async evaluate() { throw new Error('page closed'); },
  };
  await assert.rejects(waitForChartControls(fakePage), /"unavailable":true/);
});
