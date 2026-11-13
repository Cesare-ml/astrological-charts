/**
 * Manual, local browser diagnostic for WebGL buffer lifecycle during redraws
 * AND repeated PNG exports. Requires the synthetic demo and asset servers.
 * Reports API handle accounting; does not measure GPU allocations or bytes.
 */
import assert from 'node:assert/strict';
import {existsSync, statSync} from 'node:fs';
import {chromium, firefox} from 'playwright-core';
import {installWebGLBufferLedger} from './webgl-buffer-ledger.mjs';

const browserName = process.env.CHART_TEST_BROWSER || 'chromium';
assert.ok(['chromium', 'firefox'].includes(browserName),
  'CHART_TEST_BROWSER must be chromium or firefox');

function boundedInt(name, fallback, maximum) {
  const value = Number(process.env[name] ?? fallback);
  assert.ok(Number.isSafeInteger(value) && value >= 1 && value <= maximum,
    `${name} must be an integer between 1 and ${maximum}`);
  return value;
}
const redraws = boundedInt('CHART_BUFFER_REDRAWS', 30, 200);
const exportsCount = boundedInt('CHART_BUFFER_EXPORTS', 3, 10);

const candidates = browserName === 'firefox'
  ? [process.env.FIREFOX_PATH, firefox.executablePath()]
  : [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
const executablePath = candidates.filter(Boolean).find(existsSync);
assert.ok(executablePath,
  `Browser ${browserName} not found; set ${browserName === 'firefox' ? 'FIREFOX_PATH' : 'CHROME_PATH'}`);

const browser = browserName === 'firefox'
  ? await firefox.launch({
      executablePath, headless: true,
      firefoxUserPrefs: {'webgl.disabled': false, 'webgl.force-enabled': true},
    })
  : await chromium.launch({
      executablePath, headless: true,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });

try {
  const context = await browser.newContext({
    viewport: {width: 1200, height: 1000}, acceptDownloads: true,
  });
  try {
    const page = await context.newPage();
    // Inject before Angular/Three.js initializes; use function source directly
    // so no custom dev-server route or production code is needed.
    await page.addInitScript({
      content: `(${installWebGLBufferLedger.toString()})(globalThis);`,
    });

    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    const ready = async () => {
      await page.waitForFunction(() => {
        const status = document.querySelector('[data-testid=status]')?.textContent || '';
        return /Rendered|Rendering failed/.test(status)
          && !document.querySelector('#skin')?.disabled;
      }, {timeout: 30000});
      assert.match(await page.locator('[data-testid=status]').textContent(),
        /Rendered/, 'chart rendering failed');
    };
    const snapshot = () => page.evaluate(() => {
      const ledger = globalThis.__virgoWebGLBufferLedger;
      if (!ledger) throw new Error('WebGL buffer ledger was not installed');
      return ledger.snapshot();
    });

    await page.goto('http://127.0.0.1:4200/', {waitUntil: 'domcontentloaded'});
    await ready();
    assert.ok(await page.locator('[data-testid=chart]').isVisible(),
      'expected a visible chart canvas');
    const checkpoints = [{phase: 'initial', index: 0, ...(await snapshot())}];

    for (let i = 1; i <= redraws; i++) {
      await page.selectOption('#skin', i % 2 ? 'dark' : 'light');
      await ready();
      if (i % 10 === 0 || i === redraws) {
        checkpoints.push({phase: 'redraw', index: i, ...(await snapshot())});
      }
    }

    for (let i = 1; i <= exportsCount; i++) {
      const [download] = await Promise.all([
        page.waitForEvent('download', {timeout: 60000}),
        page.getByRole('button', {name: 'Export PNG'}).click(),
      ]);
      const path = await download.path();
      assert.ok(path && statSync(path).size > 100,
        `PNG export ${i} was missing or empty`);
      assert.match(download.suggestedFilename(), /\.png$/i);
      await page.waitForFunction(() =>
        (document.querySelector('[data-testid=status]')?.textContent || '')
          .includes('PNG exported.'), {timeout: 30000});
      checkpoints.push({phase: 'export', index: i, ...(await snapshot())});
    }

    const last = await snapshot();
    assert.equal(last.contextLost, 0, 'a WebGL context was lost');
    assert.ok(last.created > 0, 'no WebGL buffer creations were observed');
    assert.ok(last.deleted > 0, 'no WebGL buffer deletions were observed');
    assert.deepEqual(errors, [], `browser/HTTP errors: ${errors.join('; ')}`);

    console.log(JSON.stringify({
      recordedAt: new Date().toISOString(),
      node: process.version,
      platform: process.platform,
      browser: browserName,
      browserVersion: browser.version(),
      viewport: {width: 1200, height: 1000},
      chart: 'natal',
      redraws,
      exports: exportsCount,
      checkpoints,
      final: last,
      limitations: [
        'WebGL buffer create/delete handles are not GPU memory in bytes or proof of a leak.',
        'Uncollected offscreen WebGL contexts may retain API handles until context destruction; GC is not forced.',
        'Only a synthetic local demo is intended; no production or hardware compatibility is implied.',
      ],
    }, null, 2));
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
