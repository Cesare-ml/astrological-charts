#!/usr/bin/env node
/* Astrological Charts — Copyright (c) 2026 Cesare-ml (VirgoStars project).
 * CPAL-1.0; see ../LICENSE, including Exhibits A/B.
 *
 * Local-only bridge: precomputed JSON -> actual Angular/Three.js -> PNG/JPEG.
 * Starts temporary synthetic asset and demo servers when needed.
 */
import { spawn } from 'node:child_process';
import { startOwnedServer, getServerFailure, stopOwnedServers } from './local-process-lifecycle.mjs';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { matchesLocalChartDemo, matchesSyntheticAssetServer, matchesManifestAssetServer, waitForChartControls } from './verify-local-render-services.mjs';
import { loadVerifiedExternalRenderPack } from './approved-render-assets.mjs';
import { validateChartPayloadV1, MAX_CHART_JSON_BYTES } from './validate-chart-input.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function usage() {
  console.log('Usage: node scripts/render-chart.mjs --input chart.json --output chart.png [--mode natal|transits|synastry|latitude] [--skin light|dark|...]');
  console.log('       node scripts/render-chart.mjs --input chart.json --validate-only [--mode natal|transits|synastry|latitude]');
  console.log('       node scripts/render-chart.mjs --input chart.json --output chart.png --assets-root ../astrological-assets/public/assets --assets-manifest ../astrological-assets/manifests/approved-assets.json');

  console.log('Requires Node dependencies (npm ci), Chrome/Chromium and local WebGL support.');
}

function args(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--help' || argv[i] === '-h') { usage(); process.exit(0); }
    if (argv[i] === '--validate-only') {
      if (opts.validateOnly) throw new Error('Duplicate --validate-only argument.');
      opts.validateOnly = true;
      continue;
    }
    if (!['--input', '--output', '--skin', '--mode', '--assets-root', '--assets-manifest'].includes(argv[i]) ||
        !argv[i + 1] || argv[i + 1].startsWith('--') ||
        Object.hasOwn(opts, argv[i].slice(2))) {
      throw new Error(`Unknown, duplicate or missing argument: ${argv[i]}. Run with --help.`);
    }
    opts[argv[i].slice(2)] = argv[++i];
  }
  if (!opts.input || (!opts.output && !opts.validateOnly)) {
    throw new Error('Provide --input and --output, or --validate-only. See --help.');
  }
  opts.input = resolve(process.cwd(), opts.input);
  if (opts.output) opts.output = resolve(process.cwd(), opts.output);
  if (!existsSync(opts.input)) throw new Error(`Input file not found: ${opts.input}`);
  const format = opts.output ? extname(opts.output).toLowerCase() : null;
  if (!opts.validateOnly && !['.png', '.jpg', '.jpeg'].includes(format)) {
    throw new Error('Output extension must be .png, .jpg or .jpeg.');
  }
  if (opts.validateOnly && opts.output && !['.png', '.jpg', '.jpeg'].includes(format)) {
    throw new Error('Output extension must be .png, .jpg or .jpeg.');
  }
  if (Boolean(opts['assets-root']) !== Boolean(opts['assets-manifest'])) {
    throw new Error('Provide --assets-root and --assets-manifest together; there is no implicit private asset fallback.');
  }
  if (opts['assets-root']) {
    opts.assetsRoot = resolve(process.cwd(), opts['assets-root']);
    opts.assetsManifest = resolve(process.cwd(), opts['assets-manifest']);
  }
  if (opts.mode && !['natal', 'transits', 'synastry', 'latitude'].includes(opts.mode)) {
    throw new Error('Invalid --mode; choose natal, transits, synastry or latitude.');
  }
  // Fail fast: no npm dependencies, asset packs or browser processes should
  // start for malformed/oversized Python or Node.js input files.
  if (statSync(opts.input).size > MAX_CHART_JSON_BYTES) {
    throw new Error('Chart JSON exceeds the 1 MB demo limit.');
  }
  let chart;
  try { chart = JSON.parse(readFileSync(opts.input, 'utf8')); }
  catch (error) { throw new Error('Invalid chart JSON file: ' + error.message); }
  validateChartPayloadV1(chart, { mode: opts.mode, skin: opts.skin });
  return { ...opts, format };
}

function launch(command, commandArgs, owned) {
  const child = startOwnedServer(command, commandArgs, { cwd: root });
  owned.push(child);
  return child;
}

async function run(command, commandArgs) {
  await new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, commandArgs, { cwd: root, stdio: 'inherit', windowsHide: true });
    child.on('error', rejectRun);
    child.on('exit', code => code === 0 ? resolveRun() : rejectRun(new Error(`Local setup exited with code ${code}`)));
  });
}

async function live(url) {
  try { return (await fetch(url, { signal: AbortSignal.timeout(1500) })).status < 500; }
  catch { return false; }
}

