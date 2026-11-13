import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync } from 'node:fs';
import { chromium, firefox } from 'playwright-core';
import { inspectSyntheticChartPng } from '../scripts/inspect-synthetic-chart-png.mjs';

// Explicitly opt-in: real dev-mode Angular + manifest-verified local assets + WebGL.
function integerEnv(name, fallback, low, high) {
  const raw = process.env[name] ?? String(fallback);
  assert.match(raw, /^\d+$/, name + ' must be a decimal integer');
  const value = Number(raw);
  assert.ok(Number.isSafeInteger(value) && value >= low && value <= high, name + ' is out of range');
  return value;
}
const redraws = integerEnv('CHART_LIFECYCLE_REDRAWS', 50, 1, 100);
const exportsCount = integerEnv('CHART_LIFECYCLE_EXPORTS', 20, 1, 100);
const textureLimit = process.env.CHART_LIFECYCLE_MAX_TEXTURE_GROWTH === undefined
  ? null : integerEnv('CHART_LIFECYCLE_MAX_TEXTURE_GROWTH', 0, 0, 10000);
const geometryLimit = process.env.CHART_LIFECYCLE_MAX_GEOMETRY_GROWTH === undefined
  ? null : integerEnv('CHART_LIFECYCLE_MAX_GEOMETRY_GROWTH', 0, 0, 10000);
// Optional export-specific WebGL call-balance guard, independent of the active scene.
const exportHandleLimit = process.env.CHART_LIFECYCLE_MAX_EXPORT_HANDLE_GROWTH === undefined
  ? null : integerEnv('CHART_LIFECYCLE_MAX_EXPORT_HANDLE_GROWTH', 0, 0, 10000);
