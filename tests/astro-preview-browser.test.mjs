import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

/**
 * Optional integration test: requires Angular demo and the authorized TWO-root
 * asset server running locally. NEVER commits/serves private masks automatically.
 *
 * CHART_ASTRO_TEST_PRIVATE_ASSETS=1 npm run test:astro-preview-browser
 */
test('approved VirgoStars Astro images render in charts and opt-out restores originals',
  { timeout: 150000 }, async () => {
    assert.equal(process.env.CHART_ASTRO_TEST_PRIVATE_ASSETS, '1',
      'Explicit CHART_ASTRO_TEST_PRIVATE_ASSETS=1 is required; see docs/VIRGOSTARS_ASTRO_PRIVATE_IMAGE_PREVIEW.md');
    const executable = [process.env.CHROME_PATH,
      '/usr/bin/chromium', '/usr/bin/chromium-browser',
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
    ].filter(Boolean).find(existsSync);
    assert.ok(executable, 'Install Chromium/Chrome or set CHROME_PATH');
    const browser = await chromium.launch({ executablePath: executable, headless: true,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 1200, height: 1000 },
      acceptDownloads: true });
    const errors = [];
    const maskResponses = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.url().includes('/assets/img/virgostars-astro/masks/'))
        maskResponses.push({ url: response.url(), status: response.status() });
    });
    const status = page.locator('[data-testid=status]');
    const canvas = page.locator('canvas[data-testid=chart]');
    const screenshotHash = buffer => createHash('sha256').update(buffer).digest('hex');
    async function renderedRevision() {
      const value = await status.getAttribute('data-render-revision');
      assert.match(value ?? '', /^\\d+$/, 'Demo must expose a numeric render revision');
      return Number(value);
    }
    async function readyAfter(previousRevision) {
      // A stale "Rendered" status from the prior frame must never satisfy QA.
      await page.waitForFunction((before) => {
        const element = document.querySelector('[data-testid=status]');
        const text = element?.textContent ?? '';
        const revision = Number(element?.getAttribute('data-render-revision') ?? -1);
        return /Rendering failed/.test(text) ||
          (revision > before && /Rendered/.test(text) &&
            !document.querySelector('#mode')?.disabled);
      }, previousRevision, { timeout: 45000 });
      assert.match(await status.textContent(), /Rendered/, 'Angular chart must render');
      assert.ok(await renderedRevision() > previousRevision,
        'The browser must observe a NEW completed draw, not cached status text');
    }
    async function redraw(action) {
      const before = await renderedRevision();
      await action();
      await readyAfter(before);
    }
    async function exportPixels() {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Export PNG' }).click(),
      ]);
      // Keep all exported private chart bytes in memory; never write to Git.
      const chunks = [];
      const stream = await download.createReadStream();
      for await (const chunk of stream) chunks.push(chunk);
      const image = Buffer.concat(chunks);
      assert.equal((await sharp(image).metadata()).format, 'png',
        'The browser download must actually be a PNG');
      const { data, info } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.equal(info.format, 'raw');
      assert.equal(info.width, 1600);
      assert.equal(info.height, 1600);
      assert.equal(info.channels, 3);
      return data;
    }
    try {
      await page.goto('http://127.0.0.1:4200/', { waitUntil: 'domcontentloaded' });
      await readyAfter(0);
      assert.equal(await page.locator('#mode').inputValue(), 'natal');
      assert.equal(await page.locator('#skin').inputValue(), 'light');
      const before = await canvas.screenshot();
      const preview = page.locator('#astro-preview');
      assert.ok(await preview.isVisible(), 'Missing opt-in checkbox');
      assert.equal(await preview.isChecked(), false, 'Preview MUST be disabled by default');
      assert.equal(maskResponses.length, 0,
        'Preview OFF must not request even one private glyph mask');
      const originalExport = await exportPixels();
      assert.equal(maskResponses.length, 0,
        'Legacy PNG export must not access private glyph masks');

      await redraw(() => preview.check());
      const after = await canvas.screenshot();
      assert.notEqual(screenshotHash(before), screenshotHash(after),
        'Enabling approved glyphs must change chart pixels');
      const previewExport = await exportPixels();
      assert.notEqual(screenshotHash(originalExport), screenshotHash(previewExport),
        'PNG export must contain the preview glyphs, not silently export legacy artwork');

      const names = new Set(maskResponses.map(r => r.url.split('/').at(-1)));
      for (const name of [
        'aries.png','taurus.png','gemini.png','cancer.png','leo.png','virgo.png',
        'libra.png','scorpio.png','sagittarius.png','capricorn.png','aquarius.png','pisces.png',
      ]) assert.ok(names.has(name), 'Missing requested approved sign: ' + name);
      assert.ok(names.has('sun.png') || names.has('moon.png'),
        'Main celestial symbols must request the approved masks');
      assert.ok(maskResponses.every(r => r.status === 200),
        'Mask requests must succeed with the private approved asset server');

      await redraw(() => page.selectOption('#skin','dark'));
      assert.notEqual(screenshotHash(await canvas.screenshot()), screenshotHash(after),
        'The same glyph shapes must render with dark skin colors');
      for (const mode of ['transits','synastry']) {
        await redraw(() => page.selectOption('#mode',mode));
        const png = await canvas.screenshot();
        const stats = await sharp(png).stats();
        assert.ok(stats.channels.some(ch => ch.stdev > 5),
          mode + ' chart should not be blank');
      }

      // Verify rollback on the SAME mode and skin as the first screenshot.
      await redraw(() => page.selectOption('#mode','natal'));
      await redraw(() => page.selectOption('#skin','light'));
      const privateRequestsBeforeRollback = maskResponses.length;
      await redraw(() => preview.uncheck());
      assert.equal(maskResponses.length, privateRequestsBeforeRollback,
        'Rollback must stop requesting private glyph masks');
      const restored = await canvas.screenshot();
      const oldImage = await sharp(before).removeAlpha().raw().toBuffer();
      const newImage = await sharp(restored).removeAlpha().raw().toBuffer();
      assert.equal(oldImage.length,newImage.length);
      let different = 0;
      for (let i = 0; i < oldImage.length; i++) {
        if (Math.abs(oldImage[i] - newImage[i]) > 4) different++;
      }
      assert.ok(different / oldImage.length < 0.01,
        'Disabling preview must closely restore the original chart pixels; changed channels: ' + different);
      const restoredExport = await exportPixels();
      assert.equal(restoredExport.length, originalExport.length);
      let changedExportChannels = 0;
      for (let i = 0; i < originalExport.length; i++) {
        if (Math.abs(originalExport[i] - restoredExport[i]) > 4) changedExportChannels++;
      }
      assert.ok(changedExportChannels / originalExport.length < 0.01,
        'Turning preview off must restore the original exported glyphs; changed channels: ' + changedExportChannels);
      assert.deepEqual(errors,[]);
    } finally {
      await browser.close();
    }
  });
