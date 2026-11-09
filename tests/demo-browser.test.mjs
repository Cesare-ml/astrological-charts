import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const candidates = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
const executablePath = candidates.find(existsSync);
const output = '.local/demo-screenshots';
const skins = ['dark', 'dark-bn', 'light', 'light-bn', 'sun', 'astrolabio', 'astrolabio-girasole'];
const modes = ['natal', 'transits', 'synastry', 'latitude'];

test('synthetic Angular demo renders every chart and skin, exports PNG and reports missing assets', {timeout: 180000}, async () => {
  assert.ok(executablePath, 'Chromium/Chrome not found; set CHROME_PATH to an installed browser executable');
  mkdirSync(output, {recursive: true});
  const browser = await chromium.launch({executablePath, headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  const page = await browser.newPage({viewport: {width: 1200, height: 1000}, acceptDownloads: true});
  await page.addInitScript(() => {
    const stats = {created: 0, deleted: 0};
    (globalThis).__demoTextureStats = stats;
    for (const type of [globalThis.WebGLRenderingContext, globalThis.WebGL2RenderingContext]) {
      if (!type) continue;
      const proto = type.prototype;
      for (const [method, field] of [['createTexture','created'], ['deleteTexture','deleted']]) {
        const original = proto[method];
        proto[method] = function(...args) { stats[field]++; return original.apply(this,args); };
      }
    }
  });
  const errors = [], badResponses = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });
  const started = performance.now();
  const modeImages = new Map();
  async function ready() {
    await page.waitForFunction(() => {
      const status = document.querySelector('[data-testid=status]')?.textContent || '';
      return /Rendered|Rendering failed/.test(status) && !document.querySelector('#mode')?.disabled;
    }, {timeout: 30000});
    const status = await page.locator('[data-testid=status]').textContent();
    assert.match(status, /Rendered/, status);
  }
  try {
    await page.goto('http://127.0.0.1:4200/', {waitUntil: 'domcontentloaded'});
    await ready();
    for (const mode of modes) {
      await page.selectOption('#mode', mode); await ready();
      for (const skin of skins) {
        await page.selectOption('#skin', skin); await ready();
        const screenshot = await page.locator('canvas').screenshot({path: join(output, `${mode}-${skin}.png`)});
        const {data, info} = await sharp(screenshot).resize(100, 100).removeAlpha().raw().toBuffer({resolveWithObject:true});
        const colors = new Set();
        for (let i = 0; i < data.length; i += info.channels) colors.add(`${data[i]},${data[i+1]},${data[i+2]}`);
        assert.ok(colors.size > 10, `${mode}/${skin}: chart screenshot appears blank`);
        if (skin === 'light') modeImages.set(mode, createHash('sha256').update(data).digest('hex'));
      }
    }
    assert.equal(new Set(modeImages.values()).size, modes.length, 'chart modes should produce different canvas images');
    const beforeZoom = await page.locator('canvas').screenshot();
    await page.getByRole('button', {name:'Zoom in'}).click();
    const afterZoom = await page.locator('canvas').screenshot();
    assert.notDeepEqual(beforeZoom, afterZoom, 'zoom should change the chart');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', {name:'Export PNG'}).click()]);
    const png = join(output, 'export.png'); await download.saveAs(png);
    const metadata = await sharp(png).metadata();
    assert.equal(metadata.format, 'png'); assert.equal(metadata.width, 1600); assert.equal(metadata.height, 1600);
    const exportStats = await sharp(png).stats();
    assert.ok(exportStats.channels.some(channel => channel.stdev > 5), 'exported PNG appears blank');
    const textureStats = await page.evaluate(() => globalThis.__demoTextureStats);
    assert.ok(textureStats.created > 0 && textureStats.deleted > 0, `Expected WebGL texture disposal: ${JSON.stringify(textureStats)}`);
    console.log(`WebGL texture calls in this run: ${JSON.stringify(textureStats)} (not a GPU memory measurement).`);
    await page.setViewportSize({width: 390, height: 844});
    await page.waitForTimeout(400); // allow the renderer's debounced resize to finish
    await page.screenshot({path: join(output, 'mobile.png'), fullPage:true});
    assert.ok(await page.locator('canvas').isVisible());
    const mobile = await sharp(await page.locator('canvas').screenshot()).resize(80, 80).removeAlpha().raw().toBuffer({resolveWithObject:true});
    const mobileColors = new Set();
    for (let i = 0; i < mobile.data.length; i += mobile.info.channels) mobileColors.add(`${mobile.data[i]},${mobile.data[i+1]},${mobile.data[i+2]}`);
    assert.ok(mobileColors.size > 10, 'canvas is blank after the debounced mobile resize');
    assert.deepEqual(errors, []); assert.deepEqual(badResponses, []);
    await page.route('**/assets/img/simboli-bianchi/segni/01.png', route => route.abort());
    await page.selectOption('#mode', 'natal');
    await page.waitForFunction(() => (document.querySelector('[data-testid=status]')?.textContent || '').includes('Rendering failed'), {timeout: 30000});
    assert.match(await page.locator('[data-testid=status]').textContent(), /simboli-bianchi\/segni\/01\.png/);
    console.log(`28 chart/skin combinations, PNG export and mobile viewport checked in ${Math.round(performance.now()-started)} ms.`);
  } finally { await browser.close(); }
});
