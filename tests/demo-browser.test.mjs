import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium, firefox } from 'playwright-core';
import sharp from 'sharp';
import { build } from 'esbuild';

const browserName = process.env.CHART_TEST_BROWSER || 'chromium';
assert.ok(['chromium','firefox'].includes(browserName), 'CHART_TEST_BROWSER must be chromium or firefox');
const candidates = browserName === 'firefox' ? [process.env.FIREFOX_PATH, firefox.executablePath()].filter(Boolean) : [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
const executablePath = candidates.find(existsSync);
const output = browserName === 'firefox' ? '.local/demo-screenshots-firefox' : '.local/demo-screenshots';
function launchBrowser() {
  assert.ok(executablePath, `Browser ${browserName} not found; set ${browserName === 'firefox' ? 'FIREFOX_PATH' : 'CHROME_PATH'}`);
  return browserName === 'firefox'
    ? firefox.launch({executablePath, headless:true, firefoxUserPrefs:{'webgl.disabled':false, 'webgl.force-enabled':true}})
    : chromium.launch({executablePath, headless:true, args:['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
}
const skins = ['dark', 'dark-bn', 'light', 'light-bn', 'sun', 'astrolabio', 'astrolabio-girasole'];
const modes = ['natal', 'transits', 'synastry', 'latitude'];

test('synthetic Angular demo renders every chart and skin, exports PNG and reports missing assets', {timeout: 180000}, async () => {
  mkdirSync(output, {recursive: true});
  const browser = await launchBrowser();
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
  const imageHashes = new Map();
  const referenceScreenshots = new Map();
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
        const pixels = await sharp(screenshot).removeAlpha().raw().toBuffer();
        imageHashes.set(`${mode}/${skin}`, createHash('sha256').update(pixels).digest('hex'));
        referenceScreenshots.set(`${mode}/${skin}`, screenshot);
        const {data, info} = await sharp(screenshot).resize(100, 100).removeAlpha().raw().toBuffer({resolveWithObject:true});
        const colors = new Set();
        for (let i = 0; i < data.length; i += info.channels) colors.add(`${data[i]},${data[i+1]},${data[i+2]}`);
        assert.ok(colors.size > 10, `${mode}/${skin}: chart screenshot appears blank`);
        if (skin === 'light') modeImages.set(mode, createHash('sha256').update(data).digest('hex'));
      }
    }
    assert.equal(new Set(modeImages.values()).size, modes.length, 'chart modes should produce different canvas images');
    for (const mode of modes) {
      await page.selectOption('#mode', mode); await ready();
      for (const skin of skins) {
        await page.selectOption('#skin', skin); await ready();
        const screenshot = await page.locator('canvas').screenshot();
        const pixels = await sharp(screenshot).removeAlpha().raw().toBuffer();
        const actualHash = createHash('sha256').update(pixels).digest('hex');
        if (actualHash !== imageHashes.get(`${mode}/${skin}`)) {
          const baseline = await sharp(referenceScreenshots.get(`${mode}/${skin}`)).removeAlpha().raw().toBuffer();
          assert.equal(pixels.length, baseline.length, `${mode}/${skin}: screenshot dimensions changed`);
          let substantial = 0;
          for (let i = 0; i < pixels.length; i++) if (Math.abs(pixels[i] - baseline[i]) > 2) substantial++;
          if (substantial > Math.ceil(pixels.length * 0.0001)) {
            writeFileSync(join(output, `repeat-${mode}-${skin}.png`), screenshot);
          }
          assert.ok(substantial <= Math.ceil(pixels.length * 0.0001),
            `${mode}/${skin}: repeated rendering has ${substantial} channels differing by more than 2`);
        }
      }
    }
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
    // A fresh browser context avoids reusing a symbol already cached by Firefox.
    const missingPage = await browser.newPage();
    await missingPage.route('**/assets/img/simboli-bianchi/segni/01.png', route => route.abort());
    await missingPage.goto('http://127.0.0.1:4200/');
    await missingPage.waitForFunction(() => (document.querySelector('[data-testid=status]')?.textContent || '').includes('Rendering failed'), {timeout: 30000});
    assert.match(await missingPage.locator('[data-testid=status]').textContent(), /simboli-bianchi\/segni\/01\.png/);
    await missingPage.close();
    console.log(`28 chart/skin combinations repeated twice, PNG export and mobile viewport checked in ${Math.round(performance.now()-started)} ms.`);
  } finally { await browser.close(); }
});

test('render waits for a slow skin texture and reports its failure', {timeout: 60000}, async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  let release;
  const hold = new Promise(resolve => { release = resolve; });
  let requested;
  const hit = new Promise(resolve => { requested = resolve; });
  try {
    await page.goto('http://127.0.0.1:4200/');
    await page.waitForFunction(() => (document.querySelector('[data-testid=status]')?.textContent || '').includes('Rendered'), {timeout:30000});
    await page.route('**/assets/img/textures/texture-oro-3.webp', async route => {
      requested(); await hold; await route.abort();
    });
    await page.selectOption('#skin','sun');
    await hit;
    await page.waitForTimeout(500);
    assert.match(await page.locator('[data-testid=status]').textContent(), /Rendering/, 'must not report completion before texture load');
    release();
    await page.waitForFunction(() => (document.querySelector('[data-testid=status]')?.textContent || '').includes('Rendering failed'), {timeout:30000});
    assert.match(await page.locator('[data-testid=status]').textContent(), /texture-oro-3\.webp/);
    await page.unroute('**/assets/img/textures/texture-oro-3.webp');
    await page.selectOption('#skin','light');
    await page.waitForFunction(() => (document.querySelector('[data-testid=status]')?.textContent || '').includes('Rendered'), {timeout:30000});
    const bundle = await build({entryPoints:['tests/fixtures/concurrency-harness.ts'], bundle:true,
      write:false, platform:'browser', format:'iife', target:'es2022', tsconfig:'tsconfig.json'});
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    await page.route('**/assets/img/textures/texture-oro-3.webp', route => route.abort());
    assert.match(await page.evaluate(() => globalThis.runMissingTextureExport()), /texture-oro-3\.webp/);
  } finally { release(); await browser.close(); }
});

