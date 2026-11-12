import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
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
    async function ready() {
      await page.waitForFunction(() => {
        const text = document.querySelector('[data-testid=status]')?.textContent ?? '';
        return (/Rendered|Rendering failed/.test(text)) &&
          !document.querySelector('#mode')?.disabled;
      }, { timeout: 45000 });
      assert.match(await status.textContent(), /Rendered/, 'Angular chart must render');
    }
    try {
      await page.goto('http://127.0.0.1:4200/', { waitUntil: 'domcontentloaded' });
      await ready();
      await page.selectOption('#mode','natal');
      await ready();
      await page.selectOption('#skin','light');
      await ready();
      const before = await canvas.screenshot();
      const preview = page.locator('#astro-preview');
      assert.ok(await preview.isVisible(), 'Missing opt-in checkbox');
      assert.equal(await preview.isChecked(), false, 'Preview MUST be disabled by default');

      await preview.check();
      await ready();
      const after = await canvas.screenshot();
      assert.notEqual(screenshotHash(before), screenshotHash(after),
        'Enabling approved glyphs must change chart pixels');

      const names = new Set(maskResponses.map(r => r.url.split('/').at(-1)));
      for (const name of [
        'aries.png','taurus.png','gemini.png','cancer.png','leo.png','virgo.png',
        'libra.png','scorpio.png','sagittarius.png','capricorn.png','aquarius.png','pisces.png',
      ]) assert.ok(names.has(name), 'Missing requested approved sign: ' + name);
      assert.ok(names.has('sun.png') || names.has('moon.png'),
        'Main celestial symbols must request the approved masks');
      assert.ok(maskResponses.every(r => r.status === 200),
        'Mask requests must succeed with the private approved asset server');

      await page.selectOption('#skin','dark');
      await ready();
      assert.notEqual(screenshotHash(await canvas.screenshot()), screenshotHash(after),
        'The same glyph shapes must render with dark skin colors');
      for (const mode of ['transits','synastry']) {
        await page.selectOption('#mode',mode);
        await ready();
        const png = await canvas.screenshot();
        const stats = await sharp(png).stats();
        assert.ok(stats.channels.some(ch => ch.stdev > 5),
          mode + ' chart should not be blank');
      }

      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Export PNG' }).click(),
      ]);
      const exportPath = join(process.cwd(), '.local-astro-preview-export.png');
      // Keep output private; callers may remove this file after reviewing.
      await download.saveAs(exportPath);
      const meta = await sharp(exportPath).metadata();
      assert.equal(meta.format,'png');
      assert.equal(meta.width,1600);
      assert.equal(meta.height,1600);

      // Verify rollback on the SAME mode and skin as the first screenshot.
      await page.selectOption('#mode','natal');
      await ready();
      await page.selectOption('#skin','light');
      await ready();
      await preview.uncheck();
      await ready();
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
      assert.deepEqual(errors,[]);
    } finally {
      await browser.close();
    }
  });
