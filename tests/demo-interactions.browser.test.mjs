import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { build } from 'esbuild';

const browserName = process.env.CHART_TEST_BROWSER || 'chromium';
assert.ok(['chromium', 'firefox'].includes(browserName));
const candidates = browserName === 'firefox'
  ? [process.env.FIREFOX_PATH, firefox.executablePath()].filter(Boolean)
  : [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
const executablePath = candidates.find(existsSync);
function launch() {
  assert.ok(executablePath, `Browser ${browserName} not found`);
  return browserName === 'firefox'
    ? firefox.launch({executablePath, headless: true, firefoxUserPrefs: {
      'webgl.disabled': false, 'webgl.force-enabled': true
    }})
    : chromium.launch({executablePath, headless: true,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
}
async function ready(page) {
  await page.waitForFunction(() => {
    const status = document.querySelector('[data-testid=status]')?.textContent || '';
    return status.includes('Rendered') && !(document.querySelector('#mode')?.disabled);
  }, {timeout: 30000});
}

test('demo frontend focuses natal and transit planets in both directions', {timeout: 90000}, async () => {
  const browser = await launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto('http://127.0.0.1:4200/');
    await ready(page);
    await page.selectOption('#mode', 'transits');
    await ready(page);
    await page.selectOption('#planet-layer', 'transit');
    await page.getByRole('button', {name: 'Highlight transit Saturn'}).click();
    assert.equal(await page.locator('[data-testid=planet-selection]').textContent(), 'transit:Saturn');
    assert.equal(await page.locator('[data-testid=aspect-match]').count(), 2);
    assert.match(await page.locator('.aspect-list').textContent(), /natal Uranus/);
    assert.match(await page.locator('.aspect-list').textContent(), /natal Venus/);
    const screenshots = '.local/demo-interaction-focus';
    mkdirSync(screenshots,{recursive:true});
    await page.waitForTimeout(100);
    await page.locator('[data-testid=chart]').screenshot({
      path:join(screenshots,'transit-saturn-light.png')
    });
    await page.selectOption('#aspect-filter', 'hard');
    assert.equal(await page.locator('[data-testid=aspect-match]').count(), 1);
    assert.match(await page.locator('.aspect-list').textContent(), /opposizione/);
    await page.selectOption('#aspect-filter', 'all');
    assert.equal(await page.locator('[data-testid=aspect-match]').count(), 2);

    await page.selectOption('#planet-layer', 'natal');
    await page.getByRole('button', {name: 'Highlight natal Uranus'}).click();
    assert.equal(await page.locator('[data-testid=planet-selection]').textContent(), 'natal:Uranus');
    assert.equal(await page.locator('[data-testid=aspect-match]').count(), 2);
    assert.match(await page.locator('.aspect-list').textContent(), /transit Saturn/);
    assert.match(await page.locator('.aspect-list').textContent(), /transit Sun/);
    await page.waitForTimeout(100);
    await page.locator('[data-testid=chart]').screenshot({
      path:join(screenshots,'natal-uranus-with-transits-light.png')
    });

    await page.selectOption('#skin', 'dark');
    await ready(page);
    assert.equal(await page.locator('[data-testid=planet-selection]').textContent(), 'natal:Uranus');
    await page.locator('#clear-focus').click();
    assert.equal(await page.locator('[data-testid=planet-selection]').textContent(), 'None');
    assert.equal(await page.locator('[data-testid=aspect-match]').count(), 0);

    await page.selectOption('#mode', 'natal');
    await ready(page);
    assert.equal(await page.locator('[data-testid=planet-selection]').textContent(), 'None');
    assert.equal(await page.locator('#planet-layer option').count(), 1);
    assert.equal(await page.locator('#aspect-filter').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await page.close(); await browser.close(); }
});

test('natal focus switch selects Sun by default and preserves selected planets', {timeout: 90000}, async () => {
  const browser = await launch();
  const page = await browser.newPage();
  try {
    await page.goto('http://127.0.0.1:4200/');
    await ready(page);
    const toggle = page.locator('#focus-aspects');
    assert.equal(await toggle.isChecked(), false);
    await toggle.check();
    assert.equal(await page.locator('[data-testid=planet-selection]').textContent(), 'natal:Sun');
    const screenshots = '.local/demo-interaction-focus';
    mkdirSync(screenshots,{recursive:true});
    await page.waitForTimeout(100);
    await page.locator('[data-testid=chart]').screenshot({
      path:join(screenshots,'natal-sun-focus-light.png')
    });
    await page.getByRole('button', {name:'Highlight natal Moon'}).click();
    assert.equal(await page.locator('[data-testid=planet-selection]').textContent(), 'natal:Moon');
    await toggle.uncheck();
    assert.equal(await page.locator('[data-testid=planet-selection]').textContent(), 'natal:Moon');
    await page.waitForTimeout(100);
    await page.locator('[data-testid=chart]').screenshot({
      path:join(screenshots,'natal-all-aspects-light.png')
    });
    await page.selectOption('#mode', 'transits');
    await ready(page);
    assert.equal(await page.locator('#focus-aspects').count(), 0);
    await page.selectOption('#mode', 'natal');
    await ready(page);
    assert.equal(await toggle.isChecked(), false);
    assert.equal(await page.locator('[data-testid=planet-selection]').textContent(), 'None');
  } finally { await page.close(); await browser.close(); }
});

test('Three.js focus palette retains neutral glyphs and colors only selected linked bodies', {timeout: 60000}, async () => {
  const browser = await launch();
  const page = await browser.newPage();
  try {
    await page.goto('http://127.0.0.1:4200/');
    await ready(page);
    const bundled = await build({
      entryPoints: ['tests/fixtures/planet-focus-style-harness.ts'],
      bundle:true, write:false, platform:'browser',format:'iife',
      target:'es2022',tsconfig:'tsconfig.json'
    });
    await page.addScriptTag({content:bundled.outputFiles[0].text});
    const result = await page.evaluate(() => window.runPlanetFocusStyleProbe());
    for (const [name, pass] of Object.entries(result)) {
      assert.equal(pass, true, name + ': ' + JSON.stringify(result));
    }
  } finally { await page.close(); await browser.close(); }
});

test('Three.js pointer controller emits layer-aware events and restores pinned focus', {timeout: 60000}, async () => {
  const browser = await launch();
  const page = await browser.newPage();
  try {
    await page.goto('http://127.0.0.1:4200/');
    await ready(page);
    const bundled = await build({
      entryPoints: ['tests/fixtures/planet-pointer-harness.ts'],
      bundle: true, write: false, platform: 'browser', format: 'iife',
      target: 'es2022', tsconfig: 'tsconfig.json'
    });
    await page.addScriptTag({content: bundled.outputFiles[0].text});
    const result = await page.evaluate(() => window.runPlanetPointerProbe());
    assert.equal(result.natalHovered, true, JSON.stringify(result));
    assert.equal(result.transitHovered, true, JSON.stringify(result));
    assert.equal(result.clickEmitted, true, JSON.stringify(result));
    assert.equal(result.centralOverlay, true, JSON.stringify(result));
    assert.equal(result.centralOverlayGeometry, true, JSON.stringify(result));
    assert.equal(result.refreshedWhileHovered, true, JSON.stringify(result));
    assert.equal(result.noRefreshAfterLeave, true, JSON.stringify(result));
    assert.equal(result.transitPinRestored, true, JSON.stringify(result));
    assert.equal(result.destroyedRestoredScale, true, JSON.stringify(result));
    assert.equal(result.removedListeners, true, JSON.stringify(result));
    assert.equal(result.touchHoverCleared, true, JSON.stringify(result));
    assert.equal(result.touchClickEmitted, true, JSON.stringify(result));
    assert.equal(result.cancelClearsHover, true, JSON.stringify(result));
    assert.deepEqual(result.events.map(e => e.type), ['enter', 'update', 'click', 'leave', 'enter', 'leave']);
  } finally { await page.close(); await browser.close(); }
});

test('two canvases retain isolated events and release focused overlays after 50 redraws', {timeout: 90000}, async () => {
  const browser = await launch();
  const page = await browser.newPage();
  try {
    await page.goto('http://127.0.0.1:4200/');
    await ready(page);
    const bundled = await build({
      entryPoints: ['tests/fixtures/planet-lifecycle-harness.ts'],
      bundle: true, write: false, platform: 'browser', format: 'iife',
      target: 'es2022', tsconfig: 'tsconfig.json'
    });
    await page.addScriptTag({content: bundled.outputFiles[0].text});
    const result = await page.evaluate(() => window.runPlanetLifecycleProbe());
    assert.equal(result.cycles, 50, JSON.stringify(result));
    for (const key of [
      'isolatedEvents', 'independentAspectTypes', 'isolatedVisuals',
      'redrawRestoresScale', 'redrawReleasesOverlays', 'pinSurvivesRedraw',
      'mirrorMatchesCanonicalRing', 'listenersRemovedOnDestroy',
      'reentrantLeaveCleanup'
    ]) {
      assert.equal(result[key], true, key + ': ' + JSON.stringify(result));
    }
  } finally { await page.close(); await browser.close(); }
});

test('raycasting chooses the closest overlapping glyph and ignores outside-canvas hits', {timeout: 60000}, async () => {
  const browser = await launch();
  const page = await browser.newPage();
  try {
    await page.goto('http://127.0.0.1:4200/');
    await ready(page);
    const bundled = await build({
      entryPoints: ['tests/fixtures/planet-picking-harness.ts'],
      bundle: true, write: false, platform: 'browser', format: 'iife',
      target: 'es2022', tsconfig: 'tsconfig.json'
    });
    await page.addScriptTag({content: bundled.outputFiles[0].text});
    const result = await page.evaluate(() => window.runPlanetPickingProbe());
    for (const [check, value] of Object.entries(result)) {
      assert.equal(value, true, check + ': ' + JSON.stringify(result));
    }
  } finally { await page.close(); await browser.close(); }
});