async function waitFor(url, child) {
  for (let i = 0; i < 240; i++) {
    if (await live(url)) return;
    const failure = getServerFailure(child);
    if (failure) throw new Error(`Local server failed before becoming ready: ${url} (${failure})`);
    await delay(250);
  }
  throw new Error(`Local server not ready: ${url}. Check Node dependencies and port conflicts.`);
}

/** Wait for an actual *new* completed Angular draw, not a stale
 * "Rendered" label from a previous chart mode or skin. */
async function waitForCompletedChart(page, previousRevision, expected = {}) {
  await page.waitForFunction(({ previousRevision, expected }) => {
    const el = document.querySelector('[data-testid="status"]');
    if (!el) return false;
    const revision = Number(el.getAttribute('data-render-revision'));
    if (!Number.isSafeInteger(revision) || revision <= previousRevision) return false;
    if (document.querySelector('#mode')?.disabled) return false;
    const status = el.textContent || '';
    // Failed JSON import may not start a draw; surface its error immediately.
    if (status.includes('Rendering failed')) return true;
    if (!status.includes('Rendered')) return false;
    if (expected.mode && el.getAttribute('data-render-mode') !== expected.mode) return false;
    if (expected.skin && el.getAttribute('data-render-skin') !== expected.skin) return false;
    if (expected.imported && !(document.querySelector('[data-testid="chart-source"]')?.textContent || '').includes('Imported:')) return false;
    return true;
  }, { previousRevision, expected }, { timeout: 60000 });
  const status = await page.locator('[data-testid="status"]').textContent();
  if (!status?.includes('Rendered') || status.includes('Rendering failed')) {
    throw new Error(status || 'Chart render did not complete.');
  }
  return Number(await page.locator('[data-testid="status"]').getAttribute('data-render-revision'));
}

function chromeExecutable(chromium) {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    chromium.executablePath(),
  ].filter(Boolean);
  const chosen = candidates.find(existsSync);
  if (!chosen) throw new Error('Chrome/Chromium not found. Install Chrome or set CHROME_PATH.');
  return chosen;
}

