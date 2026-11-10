/* Copyright (c) 2026 Cesare-ml (VirgoStars). CPAL-1.0.
 * Verify local browser asset diagnostics without Chrome or private images.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createChartAssetRequestAudit } from '../scripts/chart-asset-request-audit.mjs';

const img = 'http://127.0.0.1:4177/assets/img/simboli/segni/light/01.png';

test('accepts successful local asset responses and ignores external or nonasset failures', () => {
  const audit = createChartAssetRequestAudit();
  audit.recordResponse(img, 200);
  audit.recordResponse(img, 304);
  audit.recordResponse('http://127.0.0.1:4200/main.js', 404);
  audit.recordFailure('https://example.com/external.png');
  audit.recordResponse('http://127.0.0.1:4177/__preview', 404);
  assert.doesNotThrow(() => audit.assertClean());
  assert.doesNotThrow(() => audit.assertHasLoadedAssets());
});

test('blocks incomplete local chart image exports without exposing private input paths', () => {
  const audit = createChartAssetRequestAudit();
  audit.recordResponse(img, 404);
  audit.recordResponse('http://127.0.0.1:4177/assets/img/planets/Moon.png', 409);
  audit.recordFailure('http://127.0.0.1:4177/assets/img/planets/Mars.png');
  assert.throws(() => audit.assertClean(), error => {
    assert.match(error.message, /3 local chart asset request/);
    assert.match(error.message, /HTTP 404 \/assets\/img\/simboli\/segni\/light\/01\.png/);
    assert.match(error.message, /HTTP 409 \/assets\/img\/planets\/Moon\.png/);
    assert.match(error.message, /request failed \/assets\/img\/planets\/Mars\.png/);
    assert.doesNotMatch(error.message, /Users\\|private\\|https:\/\//);
    return true;
  });
});

test('rejects any nonlocal audit endpoint and ignores irrelevant HTTP 300 statuses', () => {
  for (const endpoint of [
    'https://127.0.0.1:4177/',
    'http://localhost:4177/',
    'http://192.168.1.1:4177/',
    'http://127.0.0.1:4200/',
    'http://user:secret@127.0.0.1:4177/',
  ]) {
    assert.throws(() => createChartAssetRequestAudit(endpoint),
      /local 127\.0\.0\.1:4177/);
  }
  const audit = createChartAssetRequestAudit();
  audit.recordResponse(img, 304);
  audit.recordResponse(img, 399);
  audit.recordResponse(img, 0);
  assert.doesNotThrow(() => audit.assertClean());
});

test('approved mode rejects a chart that did not load any verified local image', () => {
  const audit = createChartAssetRequestAudit();
  audit.recordResponse('http://127.0.0.1:4200/main.js', 200);
  audit.recordResponse('https://example.com/unrelated.png', 200);
  assert.doesNotThrow(() => audit.assertClean());
  assert.throws(() => audit.assertHasLoadedAssets(),
    /requested no successfully served local assets/);
  audit.recordResponse(img, 200);
  assert.doesNotThrow(() => audit.assertHasLoadedAssets());
});
