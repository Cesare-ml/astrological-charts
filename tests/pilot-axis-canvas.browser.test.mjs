import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium, firefox } from 'playwright-core';
import sharp from 'sharp';

// Standalone read-only browser regression for issue #25. Run with the
// existing local Angular demo (:4200) and approved/synthetic assets (:4177).
// This test intentionally does not patch the renderer, demo or scene.
const browserName = process.env.CHART_TEST_BROWSER || 'chromium';
assert.ok(['chromium', 'firefox'].includes(browserName));
const candidates = browserName === 'firefox'
  ? [process.env.FIREFOX_PATH, firefox.executablePath()].filter(Boolean)
  : [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
const executablePath = candidates.find(existsSync);

async function ready(page, before = -1) {
  await page.waitForFunction(previous => {
    const status = document.querySelector('[data-testid=status]');
    const count = Number(status?.getAttribute('data-render-revision'));
    return status?.textContent?.includes('Rendered')
      && !document.querySelector('#mode')?.disabled
      && Number.isSafeInteger(count) && count > previous;
  }, before, { timeout: 30000 });
}

async function selected(page, expected) {
  await page.waitForFunction(value =>
    document.querySelector('[data-testid=planet-selection]')?.textContent?.trim() === value,
    expected, { timeout: 10000 });
}

async function chartSnapshot(page) {
  // Screenshot the CANVAS alone; sidebar changes cannot create a false pass.
  const png = await page.locator('[data-testid=chart]').screenshot();
  const { data, info } = await sharp(png).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  assert.ok(info.width > 100 && info.height > 100, 'Chart canvas is too small');
  const state = await page.evaluate(() => {
    const canvas = document.querySelector('[data-testid=chart]');
    const bounds = canvas.getBoundingClientRect();
    const gl = canvas.getContext('webgl2');
    let camera = null;
    let sceneId = null;
    // In Angular dev mode the debug API may expose the service. It is
    // optional: this smoke test still asserts browser-visible invariants
    // if a production-mode build does not expose Angular internals.
    try {
      const host = document.querySelector('chart-demo');
      const component = globalThis.ng?.getComponent?.(host);
      const service = component?.renderer;
      if (service?.camera && service?.scene) {
        camera = {
          uuid: service.camera.uuid,
          zoom: service.camera.zoom,
          position: service.camera.position.toArray(),
          quaternion: service.camera.quaternion.toArray(),
          projection: service.camera.projectionMatrix.elements.slice(),
        };
        sceneId = service.scene.uuid;
      }
    } catch {
      // Angular debug metadata is not part of the supported public API.
    }
    return {
      canvasWidth: canvas.width, canvasHeight: canvas.height,
      clientWidth: bounds.width, clientHeight: bounds.height,
      drawingBuffer: gl ? [gl.drawingBufferWidth, gl.drawingBufferHeight] : null,
      renderRevision: Number(document.querySelector('[data-testid=status]')
        ?.getAttribute('data-render-revision')),
      camera, sceneId,
    };
  });
  return { data, info, state };
}

function pixelDifference(before, after) {
  assert.equal(before.info.width, after.info.width, 'Screenshot width changed');
  assert.equal(before.info.height, after.info.height, 'Screenshot height changed');
  assert.equal(before.info.channels, after.info.channels, 'Pixel channels changed');
  const { width, height, channels } = before.info;
  let changed = 0;
  let centralChanged = 0;
  const xMin = Math.floor(width * 0.18), xMax = Math.ceil(width * 0.82);
  const yMin = Math.floor(height * 0.18), yMax = Math.ceil(height * 0.82);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * channels;
      let different = false;
      for (let c = 0; c < Math.min(3, channels); c++) {
        if (Math.abs(before.data[index + c] - after.data[index + c]) > 12) {
          different = true;
          break;
        }
      }
      if (different) {
        changed++;
        if (x >= xMin && x < xMax && y >= yMin && y < yMax) centralChanged++;
      }
    }
  }
  return { changed, centralChanged };
}

function assertViewInvariants(before, after, context) {
  const a = before.state, b = after.state;
  for (const key of ['canvasWidth', 'canvasHeight', 'clientWidth', 'clientHeight',
    'drawingBuffer', 'renderRevision']) {
    assert.deepEqual(b[key], a[key], context + ': unexpected ' + key + ' change');
  }
  if (a.camera && b.camera && a.sceneId && b.sceneId) {
    assert.deepEqual(b.camera, a.camera, context + ': focus changed camera/zoom');
    assert.equal(b.sceneId, a.sceneId, context + ': focus rebuilt the scene');
  }
}