async function main() {
  const opts = args(process.argv.slice(2));
  if (opts.validateOnly) {
    console.log('Valid chart JSON v1: precomputed coordinates, houses and requested mode accepted.');
    console.log('No browser started. No ephemerides or other astronomy calculations were performed.');
    return;
  }
  // Check the complete approved binary pack before loading browser dependencies.
  // This also rejects missing/private packs without an implicit download.
  const approved = opts.assetsRoot
    ? loadVerifiedExternalRenderPack(opts.assetsRoot, opts.assetsManifest)
    : null;
  if (!existsSync(join(root, 'node_modules', '@angular', 'cli', 'bin', 'ng.js'))) {
    throw new Error('Dependencies missing. Run "npm ci" in the astrological-charts directory first.');
  }
  // Load browser/graphics dependencies only AFTER validating the JSON file.
  // --help and malformed-input feedback must work before npm ci.
  const [{ chromium }, { default: sharp }] = await Promise.all([
    import('playwright-core'), import('sharp'),
  ]);
  const owned = [];
  let browser;
  let tempDir;
  try {
    const useExternalAssets = Boolean(opts.assetsRoot);
    const pack = join(root, '.local', 'demo-pack');
    const manifestPath = useExternalAssets ? opts.assetsManifest
      : join(pack, 'manifests', 'approved-assets.json');
    const assetsRoot = useExternalAssets ? opts.assetsRoot
      : join(pack, 'public', 'assets');
    if (!useExternalAssets && !existsSync(manifestPath)) {
      if (existsSync(pack)) throw new Error('Incomplete synthetic pack in .local/demo-pack; inspect it before deleting, then retry.');
      console.log('Generating the synthetic image pack (no private artwork)…');
      await run(process.execPath, [join(root, 'scripts', 'generate-demo-pack.mjs'), '--out', pack]);
    }
    // Only use loopback; never upload input charts or fetch production assets.
    const assetUrl = 'http://127.0.0.1:4177/';
    const demoUrl = 'http://127.0.0.1:4200/';
    const assetManifest = approved?.manifest ?? JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (useExternalAssets) {
      console.log(`Verified ${approved.verified.count} external asset files using the local manifest and SHA-256.`);
      // Never reuse a running service in external mode: sampled requests
      // alone do not prove ownership of every file served on that port.
      if (await live(assetUrl)) {
        throw new Error('Port 4177 is already in use. Stop only your own prior asset preview before exporting with an external approved pack.');
      }
      const assets = launch(process.execPath, [join(root, 'scripts', 'serve-local-assets.mjs'),
        '--root', assetsRoot, '--manifest', manifestPath], owned);
      await waitFor(assetUrl, assets);
      if (!await matchesManifestAssetServer(assetUrl, assetManifest)) {
        throw new Error('Local external asset service did not serve bytes matching the verified manifest.');
      }
    } else {
      if (!await live(assetUrl)) {
        console.log('Starting local verified synthetic image server…');
        const assets = launch(process.execPath, [join(root, 'scripts', 'serve-local-assets.mjs'),
          '--root', assetsRoot, '--manifest', manifestPath], owned);
        await waitFor(assetUrl, assets);
      }
      if (!await matchesSyntheticAssetServer(assetUrl, assetManifest)) {
        throw new Error('Port 4177 is serving a different or invalid asset pack. Stop that local server before running the synthetic PNG/JPEG bridge.');
      }
    }
    if (!await live(demoUrl)) {
      console.log('Starting local Angular demo…');
      const demo = launch(process.execPath, [join(root, 'node_modules', '@angular', 'cli', 'bin', 'ng.js'),
        'serve', 'demo', '--host', '127.0.0.1', '--port', '4200'], owned);
      await waitFor(demoUrl, demo);
    }
    if (!await matchesLocalChartDemo(demoUrl)) {
      throw new Error('Port 4200 is not serving the Astrological Charts Angular demo. Stop that local server and try again.');
    }

    browser = await chromium.launch({
      executablePath: chromeExecutable(chromium), headless: true,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    const page = await browser.newPage({ viewport: { width: 1200, height: 1000 }, acceptDownloads: true });
    const browserErrors = [];
    page.on('pageerror', error => {
      browserErrors.push(String(error.message));
      console.error('Browser:', error.message);
    });
    await page.route('**/*', route => {
      const uri = new URL(route.request().url());
      return (uri.hostname === '127.0.0.1' && ['4200', '4177'].includes(uri.port)) ||
        ['data:', 'blob:'].includes(uri.protocol)
        ? route.continue() : route.abort('blockedbyclient');
    });
    await page.goto('http://127.0.0.1:4200/', { waitUntil: 'domcontentloaded' });
    // Confirm the actual UI is mounted before awaiting a chart export.
    await waitForChartControls(page, browserErrors);
    let revision = await waitForCompletedChart(page, -1);
    await page.locator('#chart-file').setInputFiles(opts.input);
    revision = await waitForCompletedChart(page, revision, { imported: true });
    if (opts.mode && await page.locator('#mode').inputValue() !== opts.mode) {
      await page.selectOption('#mode', opts.mode);
      revision = await waitForCompletedChart(page, revision, { mode: opts.mode });
    }
    if (opts.skin && await page.locator('#skin').inputValue() !== opts.skin) {
      await page.selectOption('#skin', opts.skin);
      revision = await waitForCompletedChart(page, revision, { skin: opts.skin });
    }
    // Assert the scene that is about to be exported matches the selected
    // controls: asynchronous redraws must not fall back to a previous scene.
    const snapshot = await page.locator('[data-testid="status"]').evaluate(element => ({
      mode: element.getAttribute('data-render-mode'),
      skin: element.getAttribute('data-render-skin'),
      status: element.textContent || '',
    }));
    const finalMode = await page.locator('#mode').inputValue();
    const finalSkin = await page.locator('#skin').inputValue();
    if (snapshot.mode !== finalMode || snapshot.skin !== finalSkin ||
        !snapshot.status.includes('Rendered')) {
      throw new Error('Chart mode or skin changed before rendering was complete.');
    }
    let status = snapshot.status;
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60000 }),
      page.getByRole('button', { name: 'Export PNG' }).click(),
    ]);
    tempDir = await mkdtemp(join(tmpdir(), 'virgostars-chart-'));
    const pngPath = join(tempDir, 'chart.png');
    await download.saveAs(pngPath);
    status = await page.locator('[data-testid="status"]').textContent();
    if (status?.includes('failed')) throw new Error(status);
    const png = await readFile(pngPath);
    const metadata = await sharp(png).metadata();
    if (metadata.format !== 'png' || !metadata.width || !metadata.height) {
      throw new Error('Unexpected image export; expected a real non-empty PNG.');
    }
    await mkdir(dirname(opts.output), { recursive: true });
    if (opts.format === '.png') await sharp(png).png().toFile(opts.output);
    else await sharp(png).flatten({ background: '#ffffff' }).jpeg({ quality: 92 }).toFile(opts.output);
    console.log(`Saved ${opts.output} (${metadata.width}×${metadata.height}, ${opts.format.slice(1)})`);
    console.log('Rendered from provided chart positions; no astronomical calculations were performed.');
  } finally {
    if (browser) await browser.close();
    if (tempDir) await rm(tempDir, { force: true, recursive: true });
    await stopOwnedServers(owned);
  }
}

main().catch(error => { console.error('Chart export failed:', error.message); process.exitCode = 1; });