const browserName = process.env.CHART_TEST_BROWSER ?? 'chromium';
assert.ok(['chromium', 'firefox'].includes(browserName), 'Invalid CHART_TEST_BROWSER');
const browserType = browserName === 'firefox' ? firefox : chromium;
const executablePath = (browserName === 'firefox'
  ? [process.env.FIREFOX_PATH, firefox.executablePath()]
  : [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'])
  .filter(Boolean).find(existsSync);

function memorySnapshot() {
  const c = globalThis.ng?.getComponent?.(document.querySelector('chart-demo'));
  if (!c?.renderer?.renderer || !c?.renderer?.scene) throw new Error('Angular dev renderer missing');
  const { geometries, textures } = c.renderer.renderer.info.memory;
  if (!Number.isSafeInteger(geometries) || !Number.isSafeInteger(textures))
    throw new Error('Three.js resource counters missing');
  return { geometries, textures, contextLost: globalThis.__webglLife?.contextLost ?? -1,
    created: globalThis.__webglLife?.created ?? -1, deleted: globalThis.__webglLife?.deleted ?? -1 };
}

test('redraw, PNG and second canvas lifecycle gate', {timeout: 600000}, async () => {
  assert.ok(executablePath, 'Browser executable missing: set CHROME_PATH or FIREFOX_PATH');
  const browser = await browserType.launch(browserName === 'firefox'
    ? {executablePath, headless: true, firefoxUserPrefs: {'webgl.disabled': false, 'webgl.force-enabled': true}}
    : {executablePath, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  let page;
  const errors = [];
  try {
    page = await browser.newPage({viewport: {width: 1200, height: 1000}});
    await page.addInitScript(() => {
      const stats = {created: 0, deleted: 0, contextLost: 0, trackedLive: 0,
        repeatedDeletes: 0, untrackedDeletes: 0};
      // Weak keys prevent the benchmark from retaining texture handles for QA.
      const liveTextures = new WeakMap();
      globalThis.__webglLife = stats;
      document.addEventListener('webglcontextlost', () => stats.contextLost++, true);
      const wrapped = new WeakMap();
      const active = {created: 0, deleted: 0};
      for (const type of [globalThis.WebGLRenderingContext, globalThis.WebGL2RenderingContext]) {
        if (!type) continue;
        for (const [method, field] of [['createTexture', 'created'], ['deleteTexture', 'deleted']]) {
          let proto = type.prototype;
          // WebGL1/WebGL2 may inherit both methods from a shared WebGL base prototype.
          while (proto && proto !== Object.prototype &&
                 !Object.prototype.hasOwnProperty.call(proto, method)) {
            proto = Object.getPrototypeOf(proto);
          }
          if (!proto || proto === Object.prototype) continue;
          const descriptor = Object.getOwnPropertyDescriptor(proto, method);
          if (!descriptor || typeof descriptor.value !== 'function') continue;
          let patched = wrapped.get(proto);
          if (!patched) { patched = new Set(); wrapped.set(proto, patched); }
          if (patched.has(method)) continue;
          const original = descriptor.value;
          Object.defineProperty(proto, method, {...descriptor, value: function(...args) {
            // Avoid counting an override and a super call as two texture operations.
            const outermost = active[field]++ === 0;
            try {
              const result = original.apply(this, args);
              if (outermost && field === 'created' && result) {
                stats.created++;
                if (!liveTextures.has(result)) {
                  liveTextures.set(result, true);
                  stats.trackedLive++;
                }
              } else if (outermost && field === 'deleted' && args[0]) {
                stats.deleted++;
                const texture = args[0];
                if (liveTextures.get(texture) === true) {
                  liveTextures.set(texture, false);
                  stats.trackedLive--;
                } else if (liveTextures.has(texture)) {
                  stats.repeatedDeletes++;
                } else {
                  stats.untrackedDeletes++;
                }
              }
              return result;
            } finally { active[field]--; }
          }});
          patched.add(method);
        }
      }
    });
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.status() >= 400) errors.push(String(response.status()) + ' ' + response.url());
    });
    await page.goto('http://127.0.0.1:4200/', {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => {
      const c = globalThis.ng?.getComponent?.(document.querySelector('chart-demo'));
      return Boolean(c?.renderer?.renderer && !c.busy && c.status?.startsWith('Rendered'));
    }, {timeout: 30000});
    await page.evaluate(() => {
      const c = globalThis.ng.getComponent(document.querySelector('chart-demo'));
      globalThis.__webglLifeMain = {renderer: c.renderer.renderer, scene: c.renderer.scene, camera: c.renderer.camera};
    });

    // Establish like-for-like baseline after warmup, always using natal/light.
    for (const skin of ['dark', 'light', 'dark', 'light']) {
      await page.evaluate(async name => {
        const c = globalThis.ng.getComponent(document.querySelector('chart-demo'));
        c.skin = name;
        await c.draw();
        if (c.error || !c.status.startsWith('Rendered')) throw Error(c.error || c.status);
      }, skin);
    }
    const baseline = await page.evaluate(memorySnapshot);
    const redrawSamples = [];
    for (let i = 0; i < redraws; i++) {
      const point = await page.evaluate(async skin => {
        const c = globalThis.ng.getComponent(document.querySelector('chart-demo'));
        c.skin = skin;
        await c.draw();
        if (c.error || !c.status.startsWith('Rendered')) throw Error(c.error || c.status);
        return {...c.renderer.renderer.info.memory};
      }, i % 2 === 0 ? 'dark' : 'light');
      if ((i + 1) % 10 === 0 || i + 1 === redraws) redrawSamples.push({cycle: i + 1, ...point});
    }
    await page.evaluate(async () => {
      const c = globalThis.ng.getComponent(document.querySelector('chart-demo'));
      c.skin = 'light';
      await c.draw();
      if (c.error) throw Error(c.error);
    });
    const afterRedraw = await page.evaluate(memorySnapshot);
    const modes = ['natal', 'transits', 'synastry', 'latitude'];
    const exportSamples = [];
    const exportVisualSamples = [];
    // This measures API call balance across all WebGL contexts, including PNG's
    // temporary renderer. Three.js memory counters on the active scene miss it.
    const exportCallBaseline = await page.evaluate(() => ({...globalThis.__webglLife}));
    const baselineHandleBalance = exportCallBaseline.created - exportCallBaseline.deleted;
    let peakExportHandleGrowth = 0;
    let peakTrackedLiveGrowth = 0;
    for (let i = 0; i < exportsCount; i++) {
      const mode = modes[i % modes.length];
      const result = await page.evaluate(async ({target, samplePixels}) => {
        const c = globalThis.ng.getComponent(document.querySelector('chart-demo'));
        const before = {...c.renderer.renderer.info.memory};
        const beforeCalls = {...globalThis.__webglLife};
        const opts = c.options();
        opts.mostraTransiti = target === 'transits';
        opts.mostraSinastria = target === 'synastry';
        const png = await c.renderer.generaImmagine(c.radix,
          target === 'transits' ? c.transit : null,
          target === 'synastry' ? c.synastry : null,
          target === 'latitude' ? 'latitudini' : 'carta-astrale',
          opts, {x: 800, y: 800}, 2);
        if (!png.startsWith('data:image/png;base64,')) throw Error('Not a PNG data URI');
        const comma = png.indexOf(',');
        const header = Uint8Array.from(atob(png.slice(comma + 1, comma + 41)),
          ch => ch.charCodeAt(0));
        const view = new DataView(header.buffer);
        const after = c.renderer.renderer.info.memory;
        const afterCalls = {...globalThis.__webglLife};
        return {width: view.getUint32(16), height: view.getUint32(20), length: png.length,
          samplePng: samplePixels ? png : null,
          webglCreatedDelta: afterCalls.created - beforeCalls.created,
          webglDeletedDelta: afterCalls.deleted - beforeCalls.deleted,
          outstandingHandles: afterCalls.created - afterCalls.deleted,
          trackedLiveBefore: beforeCalls.trackedLive,
          trackedLiveAfter: afterCalls.trackedLive,
          beforeTextures: before.textures, afterTextures: after.textures,
          beforeGeometries: before.geometries, afterGeometries: after.geometries,
          sameRenderer: c.renderer.renderer === globalThis.__webglLifeMain.renderer,
          sameScene: c.renderer.scene === globalThis.__webglLifeMain.scene,
          sameCamera: c.renderer.camera === globalThis.__webglLifeMain.camera};
      }, {target: mode, samplePixels: i < modes.length});
      // Decode the first export of each chart mode with sharp. PNG dimensions
      // and base64 length alone can accept a completely blank output.
      if (result.samplePng) {
        const visible = await inspectSyntheticChartPng(result.samplePng, {width: 1600, height: 1600});
        exportVisualSamples.push({mode, ...visible});
      }
      delete result.samplePng;
      assert.equal(result.width, 1600, mode + ' PNG width');
      assert.equal(result.height, 1600, mode + ' PNG height');
      assert.ok(result.length > 1000, mode + ' PNG is blank or truncated');
      assert.ok(result.sameRenderer && result.sameScene && result.sameCamera,
        mode + ' export replaced active renderer/scene/camera');
      assert.equal(result.afterTextures, result.beforeTextures, mode + ' altered active textures');
      assert.equal(result.afterGeometries, result.beforeGeometries, mode + ' altered active geometries');
      // An offscreen PNG must create and release some WebGL textures even though
      // the primary renderer remains stable. Other GL resource classes are not tracked here.
      assert.ok(result.webglCreatedDelta > 0, mode + ' did not create any WebGL texture');
      assert.ok(result.webglDeletedDelta > 0, mode + ' did not delete any WebGL texture');
      assert.ok(Number.isSafeInteger(result.outstandingHandles), mode + ' invalid WebGL call balance');
      const exportHandleGrowth = result.outstandingHandles - baselineHandleBalance;
      peakExportHandleGrowth = Math.max(peakExportHandleGrowth, exportHandleGrowth);
      // Unlike create-minus-delete calls, trackedLive ignores duplicate deletes
      // and unknown handles; it remains API-derived, not a GPU memory metric.
      const trackedLiveGrowth = result.trackedLiveAfter - exportCallBaseline.trackedLive;
      peakTrackedLiveGrowth = Math.max(peakTrackedLiveGrowth, trackedLiveGrowth);
      assert.ok(result.trackedLiveAfter >= 0, mode + ' invalid tracked-live count');
      if (exportHandleLimit !== null)
        assert.ok(exportHandleGrowth <= exportHandleLimit,
          mode + ' export WebGL call-balance growth ' + exportHandleGrowth +
          ' exceeded CHART_LIFECYCLE_MAX_EXPORT_HANDLE_GROWTH ' + exportHandleLimit);
      if ((i + 1) % 5 === 0 || i + 1 === exportsCount)
        exportSamples.push({cycle: i + 1, mode, ...result});
    }

    const twoCanvases = await page.evaluate(async () => {
      const c = globalThis.ng.getComponent(document.querySelector('chart-demo'));
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'width:240px;height:240px;display:block';
      document.querySelector('.stage').appendChild(canvas);
      let second;
      try {
        second = new c.renderer.constructor();
        second.inizializzaGraficoRender({nativeElement: canvas}, {x: 240, y: 240});
        await second.disegnaScena(c.radix, null, null, 'carta-astrale', c.options());
        const before = {...second.renderer.info.memory};
        await c.draw();
        if (c.error) throw Error(c.error);
        const after = {...second.renderer.info.memory};
        return {before, after, firstAlive: c.renderer.renderer === globalThis.__webglLifeMain.renderer,
          firstSceneAlive: c.renderer.scene === globalThis.__webglLifeMain.scene,
          firstTextures: c.renderer.renderer.info.memory.textures};
      } finally {
        second?.ngOnDestroy();
        canvas.remove();
      }
    });
    assert.deepEqual(twoCanvases.after, twoCanvases.before,
      'Redrawing first canvas mutated second canvas resource accounting');
    assert.ok(twoCanvases.before.textures > 0 && twoCanvases.firstTextures > 0);
    assert.ok(twoCanvases.firstAlive && twoCanvases.firstSceneAlive);

    const final = await page.evaluate(memorySnapshot);
    assert.equal(final.contextLost, 0, 'WebGL context loss');
    assert.ok(final.created > 0 && final.deleted > 0, 'Expected texture create/delete calls');
    assert.deepEqual(errors, [], 'Unexpected browser errors');
    const textureGrowth = afterRedraw.textures - baseline.textures;
    const geometryGrowth = afterRedraw.geometries - baseline.geometries;
    if (textureLimit !== null) assert.ok(textureGrowth <= textureLimit, 'Unacceptable texture growth');
    if (geometryLimit !== null) assert.ok(geometryGrowth <= geometryLimit, 'Unacceptable geometry growth');
    console.log(JSON.stringify({browser: browserName, version: browser.version(),
      redraws, exports: exportsCount, modes, baseline, afterRedraw, final,
      textureGrowth, geometryGrowth, textureLimit, geometryLimit,
      exportHandleLimit, exportCallBaseline, baselineHandleBalance, peakExportHandleGrowth,
      peakTrackedLiveGrowth,
      redrawSamples, exportSamples, exportVisualSamples, twoCanvases,
      limitations: 'Pixel-color checks prove only visible non-uniform synthetic output, not chart/astrology correctness. Three.js memory counters are not physical GPU memory. WeakMap-tracked texture handles are API-level observations only: context loss and browser internals are not accounted for. Texture create/delete call balance includes temporary offscreen contexts but is NOT GPU bytes or leak proof. Synthetic headless rendering does not prove artwork parity, production, or Astrolabio.'}, null, 2));
  } finally {
    await page?.close();
    await browser.close();
  }
});
