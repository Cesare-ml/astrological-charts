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
/** Angular zoneless change detection completes asynchronously after click/select.
 * The harness must wait for DOM state, not read it in the same microtask.
 * A changed chart/skin also requires a *new completed render revision*.
 */
async function ready(page, previousRevision = -1) {
  await page.waitForFunction(before => {
    const status = document.querySelector('[data-testid=status]');
    const revision = Number(status?.getAttribute('data-render-revision'));
    return (status?.textContent || '').includes('Rendered')
      && !document.querySelector('#mode')?.disabled
      && Number.isSafeInteger(revision) && revision > before;
  }, previousRevision, {timeout: 30000});
}
async function revision(page) {
  return Number(await page.locator('[data-testid=status]')
    .getAttribute('data-render-revision'));
}
async function selection(page, expected) {
  await page.waitForFunction(value =>
    document.querySelector('[data-testid=planet-selection]')?.textContent?.trim() === value,
    expected, {timeout: 10000});
}
async function aspectCount(page, expected) {
  await page.waitForFunction(value =>
    document.querySelectorAll('[data-testid=aspect-match]').length === value,
    expected, {timeout: 10000});
}

test('demo frontend focuses natal and transit planets in both directions', {timeout: 90000}, async () => {
  const browser = await launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto('http://127.0.0.1:4200/');
    await ready(page);
    const beforeTransits = await revision(page);
    await page.selectOption('#mode', 'transits');
    await ready(page, beforeTransits);
    await page.selectOption('#planet-layer', 'transit');
    await page.getByRole('button', {name: 'Highlight transit Saturn'}).click();
    await selection(page, 'transit:Saturn');
    await aspectCount(page, 2);
    assert.match(await page.locator('.aspect-list').textContent(), /natal Uranus/);
    assert.match(await page.locator('.aspect-list').textContent(), /natal Venus/);
    const screenshots = '.local/demo-interaction-focus';
    mkdirSync(screenshots,{recursive:true});
    await page.waitForTimeout(100);
    await page.locator('[data-testid=chart]').screenshot({
      path:join(screenshots,'transit-saturn-light.png')
    });
    await page.selectOption('#aspect-filter', 'hard');
    await aspectCount(page, 1);
    assert.match(await page.locator('.aspect-list').textContent(), /opposizione/);
    await page.selectOption('#aspect-filter', 'all');
    await aspectCount(page, 2);

    await page.selectOption('#planet-layer', 'natal');
    await page.getByRole('button', {name: 'Highlight natal Uranus'}).click();
    await selection(page, 'natal:Uranus');
    await aspectCount(page, 2);
    assert.match(await page.locator('.aspect-list').textContent(), /transit Saturn/);
    assert.match(await page.locator('.aspect-list').textContent(), /transit Sun/);
    await page.waitForTimeout(100);
    await page.locator('[data-testid=chart]').screenshot({
      path:join(screenshots,'natal-uranus-with-transits-light.png')
    });

    const beforeDark = await revision(page);
    await page.selectOption('#skin', 'dark');
    await ready(page, beforeDark);
    await selection(page, 'natal:Uranus');
    await page.locator('[data-testid=chart]').screenshot({
      path:join(screenshots,'natal-uranus-transits-dark.png')
    });
    await page.locator('#clear-focus').click();
    await selection(page, 'None');
    await aspectCount(page, 0);

    const beforeNatal = await revision(page);
    await page.selectOption('#mode', 'natal');
    await ready(page, beforeNatal);
    await selection(page, 'None');
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
    await selection(page, 'natal:Sun');
    const screenshots = '.local/demo-interaction-focus';
    mkdirSync(screenshots,{recursive:true});
    await page.waitForTimeout(100);
    await page.locator('[data-testid=chart]').screenshot({
      path:join(screenshots,'natal-sun-focus-light.png')
    });
    await page.getByRole('button', {name:'Highlight natal Moon'}).click();
    await selection(page, 'natal:Moon');
    await toggle.uncheck();
    await selection(page, 'natal:Moon');
    await page.waitForTimeout(100);
    await page.locator('[data-testid=chart]').screenshot({
      path:join(screenshots,'natal-all-aspects-light.png')
    });
    const beforeTransits = await revision(page);
    await page.selectOption('#mode', 'transits');
    await ready(page, beforeTransits);
    await page.waitForFunction(() => !document.querySelector('#focus-aspects'));
    const beforeNatal = await revision(page);
    await page.selectOption('#mode', 'natal');
    await ready(page, beforeNatal);
    await page.waitForFunction(() => document.querySelector('#focus-aspects') !== null);
    assert.equal(await toggle.isChecked(), false);
    await selection(page, 'None');
  } finally { await page.close(); await browser.close(); }
});

