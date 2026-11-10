/** Local end-to-end timings for the demo, not a GPU memory profiler. */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium, firefox } from 'playwright-core';

const browserName = process.env.CHART_TEST_BROWSER || 'chromium';
assert.ok(['chromium', 'firefox'].includes(browserName), 'CHART_TEST_BROWSER must be chromium or firefox');
const count = Number(process.env.CHART_BENCH_REDRAWS || '30');
assert.ok(Number.isInteger(count) && count >= 1 && count <= 200, 'CHART_BENCH_REDRAWS must be an integer from 1 to 200');
const candidates = browserName === 'firefox'
  ? [process.env.FIREFOX_PATH, firefox.executablePath()]
  : [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
const executablePath = candidates.filter(Boolean).find(existsSync);
assert.ok(executablePath, `Browser ${browserName} not found; set ${browserName === 'firefox' ? 'FIREFOX_PATH' : 'CHROME_PATH'}`);
const browser = browserName === 'firefox'
  ? await firefox.launch({executablePath, headless: true, firefoxUserPrefs: {'webgl.disabled': false, 'webgl.force-enabled': true}})
  : await chromium.launch({executablePath, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});

try {
  const page = await browser.newPage({viewport: {width: 1200, height: 1000}});
  await page.addInitScript(() => {
    const stats = {created: 0, deleted: 0, contextLost: 0};
    globalThis.__benchmarkWebGL = stats;
    document.addEventListener('webglcontextlost', () => { stats.contextLost++; }, true);
    for (const type of [globalThis.WebGLRenderingContext, globalThis.WebGL2RenderingContext]) {
      if (!type) continue;
      for (const [name, field] of [['createTexture', 'created'], ['deleteTexture', 'deleted']]) {
        const original = type.prototype[name];
        type.prototype[name] = function(...args) { stats[field]++; return original.apply(this, args); };
      }
    }
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  const ready = async () => {
    await page.waitForFunction(() => {
      const status = document.querySelector('[data-testid=status]')?.textContent || '';
      return /Rendered|Rendering failed/.test(status) && !document.querySelector('#skin')?.disabled;
    }, {timeout: 30000});
    assert.match(await page.locator('[data-testid=status]').textContent(), /Rendered/, 'render failed');
  };
  const start = performance.now();
  await page.goto('http://127.0.0.1:4200/', {waitUntil: 'domcontentloaded'});
  await ready();
  const initialMs = performance.now() - start;
  let previous = await page.evaluate(() => ({...globalThis.__benchmarkWebGL}));
  const checkpoints = [{redraw: 0, ...previous}];
  const samples = [];
  for (let i = 0; i < count; i++) {
    const started = performance.now();
    await page.selectOption('#skin', i % 2 === 0 ? 'dark' : 'light');
    await ready();
    samples.push(performance.now() - started);
    const current = await page.evaluate(() => ({...globalThis.__benchmarkWebGL}));
    assert.ok(current.created > previous.created, `redraw ${i + 1} did not create textures`);
    if ((i + 1) % 10 === 0 || i + 1 === count) checkpoints.push({redraw: i + 1, ...current});
    previous = current;
  }
  const sorted = samples.toSorted((a, b) => a - b);
  const round = n => Math.round(n * 10) / 10;
  const percentile = p => round(sorted[Math.ceil(p * sorted.length) - 1]);
  const webgl = await page.evaluate(() => globalThis.__benchmarkWebGL);
  assert.deepEqual(errors, [], `browser errors: ${errors.join('; ')}`);
  assert.equal(webgl.contextLost, 0, 'WebGL context was lost');
  assert.ok(webgl.created > 0 && webgl.deleted > 0, 'expected texture creation and deletion calls');
  console.log(JSON.stringify({
    recordedAt: new Date().toISOString(), platform: process.platform, architecture: process.arch,
    node: process.version, browser: browserName, browserVersion: browser.version(),
    viewport: {width: 1200, height: 1000}, chart: 'natal', alternatingSkins: ['dark', 'light'],
    initialNavigationToReadyMs: round(initialMs), redraws: count,
    redrawMs: {min: round(sorted[0]), median: percentile(0.5), p95: percentile(0.95), max: round(sorted.at(-1))},
    webglCalls: webgl, checkpoints,
    limitations: 'End-to-end browser automation timings include UI and scheduling; asset provenance is determined by the running server. Texture calls are not GPU memory or leak measurements. No production artwork, e-ink or hardware compatibility is implied.',
  }, null, 2));
} finally { await browser.close(); }