test('concurrent render and exports retain each canvas dimensions', {timeout: 90000}, async () => {
  const bundle = await build({entryPoints:['tests/fixtures/concurrency-harness.ts'], bundle:true,
    write:false, platform:'browser', format:'iife', target:'es2022', tsconfig:'tsconfig.json'});
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    await page.goto('http://127.0.0.1:4200/');
    await page.waitForFunction(() => (document.querySelector('[data-testid=status]')?.textContent || '').includes('Rendered'), {timeout:30000});
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    const result = await page.evaluate(() => globalThis.runChartConcurrencyProbe());
    assert.ok(result.expectedResolutions.length > 0, 'fixture must exercise line-material dimensions');
    assert.ok(result.smallMatches, 'small concurrent export differs from its sequential baseline');
    assert.ok(result.largeMatches, 'large concurrent export differs from its sequential baseline');
    assert.deepEqual(result.concurrentResolutions, result.expectedResolutions, 'interactive redraw dimensions changed during export');
    assert.ok(result.timelineCount > 0, 'fixture must create an actual repeating GSAP timeline');
    assert.ok(result.timelineCleared, 'redraw must stop timelines owned by the previous scene');
    assert.ok(result.exportTimelineCleared, 'export must stop its scene timelines');
    assert.equal(result.finalBackground, '333333', 'the latest redraw should win');
    assert.ok(result.queueRecovered, 'a rejected export must not block the next queued operation');
    assert.ok(result.destroyedDrawSkipped, 'a queued draw must not revive a destroyed renderer');
  } finally { await browser.close(); }
});

test('a scene that fails after creating an animation does not leak its timeline', {timeout:60000}, async () => {
  const bundle = await build({entryPoints:['tests/fixtures/concurrency-harness.ts'], bundle:true,
    write:false, platform:'browser', format:'iife', target:'es2022', tsconfig:'tsconfig.json'});
  const browser = await launchBrowser();
  try {
    for (const file of ['elementi-celesti/Moon.png', 'case/06.png']) {
      const page = await browser.newPage();
      await page.route(`**/assets/img/simboli-bianchi/${file}`, route => route.abort());
      await page.goto('http://127.0.0.1:4200/');
      await page.waitForFunction(() => (document.querySelector('[data-testid=status]')?.textContent || '').includes('Rendering failed'), {timeout:30000});
      await page.addScriptTag({content:bundle.outputFiles[0].text});
      const result = await page.evaluate(() => globalThis.runFailedSceneAnimationProbe());
      assert.ok(result.message.includes(file), result.message);
      assert.equal(result.leaked, 0, `timeline survived a scene failing on ${file}`);
      await page.close();
    }
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:4200/');
    await page.waitForFunction(() => (document.querySelector('[data-testid=status]')?.textContent || '').includes('Rendered'), {timeout:30000});
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    const result = await page.evaluate(() => globalThis.runFailedSceneAnimationProbe(true));
    assert.match(result.message, /segni\/06\.png/);
    assert.equal(result.leaked, 0, 'timeline survived a failure in the synastry ring');
    await page.close();
  } finally { await browser.close(); }
});

