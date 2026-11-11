import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
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

    await page.selectOption('#planet-layer', 'natal');
    await page.getByRole('button', {name: 'Highlight natal Uranus'}).click();
    assert.equal(await page.locator('[data-testid=planet-selection]').textContent(), 'natal:Uranus');
    assert.equal(await page.locator('[data-testid=aspect-match]').count(), 2);
    assert.match(await page.locator('.aspect-list').textContent(), /transit Saturn/);
    assert.match(await page.locator('.aspect-list').textContent(), /transit Sun/);

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
    assert.deepEqual(errors, []);
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
    assert.deepEqual(result.events.map(e => e.type), ['enter', 'update', 'click', 'leave', 'enter', 'leave']);
  } finally { await page.close(); await browser.close(); }
});
