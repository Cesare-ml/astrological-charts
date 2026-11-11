import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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

test('a planet at latitude zero changes the actual synthetic Three.js latitude PNG', {timeout: 150000}, async () => {
  mkdirSync(output, {recursive: true});
  const bundle = await build({entryPoints:['tests/fixtures/latitude-zero-render-harness.ts'],
    bundle:true, write:false, platform:'browser', format:'iife', target:'es2022', tsconfig:'tsconfig.json'});
  const browser = await launchBrowser();
  // Keep browser.close() in the finally block even if newPage() fails.
  let page;
  const pageErrors = [], assetErrors = [];
  try {
    page = await browser.newPage();
    page.on('pageerror', error => pageErrors.push(error.message));
    // Only track our synthetic pack: unrelated dev-server requests (for example,
    // a browser favicon) are not proof of missing chart artwork.
    const assetBase = 'http://127.0.0.1:4177/assets/';
    page.on('response', response => {
      if (response.url().startsWith(assetBase) && response.status() >= 400)
        assetErrors.push(`${response.status()} ${new URL(response.url()).pathname}`);
    });
    page.on('requestfailed', request => {
      if (request.url().startsWith(assetBase))
        assetErrors.push(`${request.failure()?.errorText ?? 'request failed'} ${new URL(request.url()).pathname}`);
    });
    const navigation = await page.goto('http://127.0.0.1:4200/', {waitUntil:'domcontentloaded'});
    assert.ok(navigation?.ok(), 'Angular demo must respond successfully at http://127.0.0.1:4200/');
    // Surface an Angular render failure immediately, rather than waiting for
    // the full 30 s "Rendered" timeout when the UI already reports an error.
    await page.waitForFunction(() =>
      /Rendered|Rendering failed/.test(document.querySelector('[data-testid=status]')?.textContent || ''),
      null, {timeout:30000});
    const readyStatus = await page.locator('[data-testid=status]').textContent();
    assert.match(readyStatus || '', /Rendered/, readyStatus || 'Demo has no render status');
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    const {withSun, withoutSun, negativeZeroSun, shiftedSun,
      transitZeroSun, transitFilteredSun, transitShiftedSun} =
      await page.evaluate(() => globalThis.runZeroLatitudeRenderProbe());
    assert.match(withSun, /^data:image\/png;base64,/);
    assert.match(withoutSun, /^data:image\/png;base64,/);
    assert.match(negativeZeroSun, /^data:image\/png;base64,/);
    assert.match(shiftedSun, /^data:image\/png;base64,/);
    assert.match(transitZeroSun, /^data:image\/png;base64,/);
    assert.match(transitFilteredSun, /^data:image\/png;base64,/);
    assert.match(transitShiftedSun, /^data:image\/png;base64,/);
    const a = Buffer.from(withSun.split(',')[1], 'base64');
    const b = Buffer.from(withoutSun.split(',')[1], 'base64');
    const z = Buffer.from(negativeZeroSun.split(',')[1], 'base64');
    const c = Buffer.from(shiftedSun.split(',')[1], 'base64');
    const t0 = Buffer.from(transitZeroSun.split(',')[1], 'base64');
    const tn = Buffer.from(transitFilteredSun.split(',')[1], 'base64');
    const t2 = Buffer.from(transitShiftedSun.split(',')[1], 'base64');
    // Reject empty/truncated or non-PNG data URLs before writing diagnostic artifacts.
    // A browser export returning a generic base64 payload must not look like a
    // successful Three.js PNG regression capture.
    const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    for (const [label, png] of Object.entries({
      withSun:a, withoutSun:b, negativeZeroSun:z, shiftedSun:c,
      transitZeroSun:t0, transitFilteredSun:tn, transitShiftedSun:t2,
    })) {
      assert.ok(png.length > 24 && png.subarray(0, 8).equals(pngSignature),
        `invalid or truncated PNG export: ${label}`);
      // The PNG IHDR must be the first chunk, with the standard 13-byte payload.
      // Catch wrong-size canvas exports before saving or decoding seven images.
      assert.equal(png.readUInt32BE(8), 13, `invalid PNG IHDR length: ${label}`);
      assert.equal(png.toString('ascii', 12, 16), 'IHDR', `missing PNG IHDR: ${label}`);
      assert.equal(png.readUInt32BE(16), 400, `unexpected PNG width: ${label}`);
      assert.equal(png.readUInt32BE(20), 400, `unexpected PNG height: ${label}`);
    }
    writeFileSync(join(output, 'latitude-zero-sun-enabled.png'), a);
    writeFileSync(join(output, 'latitude-negative-zero-sun-enabled.png'), z);
    writeFileSync(join(output, 'latitude-zero-sun-disabled.png'), b);
    writeFileSync(join(output, 'latitude-positive-two-sun-enabled.png'), c);
    writeFileSync(join(output, 'latitude-transit-zero-sun-enabled.png'), t0);
    writeFileSync(join(output, 'latitude-transit-sun-filtered.png'), tn);
    writeFileSync(join(output, 'latitude-transit-positive-two-sun-enabled.png'), t2);
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
    let changedChannels = 0, shiftedChannels = 0, shiftedVsDisabledChannels = 0, negativeZeroDifferences = 0;
    for (let i = 0; i < first.data.length; i++) {
      if (Math.abs(first.data[i] - second.data[i]) > 2) changedChannels++;
      if (Math.abs(first.data[i] - shifted.data[i]) > 2) shiftedChannels++;
      if (Math.abs(second.data[i] - shifted.data[i]) > 2) shiftedVsDisabledChannels++;
      if (Math.abs(first.data[i] - negativeZero.data[i]) > 2) negativeZeroDifferences++;
    }
    assert.ok(negativeZeroDifferences <= Math.ceil(first.data.length * 0.0001),
      `positive and negative zero must render identically within pixel tolerance (different channels: ${negativeZeroDifferences})`);
    assert.ok(changedChannels > 30,
      `the zero-latitude Sun should appear in the real Three.js ring (changed channels: ${changedChannels})`);
    assert.ok(shiftedChannels > 30,
      `the zero-latitude Sun must move when latitude changes to +2° (changed channels: ${shiftedChannels})`);
    assert.ok(shiftedVsDisabledChannels > 30,
      `the +2° Sun must remain visible compared with a disabled Sun (changed channels: ${shiftedVsDisabledChannels})`);
    // Compare transit-only changes with natal Sun, options and transit ring/grid fixed.
    const [tZero, tAbsent, tShifted] = await Promise.all([
      sharp(t0).removeAlpha().raw().toBuffer({resolveWithObject:true}),
      sharp(tn).removeAlpha().raw().toBuffer({resolveWithObject:true}),
      sharp(t2).removeAlpha().raw().toBuffer({resolveWithObject:true}),
    ]);
    for (const other of [tZero, tAbsent, tShifted]) {
      assert.deepEqual({width:other.info.width, height:other.info.height, channels:other.info.channels},
        {width:first.info.width, height:first.info.height, channels:first.info.channels},
        'transit control PNG must match natal output dimensions and channels');
    }
    let transitVisible = 0, transitMoved = 0, shiftedTransitVisible = 0;
    for (let i = 0; i < tZero.data.length; i++) {
      if (Math.abs(tZero.data[i] - tAbsent.data[i]) > 2) transitVisible++;
      if (Math.abs(tZero.data[i] - tShifted.data[i]) > 2) transitMoved++;
      if (Math.abs(tShifted.data[i] - tAbsent.data[i]) > 2) shiftedTransitVisible++;
    }
    assert.ok(transitVisible > 30,
      `transit Sun at 0° must be visible compared with the same transit ring after filtering only the Sun (changed channels: ${transitVisible})`);
    assert.ok(transitMoved > 30,
      `transit Sun must move when its latitude changes from 0° to +2° (changed channels: ${transitMoved})`);
    assert.ok(shiftedTransitVisible > 30,
      `transit Sun at +2° must remain visible against the filtered-Sun control (changed channels: ${shiftedTransitVisible})`);

    assert.deepEqual(pageErrors, [], 'unexpected Angular/Three.js page errors during latitude rendering');
    assert.deepEqual(assetErrors, [], 'synthetic image requests must succeed during latitude rendering');
  } catch (error) {
    // Include the latest demo status and network failures even when the render
    // throws before the final assertions; PNGs are saved earlier when available.
    const status = page
      ? await page.locator('[data-testid=status]').textContent({timeout: 1000}).catch(() => 'unavailable')
      : 'page unavailable';
    throw new Error(`latitude WebGL probe failed (demo status: ${status}; page errors: ${pageErrors.join('; ') || 'none'}; asset errors: ${assetErrors.join('; ') || 'none'})`, {cause:error});
  } finally {
    await browser.close();
  }
});
