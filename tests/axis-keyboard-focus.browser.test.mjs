import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium, firefox } from 'playwright-core';

// Stacked on interactive PR #22. Keyboard controls are part of the host demo;
// this test intentionally leaves the WebGL renderer and original assets alone.
const browserName = process.env.CHART_TEST_BROWSER || 'chromium';
assert.ok(['chromium', 'firefox'].includes(browserName), 'Use chromium or firefox');
const candidates = browserName === 'firefox'
  ? [process.env.FIREFOX_PATH, firefox.executablePath()]
  : [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
const executablePath = candidates.filter(Boolean).find(existsSync);

async function ready(page, previousRevision = -1) {
  await page.waitForFunction(before => {
    const status = document.querySelector('[data-testid=status]');
    const revision = Number(status?.getAttribute('data-render-revision'));
    return status?.textContent?.includes('Rendered') &&
      !document.querySelector('#mode')?.disabled &&
      Number.isSafeInteger(revision) && revision > before;
  }, previousRevision, { timeout: 30000 });
}

async function selected(page, expected) {
  await page.waitForFunction(value =>
    document.querySelector('[data-testid=planet-selection]')?.textContent?.trim() === value,
    expected, { timeout: 10000 });
}

async function viewState(page) {
  const state = await page.evaluate(() => {
    const canvas = document.querySelector('[data-testid=chart]');
    const host = document.querySelector('chart-demo');
    const service = globalThis.ng?.getComponent?.(host)?.renderer;
    const camera = service?.camera;
    const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
    return {
      cameraId: camera?.uuid ?? null,
      sceneId: service?.scene?.uuid ?? null,
      zoom: camera?.zoom ?? null,
      position: camera?.position?.toArray() ?? null,
      quaternion: camera?.quaternion?.toArray() ?? null,
      projection: camera?.projectionMatrix?.elements?.slice() ?? null,
      canvasSize: canvas ? [canvas.width, canvas.height] : null,
      drawingBuffer: gl ? [gl.drawingBufferWidth, gl.drawingBufferHeight] : null,
      hasWebGL: !!gl && !gl.isContextLost(),
      revision: Number(document.querySelector('[data-testid=status]')
        ?.getAttribute('data-render-revision')),
    };
  });
  // Fail closed if the Angular DEV camera cannot be inspected. A static
  // canvas size alone would not prove that keyboard focus preserves zoom.
  assert.ok(state.hasWebGL, 'A live WebGL canvas is required');
  assert.ok(state.cameraId && state.sceneId, 'Angular DEV camera/scene not exposed');
  assert.ok(Number.isFinite(state.zoom) && state.zoom > 0, 'Camera zoom invalid');
  for (const [field, length] of [['position', 3], ['quaternion', 4], ['projection', 16]]) {
    assert.ok(Array.isArray(state[field]) && state[field].length === length &&
      state[field].every(Number.isFinite), `Invalid camera ${field}`);
  }
  assert.ok(state.canvasSize?.every(size => size > 0), 'Canvas has no pixels');
  assert.ok(state.drawingBuffer?.every(size => size > 0), 'Drawing buffer unavailable');
  assert.ok(Number.isSafeInteger(state.revision), 'Render revision missing');
  return state;
}

test('keyboard Enter/Space selects all four natal axes without camera or zoom changes',
  { timeout: 120000 }, async () => {
    assert.ok(executablePath, `Browser ${browserName} unavailable; set CHROME_PATH/FIREFOX_PATH`);
    const browser = browserName === 'firefox'
      ? await firefox.launch({ executablePath, headless: true,
        firefoxUserPrefs: { 'webgl.disabled': false, 'webgl.force-enabled': true } })
      : await chromium.launch({ executablePath, headless: true,
        args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto('http://127.0.0.1:4200/', { waitUntil: 'domcontentloaded' });
      await ready(page);
      const beforeMode = await viewState(page);
      await page.selectOption('#mode', 'transits');
      await ready(page, beforeMode.revision);
      await page.getByRole('button', { name: 'Zoom in' }).click();
      await page.waitForFunction(() =>
        globalThis.ng?.getComponent?.(document.querySelector('chart-demo'))
          ?.renderer?.camera?.zoom > 1);
      const baseline = await viewState(page);
      assert.ok(baseline.zoom > 1, 'Zoom-in setup must differ from default zoom');

      for (const [index, axis, partner] of [
        [0, 'AS', 'Neptune'], [1, 'DS', 'Mars'],
        [2, 'MC', 'Neptune'], [3, 'IC', 'Mercury']
      ]) {
        const button = page.getByRole('button', { name: `Highlight natal ${axis}` });
        // Verify real Tab navigation between the four consecutive native
        // axis buttons, not merely scripted button.focus() for every axis.
        if (index === 0) await button.focus();
        else await page.keyboard.press('Tab');
        assert.equal(await button.evaluate(element => document.activeElement === element), true,
          `${axis}: keyboard Tab order did not reach the next axis button`);
        assert.equal(await button.getAttribute('aria-pressed'), 'false',
          `${axis}: old selection was not cleared`);
        await page.keyboard.press(index % 2 === 0 ? 'Enter' : 'Space');
        await selected(page, `natal:${axis}`);
        assert.equal(await button.getAttribute('aria-pressed'), 'true',
          `${axis}: accessible pressed state missing`);
        assert.equal(await button.evaluate(element => document.activeElement === element), true,
          `${axis}: keyboard focus moved unexpectedly`);
        assert.equal(await page.locator('[data-testid=aspect-match]').count(), 1,
          `${axis}: illustrative relationship missing`);
        assert.match(await page.locator('.aspect-list').textContent(),
          new RegExp(`transit ${partner}`));
        assert.deepEqual(await viewState(page), baseline,
          `${axis}: selecting from keyboard changed camera, scene, zoom or canvas`);
      }

      const clear = page.getByRole('button', { name: 'Clear selection' });
      await clear.focus();
      await page.keyboard.press('Enter');
      await selected(page, 'None');
      assert.equal(await page.locator('[aria-pressed="true"]').count(), 0);
      assert.deepEqual(await viewState(page), baseline,
        'Keyboard clear changed camera, scene, zoom or canvas');

      // Same axis name in a different chart layer must never inherit the
      // natal aspect, even when the user switches layers from the keyboard.
      const layer = page.locator('#planet-layer');
      await layer.focus();
      await page.keyboard.press('ArrowDown');
      await page.waitForFunction(() =>
        document.querySelector('#planet-layer')?.value === 'transit' &&
        !!document.querySelector('[aria-label="Highlight transit AS"]'));
      const transitAxis = page.getByRole('button', { name: 'Highlight transit AS' });
      await transitAxis.focus();
      await page.keyboard.press('Space');
      await selected(page, 'transit:AS');
      assert.equal(await transitAxis.getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('[data-testid=aspect-match]').count(), 0,
        'Transit AS incorrectly inherited natal AS illustrative relations');
      assert.deepEqual(await viewState(page), baseline,
        'Switching keyboard selection to transit AS changed camera or zoom');

      await layer.focus();
      await page.keyboard.press('ArrowUp');
      await page.waitForFunction(() =>
        document.querySelector('#planet-layer')?.value === 'natal' &&
        !!document.querySelector('[aria-label="Highlight natal AS"]'));
      const natalAxis = page.getByRole('button', { name: 'Highlight natal AS' });
      assert.equal(await natalAxis.getAttribute('aria-pressed'), 'false',
        'Transit AS selection must not mark natal AS pressed');
      await natalAxis.focus();
      await page.keyboard.press('Enter');
      await selected(page, 'natal:AS');
      assert.equal(await page.locator('[data-testid=aspect-match]').count(), 1,
        'Returning to natal AS must recover its supplied aspect');
      assert.deepEqual(await viewState(page), baseline,
        'Switching keyboard selection back to natal AS changed camera or zoom');
      assert.deepEqual(errors, [], 'Unexpected browser exceptions');
    } finally {
      await page.close();
      await browser.close();
    }
  });
