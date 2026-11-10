#!/usr/bin/env node
/* Astrological Charts — Copyright (c) 2026 Cesare-ml (VirgoStars project).
 * CPAL-1.0; see ../LICENSE, including Exhibits A/B.
 *
 * Local-only bridge: precomputed JSON -> actual Angular/Three.js -> PNG/JPEG.
 * Starts temporary synthetic asset and demo servers when needed.
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { matchesLocalChartDemo, matchesSyntheticAssetServer } from './verify-local-render-services.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function usage() {
  console.log('Usage: node scripts/render-chart.mjs --input chart.json --output chart.png [--mode natal|transits|synastry|latitude] [--skin light|dark|...]');
  console.log('Requires Node dependencies (npm ci), Chrome/Chromium and local WebGL support.');
}

function args(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--help' || argv[i] === '-h') { usage(); process.exit(0); }
    if (!['--input', '--output', '--skin', '--mode'].includes(argv[i]) || !argv[i + 1]) {
      throw new Error(`Unknown/missing argument: ${argv[i]}. Run with --help.`);
    }
    opts[argv[i].slice(2)] = argv[++i];
  }
  if (!opts.input || !opts.output) throw new Error('Provide --input and --output. See --help.');
  opts.input = resolve(process.cwd(), opts.input);
  opts.output = resolve(process.cwd(), opts.output);
  if (!existsSync(opts.input)) throw new Error(`Input file not found: ${opts.input}`);
  const format = extname(opts.output).toLowerCase();
  if (!['.png', '.jpg', '.jpeg'].includes(format)) throw new Error('Output extension must be .png, .jpg or .jpeg.');
  if (opts.mode && !['natal', 'transits', 'synastry', 'latitude'].includes(opts.mode)) {
    throw new Error('Invalid --mode; choose natal, transits, synastry or latitude.');
  }
  return { ...opts, format };
}

function launch(command, commandArgs, owned) {
  const child = spawn(command, commandArgs, { cwd: root, windowsHide: true, stdio: 'ignore' });
  child.on('error', error => { console.error('Unable to start local renderer server:', error.message); });
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
    if (child && child.exitCode !== null) throw new Error(`Local server exited before becoming ready: ${url}`);
    await delay(250);
  }
  throw new Error(`Local server not ready: ${url}. Check Node dependencies and port conflicts.`);
}

function chromeExecutable() {
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
  if (!existsSync(join(root, 'node_modules', '@angular', 'cli', 'bin', 'ng.js'))) {
    throw new Error('Dependencies missing. Run "npm ci" in the astrological-charts directory first.');
  }
  const owned = [];
  let browser;
  let tempDir;
  try {
    const pack = join(root, '.local', 'demo-pack');
    const manifest = join(pack, 'manifests', 'approved-assets.json');
    if (!existsSync(manifest)) {
      if (existsSync(pack)) throw new Error('Incomplete synthetic pack in .local/demo-pack; inspect it before deleting, then retry.');
      console.log('Generating the synthetic image pack (no private artwork)…');
      await run(process.execPath, [join(root, 'scripts', 'generate-demo-pack.mjs'), '--out', pack]);
    }
    // Only use loopback; never upload input charts or fetch production assets.
    const assetUrl = 'http://127.0.0.1:4177/';
    const demoUrl = 'http://127.0.0.1:4200/';
    const syntheticManifest = JSON.parse(readFileSync(manifest, 'utf8'));
    if (!await live(assetUrl)) {
      console.log('Starting local verified synthetic image server…');
      const assets = launch(process.execPath, [join(root, 'scripts', 'serve-local-assets.mjs'),
        '--root', join(pack, 'public', 'assets'), '--manifest', manifest], owned);
      await waitFor(assetUrl, assets);
    }
    if (!await matchesSyntheticAssetServer(assetUrl, syntheticManifest)) {
      throw new Error('Port 4177 is serving a different or invalid asset pack. Stop that local server before running the synthetic PNG/JPEG bridge.');
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
      executablePath: chromeExecutable(), headless: true,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    const page = await browser.newPage({ viewport: { width: 1200, height: 1000 }, acceptDownloads: true });
    page.on('pageerror', error => console.error('Browser:', error.message));
    await page.route('**/*', route => {
      const uri = new URL(route.request().url());
      return (uri.hostname === '127.0.0.1' && ['4200', '4177'].includes(uri.port)) ||
        ['data:', 'blob:'].includes(uri.protocol)
        ? route.continue() : route.abort('blockedbyclient');
    });
    await page.goto('http://127.0.0.1:4200/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const status = document.querySelector('[data-testid="status"]')?.textContent || '';
      return (/Rendered|Rendering failed/.test(status)) &&
        !document.querySelector('#mode')?.disabled;
    }, undefined, { timeout: 60000 });
    await page.locator('#chart-file').setInputFiles(opts.input);
    await page.waitForFunction(() => {
      const source = document.querySelector('[data-testid="chart-source"]')?.textContent || '';
      const status = document.querySelector('[data-testid="status"]')?.textContent || '';
      return (source.includes('Imported:') || status.includes('Rendering failed')) &&
        (/Rendered|Rendering failed/.test(status)) &&
        !document.querySelector('#mode')?.disabled;
    }, undefined, { timeout: 60000 });
    if (opts.mode) await page.selectOption('#mode', opts.mode);
    if (opts.skin) await page.selectOption('#skin', opts.skin);
    await page.waitForFunction(() => {
      const status = document.querySelector('[data-testid="status"]')?.textContent || '';
      return (/Rendered|Rendering failed/.test(status)) && !document.querySelector('#mode')?.disabled;
    }, undefined, { timeout: 60000 });
    let status = await page.locator('[data-testid="status"]').textContent();
    if (!status?.includes('Rendered')) throw new Error(status || 'Chart did not render.');
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
    for (const child of owned.reverse()) {
      if (child.exitCode === null) child.kill();
    }
  }
}

main().catch(error => { console.error('Chart export failed:', error.message); process.exitCode = 1; });
