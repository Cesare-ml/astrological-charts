import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { firefox } from 'playwright-core';
import { build } from 'esbuild';
import sharp from 'sharp';
import { verifyApprovedAssetPack } from '../scripts/verified-asset-pack.mjs';

test('Firefox renders four synthetic chart modes using verified local files while offline', {timeout:90000}, async () => {
  const executablePath = [process.env.FIREFOX_PATH, firefox.executablePath()].filter(Boolean).find(existsSync);
  assert.ok(executablePath, 'Install Playwright Firefox or set FIREFOX_PATH to its executable');
  const pack = resolve(process.env.CHART_DEMO_PACK || '.local/demo-pack');
  const assetsRoot = join(pack, 'public', 'assets');
  const manifestPath = join(pack, 'manifests', 'approved-assets.json');
  assert.ok(existsSync(manifestPath), 'Generate the synthetic pack first with npm run demo:pack');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.source?.repository, 'synthetic-local-fixtures');
  assert.ok(verifyApprovedAssetPack(assetsRoot, manifest).count > 0);
  const pagePath = join(pack, 'public', 'offline-test.html');
  writeFileSync(pagePath, '<!doctype html><meta charset="utf-8"><title>Offline chart test</title>');
  const bundle = await build({entryPoints:['tests/fixtures/offline-harness.ts'], bundle:true,
    write:false, platform:'browser', format:'iife', target:'es2022', tsconfig:'tsconfig.json'});
  const browser = await firefox.launch({executablePath, headless:true,
    firefoxUserPrefs:{'webgl.disabled':false, 'webgl.force-enabled':true}});
  const context = await browser.newContext({offline:true});
  const page = await context.newPage();
  const remoteRequests = [];
  page.on('request', req => { if (/^https?:/i.test(req.url())) remoteRequests.push(req.url()); });
  try {
    await page.goto(pathToFileURL(pagePath).href);
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    const url = pathToFileURL(assetsRoot + '/').href;
    const images = await page.evaluate(base => globalThis.runOfflineCharts(base), url);
    assert.equal(images.length, 4);
    for (const [index, image] of images.entries()) {
      assert.match(image, /^data:image\/png;base64,/);
      const png = Buffer.from(image.split(',')[1], 'base64');
      const metadata = await sharp(png).metadata();
      assert.equal(metadata.width, 400); assert.equal(metadata.height, 400);
      const stats = await sharp(png).stats();
      assert.ok(stats.channels.some(channel => channel.stdev > 5), 'offline PNG is blank');
      writeFileSync(join(pack, `offline-${['natal','transits','synastry','latitude'][index]}.png`), png);
    }
    assert.deepEqual(remoteRequests, [], 'offline render requested a network URL');
  } finally { await context.close(); await browser.close(); }
});