test('natal AS/DS/MC/IC focus changes central canvas pixels, not only sidebar text',
  { timeout: 180000 }, async () => {
    assert.ok(executablePath, 'Browser not found; set CHROME_PATH or FIREFOX_PATH');
    const browser = browserName === 'firefox'
      ? await firefox.launch({ executablePath, headless: true, firefoxUserPrefs: {
        'webgl.disabled': false, 'webgl.force-enabled': true
      }})
      : await chromium.launch({ executablePath, headless: true,
        args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto('http://127.0.0.1:4200/', { waitUntil: 'domcontentloaded' });
      await ready(page);
      const beforeMode = Number(await page.locator('[data-testid=status]')
        .getAttribute('data-render-revision'));
      await page.selectOption('#mode', 'transits');
      await ready(page, beforeMode);
      await page.waitForTimeout(450);
      assert.equal(await page.locator('#planet-layer').inputValue(), 'natal');
      assert.equal(await page.locator('#skin').inputValue(), 'light');
      assert.equal(await page.locator('[data-testid=aspect-match]').count(), 0);

      // Negative control: switching the *sidebar-only* selected layer must
      // not change the chart pixels. This prevents a DOM-only regression
      // from satisfying the visual assertions below.
      const idle = await chartSnapshot(page);
      await page.selectOption('#planet-layer', 'transit');
      await page.waitForTimeout(140);
      const sidebarOnly = await chartSnapshot(page);
      assertViewInvariants(idle, sidebarOnly, 'sidebar-only layer switch');
      const ambient = pixelDifference(idle, sidebarOnly);
      assert.ok(ambient.changed <= 40 && ambient.centralChanged <= 20,
        'Canvas is unstable without visual focus: ' + JSON.stringify(ambient));
      await page.selectOption('#planet-layer', 'natal');

      for (const [axis, partner] of [
        ['AS', 'Neptune'], ['DS', 'Mars'], ['MC', 'Neptune'], ['IC', 'Mercury']
      ]) {
        assert.equal(await page.locator('[data-testid=planet-selection]').textContent(), 'None');
        const neutral = await chartSnapshot(page);
        await page.getByRole('button', { name: 'Highlight natal ' + axis }).click();
        await selected(page, 'natal:' + axis);
        await page.waitForFunction(() =>
          document.querySelectorAll('[data-testid=aspect-match]').length === 1,
          null, { timeout: 10000 });
        const description = await page.locator('.aspect-list').textContent();
        assert.ok(description.includes('natal ' + axis), axis + ': missing source');
        assert.ok(description.includes('transit ' + partner), axis + ': missing partner');
        await page.waitForTimeout(160); // allow WebGL requestAnimationFrame to paint
        const focused = await chartSnapshot(page);
        assertViewInvariants(neutral, focused, axis + ' focus');
        const visual = pixelDifference(neutral, focused);
        assert.ok(visual.changed > Math.max(40, ambient.changed * 3),
          axis + ': selection updated the sidebar but not the canvas: '
            + JSON.stringify(visual));
        assert.ok(visual.centralChanged > Math.max(12, ambient.centralChanged * 3),
          axis + ': no change within central aspect area: '
            + JSON.stringify(visual));

        // An axis glyph can be tinted even when no aspect line is painted.
        // The demo's hard-only filter removes all supplied semisquare links,
        // but deliberately retains the same selected natal axis. The central
        // chart MUST change for the link itself, not just the sidebar label.
        await page.selectOption('#aspect-filter', 'hard');
        await page.waitForFunction(() =>
          document.querySelectorAll('[data-testid=aspect-match]').length === 0,
          null, { timeout: 10000 });
        await selected(page, 'natal:' + axis);
        await page.waitForTimeout(160);
        const filtered = await chartSnapshot(page);
        assertViewInvariants(focused, filtered, axis + ' filtered focus');
        const removedAspect = pixelDifference(focused, filtered);
        assert.ok(removedAspect.centralChanged > Math.max(12, ambient.centralChanged * 3),
          axis + ': hard-only aspect filter changed text but not the central canvas: '
            + JSON.stringify(removedAspect));

        // Re-adding precisely the same supplied link should restore the
        // previous focus image without a resize or an unexpected zoom.
        await page.selectOption('#aspect-filter', 'all');
        await page.waitForFunction(() =>
          document.querySelectorAll('[data-testid=aspect-match]').length === 1,
          null, { timeout: 10000 });
        await selected(page, 'natal:' + axis);
        await page.waitForTimeout(160);
        const restoredAspect = await chartSnapshot(page);
        assertViewInvariants(focused, restoredAspect, axis + ' restored aspect');
        const filterRemainder = pixelDifference(focused, restoredAspect);
        assert.ok(filterRemainder.changed <= Math.max(200, ambient.changed * 4),
          axis + ': restoring the aspect filter did not restore the canvas: '
            + JSON.stringify(filterRemainder));

        await page.locator('#clear-focus').click();
        await selected(page, 'None');
        await page.waitForTimeout(160);
        const cleared = await chartSnapshot(page);
        assertViewInvariants(neutral, cleared, axis + ' clear');
        const remainder = pixelDifference(neutral, cleared);
        assert.ok(remainder.changed <= Math.max(200, ambient.changed * 4),
          axis + ': canvas focus did not restore after clearing: '
            + JSON.stringify(remainder));
        console.log(axis + ' canvas change=' + visual.changed
          + ' center=' + visual.centralChanged + ' restore=' + remainder.changed);
      }

      assert.deepEqual(errors, [], 'Browser errors during axis canvas regression');
      console.log('Angular dev camera inspection: '
        + (idle.state.camera ? 'available (identity/zoom/projection checked)'
          : 'unavailable (canvas dimensions and render revision checked)'));
      console.log('Scope: browser pixels and optional debug camera/scene invariants; '
        + 'direct Three.js raycast/picking and original-artwork parity remain untested.');
    } finally {
      await page.close();
      await browser.close();
    }
  });
