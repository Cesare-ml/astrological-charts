/**
 * Wave-2 independent axis/canvas regression, using only synthetic demo data.
 *
 * Run after: npm ci; npm run demo:pack; npm run demo:assets
 * In another terminal: npm run demo
 * Then: node --test tests/pilot-axis-canvas.browser.test.mjs
 *
 * Chrome/Chromium or Playwright Firefox, the local asset server and the real
 * Angular demo are required. This verifies visible canvas consequences, not
 * Three.js raycasting geometry, exact aspect orbs or production skin parity.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium, firefox } from 'playwright-core';
import sharp from 'sharp';

const browserName = process.env.CHART_TEST_BROWSER || 'chromium';
assert.ok(['chromium', 'firefox'].includes(browserName),
  'CHART_TEST_BROWSER must be chromium or firefox');
const candidates = browserName === 'firefox'
  ? [process.env.FIREFOX_PATH, firefox.executablePath()]
  : [process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
const browserPath = candidates.filter(Boolean).find(existsSync);

async function launch() {
  assert.ok(browserPath, 'Browser ' + browserName + ' unavailable (set CHROME_PATH or FIREFOX_PATH)');
  return browserName === 'firefox'
    ? firefox.launch({ executablePath: browserPath, headless: true,
      firefoxUserPrefs: { 'webgl.disabled': false, 'webgl.force-enabled': true } })
    : chromium.launch({ executablePath: browserPath, headless: true,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
}

async function ready(page, previousRevision = -1) {
  await page.waitForFunction(before => {
    const status = document.querySelector('[data-testid=status]');
    const revision = Number(status?.getAttribute('data-render-revision'));
    return status?.textContent?.includes('Rendered') &&
      !document.querySelector('#mode')?.disabled &&
      Number.isSafeInteger(revision) && revision > before;
  }, previousRevision, { timeout: 30000 });
}

async function selected(page, name) {
  await page.waitForFunction(expected =>
    document.querySelector('[data-testid=planet-selection]')?.textContent?.trim() === expected,
    name, { timeout: 10000 });
}

async function frame(page) {
  // Wait for Angular's zoneless update and the queued WebGL presentation.
  await page.evaluate(() => new Promise(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function pixels(canvas, page) {
  await frame(page);
  // Screenshot ONLY the canvas: sidebar labels/pressed buttons cannot pass this test.
  const { data, info } = await sharp(await canvas.screenshot())
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.channels, 3, 'Expected RGB screenshot data');
  return { data, width: info.width, height: info.height };
}

function changedChannels(left, right, tolerance = 16) {
  assert.equal(left.width, right.width, 'Canvas pixel width changed during focus');
  assert.equal(left.height, right.height, 'Canvas pixel height changed during focus');
  assert.equal(left.data.length, right.data.length);
  let changed = 0;
  for (let i = 0; i < left.data.length; i++) {
    if (Math.abs(left.data[i] - right.data[i]) > tolerance) changed++;
  }
  return changed;
}

async function metrics(canvas) {
  return canvas.evaluate(element => {
    const rect = element.getBoundingClientRect();
    // A real canvas WebGL context is required: CSS/HTML-only state is not enough.
    const gl = element.getContext('webgl2') || element.getContext('webgl');
    return {
      width: element.width, height: element.height,
      cssWidth: rect.width, cssHeight: rect.height,
      hasWebGL: !!gl
    };
  });
}

test('AS, DS, MC and IC each visibly focus the transits chart canvas without zoom or scene rebuild',
  { timeout: 120000 }, async () => {
    const browser = await launch();
    const page = await browser.newPage({ viewport: { width: 1400, height: 1100 },
      deviceScaleFactor: 1 });
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    try {
      await page.goto('http://127.0.0.1:4200/', { waitUntil: 'domcontentloaded' });
      await ready(page);
      const previousRevision = Number(await page.locator('[data-testid=status]')
        .getAttribute('data-render-revision'));
      await page.selectOption('#mode', 'transits');
      await ready(page, previousRevision);
      assert.equal(await page.locator('#planet-layer').inputValue(), 'natal');

      const canvas = page.locator('canvas[data-testid=chart]');
      const fixedMetrics = await metrics(canvas);
      assert.ok(fixedMetrics.width > 0 && fixedMetrics.height > 0 &&
        fixedMetrics.cssWidth > 0 && fixedMetrics.cssHeight > 0 && fixedMetrics.hasWebGL,
      'Chart must expose a nonzero visible WebGL canvas');

      const fixedRevision = Number(await page.locator('[data-testid=status]')
        .getAttribute('data-render-revision'));
      // Allow initial asset loading/tweening to settle before measuring paint noise.
      await page.waitForTimeout(350);
      const first = await pixels(canvas, page);
      await page.waitForTimeout(180);
      const baseline = await pixels(canvas, page);
      const noise = changedChannels(first, baseline);
      assert.ok(noise < Math.max(256, Math.floor(baseline.data.length * 0.001)),
        'Canvas is still changing without interaction (' + noise + ' channels)');
      const baselineStats = await sharp(await canvas.screenshot()).stats();
      assert.ok(baselineStats.channels.some(channel => channel.stdev > 5),
        'Canvas appears blank: check real demo, assets and WebGL');

      let previousFocus = null;
      for (const axis of ['AS', 'DS', 'MC', 'IC']) {
        const button = page.getByRole('button', { name: 'Highlight natal ' + axis });
        await button.click();
        await selected(page, 'natal:' + axis);
        assert.equal(await button.getAttribute('aria-pressed'), 'true');
        assert.ok(await page.locator('[data-testid=aspect-match]').count() > 0,
          axis + ' must have a supplied synthetic transit link');
        const focused = await pixels(canvas, page);
        const minimumChange = Math.max(120, noise * 4);
        const againstBaseline = changedChannels(baseline, focused);
        assert.ok(againstBaseline > minimumChange,
          axis + ' changed only UI state, not canvas pixels (' +
          againstBaseline + ' changed channels, idle noise ' + noise + ')');
        if (previousFocus) {
          const againstOtherAxis = changedChannels(previousFocus, focused);
          assert.ok(againstOtherAxis > minimumChange,
            axis + ' focus appears identical to preceding axis (' +
            againstOtherAxis + ' changed channels)');
        }
        assert.deepEqual(await metrics(canvas), fixedMetrics,
          axis + ' focus changed canvas size/viewport or lost its WebGL context');
        assert.equal(Number(await page.locator('[data-testid=status]')
          .getAttribute('data-render-revision')), fixedRevision,
        axis + ' focus must not reconstruct the chart');

        await page.locator('#clear-focus').click();
        await selected(page, 'None');
        const cleared = await pixels(canvas, page);
        const remaining = changedChannels(baseline, cleared);
        assert.ok(remaining <= Math.max(256, noise * 4),
          axis + ' focus did not restore the original canvas (' + remaining +
          ' changed channels)');
        previousFocus = focused;
      }
      assert.deepEqual(pageErrors, [], 'Unexpected browser errors');
    } finally {
      await page.close();
      await browser.close();
    }
  });