test('a planet at latitude zero changes the actual synthetic Three.js latitude PNG', {timeout: 90000}, async () => {
  mkdirSync(output, {recursive: true});
  const bundle = await build({entryPoints:['tests/fixtures/latitude-zero-render-harness.ts'],
    bundle:true, write:false, platform:'browser', format:'iife', target:'es2022', tsconfig:'tsconfig.json'});
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    await page.goto('http://127.0.0.1:4200/');
    await page.waitForFunction(() =>
      (document.querySelector('[data-testid=status]')?.textContent || '').includes('Rendered'),
      null, {timeout:30000});
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    const {withSun, withoutSun, negativeZeroSun, shiftedSun} = await page.evaluate(() => globalThis.runZeroLatitudeRenderProbe());
    assert.match(withSun, /^data:image\/png;base64,/);
    assert.match(withoutSun, /^data:image\/png;base64,/);
    assert.match(negativeZeroSun, /^data:image\/png;base64,/);
    assert.match(shiftedSun, /^data:image\/png;base64,/);
    const a = Buffer.from(withSun.split(',')[1], 'base64');
    const b = Buffer.from(withoutSun.split(',')[1], 'base64');
    const z = Buffer.from(negativeZeroSun.split(',')[1], 'base64');
    const c = Buffer.from(shiftedSun.split(',')[1], 'base64');
    const [first, second, negativeZero, shifted] = await Promise.all([
      sharp(a).removeAlpha().raw().toBuffer({resolveWithObject:true}),
      sharp(b).removeAlpha().raw().toBuffer({resolveWithObject:true}),
      sharp(z).removeAlpha().raw().toBuffer({resolveWithObject:true}),
      sharp(c).removeAlpha().raw().toBuffer({resolveWithObject:true}),
    ]);
    assert.equal(first.info.width, 400);
    assert.equal(first.info.height, 400);
    assert.deepEqual({width:first.info.width, height:first.info.height, channels:first.info.channels},
      {width:second.info.width, height:second.info.height, channels:second.info.channels});
    assert.deepEqual({width:first.info.width, height:first.info.height, channels:first.info.channels},
      {width:shifted.info.width, height:shifted.info.height, channels:shifted.info.channels});
    assert.deepEqual({width:first.info.width, height:first.info.height, channels:first.info.channels},
      {width:negativeZero.info.width, height:negativeZero.info.height, channels:negativeZero.info.channels});
    let changedChannels = 0, shiftedChannels = 0, negativeZeroDifferences = 0;
    for (let i = 0; i < first.data.length; i++) {
      if (Math.abs(first.data[i] - second.data[i]) > 2) changedChannels++;
      if (Math.abs(first.data[i] - shifted.data[i]) > 2) shiftedChannels++;
      if (Math.abs(first.data[i] - negativeZero.data[i]) > 2) negativeZeroDifferences++;
    }
    assert.ok(negativeZeroDifferences <= Math.ceil(first.data.length * 0.0001),
      `positive and negative zero must render identically within pixel tolerance (different channels: ${negativeZeroDifferences})`);
    assert.ok(changedChannels > 30,
      `the zero-latitude Sun should appear in the real Three.js ring (changed channels: ${changedChannels})`);
    assert.ok(shiftedChannels > 30,
      `the zero-latitude Sun must move when latitude changes to +2° (changed channels: ${shiftedChannels})`);
    writeFileSync(join(output, 'latitude-zero-sun-enabled.png'), a);
    writeFileSync(join(output, 'latitude-negative-zero-sun-enabled.png'), z);
    writeFileSync(join(output, 'latitude-zero-sun-disabled.png'), b);
    writeFileSync(join(output, 'latitude-positive-two-sun-enabled.png'), c);
  } finally {
    await browser.close();
  }
});