test('all four natal angles show their supplied transit relationships without zooming', {timeout: 90000}, async () => {
  const browser = await launch();
  const page = await browser.newPage();
  try {
    await page.goto('http://127.0.0.1:4200/');
    await ready(page);
    const screenshots = '.local/demo-interaction-focus';
    mkdirSync(screenshots,{recursive:true});
    const lastRevision = await revision(page);
    await page.selectOption('#mode','transits');
    await ready(page,lastRevision);
    for (const [axis,partner] of [
      ['AS','Neptune'], ['DS','Mars'], ['MC','Neptune'], ['IC','Mercury']
    ]) {
      await page.getByRole('button',{name:'Highlight natal '+axis}).click();
      await selection(page,'natal:'+axis);
      await aspectCount(page,1);
      const description = await page.locator('.aspect-list').textContent();
      assert.match(description, new RegExp('natal '+axis));
      assert.match(description, new RegExp('transit '+partner));
      assert.match(description, /semiquadrato/);
      if (axis === 'MC') {
        await page.locator('[data-testid=chart]').screenshot({
          path:join(screenshots,'natal-mc-transit-aspects-light.png')
        });
      }
    }
    // Reverse direction: selecting the transit Mercury also exposes
    // its relationship to the natal IC (along with its Pluto link).
    await page.selectOption('#planet-layer','transit');
    await page.getByRole('button',{name:'Highlight transit Mercury'}).click();
    await selection(page,'transit:Mercury');
    await aspectCount(page,2);
    assert.match(await page.locator('.aspect-list').textContent(), /natal IC/);
    const before = await revision(page);
    await page.selectOption('#mode','natal');
    await ready(page,before);
    await page.locator('#focus-aspects').check();
    await selection(page,'natal:Sun');
    await page.getByRole('button',{name:'Highlight natal AS'}).click();
    await selection(page,'natal:AS');
    await page.locator('[data-testid=chart]').screenshot({
      path:join(screenshots,'natal-as-focused-light.png')
    });
    // AS/DS/MC/IC come from the actual house axis coordinates;
    // no fabricated angles/aspects are created by the renderer.
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

test('native Line2 solid/dashed/dotted strokes keep exact colored focus above gray', {timeout: 60000}, async () => {
  const browser = await launch();
  const page = await browser.newPage();
  try {
    await page.goto('http://127.0.0.1:4200/');
    await ready(page);
    const bundled = await build({
      entryPoints: ['tests/fixtures/native-natal-line-harness.ts'],
      bundle: true, write: false, platform: 'browser',
      format: 'iife', target: 'es2022', tsconfig: 'tsconfig.json'
    });
    await page.addScriptTag({content: bundled.outputFiles[0].text});
    const result = await page.evaluate(() => window.runNativeNatalAspectLineProbe());
    for (const [name, passed] of Object.entries(result)) {
      assert.equal(passed, true, name + ': ' + JSON.stringify(result));
    }
  } finally { await page.close(); await browser.close(); }
});

test('transit guides use real outer-ring radius in normal and mirrored charts', {timeout: 60000}, async () => {
  const browser = await launch();
  const page = await browser.newPage();
  try {
    await page.goto('http://127.0.0.1:4200/');
    await ready(page);
    const bundled = await build({
      entryPoints: ['tests/fixtures/transit-spoke-harness.ts'],
      bundle: true, write: false, platform: 'browser',
      format: 'iife', target: 'es2022', tsconfig: 'tsconfig.json'
    });
    await page.addScriptTag({content:bundled.outputFiles[0].text});
    const result = await page.evaluate(() => window.runTransitSpokeGeometryProbe());
    for (const [name, passed] of Object.entries(result)) {
      assert.equal(passed, true, name + ': ' + JSON.stringify(result));
    }
  } finally { await page.close(); await browser.close(); }
});

test('Angular enter-to-pin handoff renders once and restores deferred button focus', {timeout:60000}, async () => {
  const browser = await launch();
  const page = await browser.newPage();
  try {
    await page.goto('http://127.0.0.1:4200/');
    await ready(page);
    const bundle = await build({
      entryPoints:['tests/fixtures/hover-pin-handoff-harness.ts'],
      bundle:true, write:false, platform:'browser',
      format:'iife',target:'es2022',tsconfig:'tsconfig.json'
    });
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    const result = await page.evaluate(() => window.runHoverPinHandoffProbe());
    for (const [name, passed] of Object.entries(result)) {
      if (typeof passed === 'boolean') {
        assert.equal(passed,true,name+': '+JSON.stringify(result));
      }
    }
  } finally { await page.close(); await browser.close(); }
});

test('30 repeated hover cycles over a pinned planet do not rebuild WebGL overlays', {timeout: 60000}, async () => {
  const browser = await launch();
  const page = await browser.newPage();
  try {
    await page.goto('http://127.0.0.1:4200/');
    await ready(page);
    const bundle = await build({
      entryPoints:['tests/fixtures/pinned-pointer-idempotence-harness.ts'],
      bundle:true, write:false, platform:'browser',format:'iife',
      target:'es2022',tsconfig:'tsconfig.json'
    });
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    const result = await page.evaluate(() => window.runPinnedPointerIdempotenceProbe());
    for (const [name, passed] of Object.entries(result)) {
      if (typeof passed === 'boolean') {
        assert.equal(passed, true, name + ': ' + JSON.stringify(result));
      }
    }
    assert.equal(result.eventCount,102,JSON.stringify(result));
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
    assert.equal(result.pinnedRefreshAfterLeave, true, JSON.stringify(result));
    assert.equal(result.unchangedPinnedNoRefresh, true, JSON.stringify(result));
    assert.equal(result.transitPinRestored, true, JSON.stringify(result));
    assert.equal(result.destroyedRestoredScale, true, JSON.stringify(result));
    assert.equal(result.removedListeners, true, JSON.stringify(result));
    assert.equal(result.touchHoverCleared, true, JSON.stringify(result));
    assert.equal(result.touchClickEmitted, true, JSON.stringify(result));
    assert.equal(result.cancelClearsHover, true, JSON.stringify(result));
    assert.deepEqual(result.events.map(e => e.type), [
      'enter', 'update', 'click', 'leave', 'enter', 'leave',
      'update', 'enter', 'leave', 'click', 'enter', 'leave'
    ]);
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
      'initialEventIsolation', 'continuedEventIsolation', 'isolatedEvents',
      'independentAspectTypes', 'isolatedVisuals',
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

test('synchronous scene replacement during hover leave never enters a stale planet', {timeout: 60000}, async () => {
  const browser = await launch();
  const page = await browser.newPage();
  try {
    await page.goto('http://127.0.0.1:4200/');
    await ready(page);
    const bundled = await build({
      entryPoints: ['tests/fixtures/planet-scene-switch-harness.ts'],
      bundle:true, write:false, platform:'browser', format:'iife',
      target:'es2022', tsconfig:'tsconfig.json'
    });
    await page.addScriptTag({content:bundled.outputFiles[0].text});
    const result = await page.evaluate(() => window.runPlanetSceneSwitchProbe());
    for (const [check, value] of Object.entries(result)) {
      assert.equal(value, true, check + ': ' + JSON.stringify(result));
    }
  } finally { await page.close(); await browser.close(); }
});

test('reentrant leave and update callbacks cannot request renders of retired scenes', {timeout: 60000}, async () => {
  const browser = await launch();
  const page = await browser.newPage();
  try {
    await page.goto('http://127.0.0.1:4200/');
    await ready(page);
    const bundled = await build({entryPoints: ['tests/fixtures/planet-reentrant-render-harness.ts'],
      bundle:true,write:false,platform:'browser',format:'iife',target:'es2022',tsconfig:'tsconfig.json'});
    await page.addScriptTag({content:bundled.outputFiles[0].text});
    const result = await page.evaluate(() => window.runPlanetReentrantRenderProbe());
    for (const [name, passes] of Object.entries(result)) {
      assert.equal(passes, true, name + ': ' + JSON.stringify(result));
    }
  } finally { await page.close(); await browser.close(); }
});

test('real WebGL memory stays bounded across 90 aspect updates and 20 scene redraws', {timeout: 90000}, async () => {
  const browser = await launch();
  const page = await browser.newPage();
  try {
    await page.goto('http://127.0.0.1:4200/');
    await ready(page);
    const bundled = await build({
      entryPoints:['tests/fixtures/planet-gpu-lifecycle-harness.ts'],
      bundle:true,write:false,platform:'browser',format:'iife',
      target:'es2022',tsconfig:'tsconfig.json'
    });
    await page.addScriptTag({content:bundled.outputFiles[0].text});
    const result = await page.evaluate(() => window.runPlanetGpuLifecycleProbe());
    assert.equal(result.refreshCount, 90);
    assert.equal(result.redrawCount, 20);
    for (const name of [
      'activeOverlayRendered','stableGpuGeometries','stableTextures',
      'stablePrograms','redrawsStable','duplicateRelationsSkipRender',
      'duplicateFocusSkipRender','orbOnlyUpdatesSkipRender',
      'orbOnlyUpdatesAvailableOnClick','orbOnlyUpdatesNotifyFrontend',
      'winnerChangeRepaintsGuide','winnerRecolorKeepsGeometry',
      'unrelatedUpdatesSkipRender',
      'unrelatedUpdatesAvailableOnSelection','focusClearReleasesOverlays',
      'teardownReleasesGpuGeometries'
    ]) {
      assert.equal(result[name], true, name + ': ' + JSON.stringify(result));
    }
  } finally { await page.close(); await browser.close(); }
});

test('native natal aspect focus keeps bounded GPU resources across 120 selections', {timeout:90000}, async () => {
  const browser = await launch();
  const page = await browser.newPage();
  try {
    await page.goto('http://127.0.0.1:4200/');
    await ready(page);
    const bundled = await build({
      entryPoints:['tests/fixtures/natal-focus-gpu-harness.ts'],
      bundle:true,write:false,platform:'browser',format:'iife',
      target:'es2022',tsconfig:'tsconfig.json'
    });
    await page.addScriptTag({content:bundled.outputFiles[0].text});
    const result = await page.evaluate(() => window.runNatalFocusGpuProbe());
    assert.equal(result.cycles,120);
    for (const name of [
      'copiesBounded','gpuGeometriesBounded','texturesStable','programsStable',
      'clonesDisposedExactlyOnce','nativeResourcesUntouched',
      'originalColorsMutedDuringFocus','originalsRestored',
      'clearedToBaseline','noGpuLeaksAfterTeardown'
    ]) assert.equal(result[name],true,name+': '+JSON.stringify(result));
  } finally { await page.close(); await browser.close(); }
});

test('Angular service batches bursty planet/zoom state into one WebGL frame', {timeout:60000}, async () => {
  const browser = await launch();
  const page = await browser.newPage();
  try {
    await page.goto('http://127.0.0.1:4200/');
    await ready(page);
    const bundle = await build({
      entryPoints:['tests/fixtures/interactive-frame-batch-harness.ts'],
      bundle:true,write:false,platform:'browser',format:'iife',
      target:'es2022',tsconfig:'tsconfig.json'
    });
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    const result = await page.evaluate(() => window.runInteractiveFrameBatchProbe());
    for (const name of [
      'coalescesFocusAspectsZoom','explicitDrawCancelsQueuedFrame',
      'destroyCancelsQueuedFrame','noDeferredFrameAfterDestroy'
    ]) assert.equal(result[name],true,name+': '+JSON.stringify(result));
    assert.equal(result.countAfterBatch,1);
    assert.equal(result.countAfterExplicit,2);
    assert.equal(result.countAfterDestroy,2);
  } finally { await page.close(); await browser.close(); }
});
