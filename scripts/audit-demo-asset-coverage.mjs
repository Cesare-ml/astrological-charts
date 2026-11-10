#!/usr/bin/env node
// Compare paths requested by the synthetic demo against a separate local asset tree.
// Only directory entries are read from the reference tree; no artwork is copied.
import assert from 'node:assert/strict';
import { lstatSync, mkdirSync, readdirSync, writeFileSync, existsSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

export function assetExistsWithExactCase(root, relativePath) {
  const parts = relativePath.split('/');
  if (parts.length < 2 || !['img', 'fonts'].includes(parts[0]) ||
      parts.some(part => !part || part === '.' || part === '..' || part.includes('\\') || part.includes(':'))) {
    throw new Error(`Unsafe asset path: ${relativePath}`);
  }
  let current = resolve(root);
  const rootStat = lstatSync(current);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('Reference root must be a regular directory');
  for (let i = 0; i < parts.length; i++) {
    if (!readdirSync(current).includes(parts[i])) return false;
    current = join(current, parts[i]);
    const item = lstatSync(current);
    if (item.isSymbolicLink()) return false;
    if (i < parts.length - 1 && !item.isDirectory()) return false;
    if (i === parts.length - 1 && !item.isFile()) return false;
  }
  return true;
}

async function main(args) {
  if (args.length !== 2 || args[0] !== '--root' || !args[1]) {
    throw new Error('Usage: npm run audit:demo-asset-coverage -- --root <reference-assets-root>');
  }
  const rootPath = resolve(args[1]);
  const rootStat = lstatSync(rootPath);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('Reference root must be a regular directory');
  const root = realpathSync(rootPath);
  const output = resolve('.local/demo-asset-coverage.json');
  const outputRelative = relative(root, output);
  if (!outputRelative || (!isAbsolute(outputRelative) && outputRelative !== '..' && !outputRelative.startsWith('..' + sep))) {
    throw new Error('Report must be outside the reference asset tree');
  }
  const candidates = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
  const executablePath = candidates.find(existsSync);
  assert.ok(executablePath, 'Chrome or Chromium not found; set CHROME_PATH');
  const browser = await chromium.launch({executablePath, headless: true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const requests = new Map();
  const skins = ['dark', 'dark-bn', 'light', 'light-bn', 'sun', 'astrolabio', 'astrolabio-girasole'];
  const modes = ['natal', 'transits', 'synastry', 'latitude'];
  try {
    for (const mode of modes) for (const skin of skins) {
      const page = await browser.newPage();
      const errors = [];
      let phase = 'startup';
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
      page.on('request', request => {
        const url = new URL(request.url());
        if (url.hostname !== '127.0.0.1' || url.port !== '4177' || !url.pathname.startsWith('/assets/')) return;
        const path = decodeURIComponent(url.pathname.slice('/assets/'.length));
        if (!requests.has(path)) requests.set(path, new Set());
        requests.get(path).add(phase === 'target' ? `${mode}/${skin}` : phase);
      });
      const ready = async () => {
        await page.waitForFunction(() => {
          const status = document.querySelector('[data-testid=status]')?.textContent || '';
          return /Rendered|Rendering failed/.test(status) && !document.querySelector('#skin')?.disabled;
        }, {timeout:30000});
        assert.match(await page.locator('[data-testid=status]').textContent(), /Rendered/, `${mode}/${skin} failed`);
      };
      try {
        await page.goto('http://127.0.0.1:4200/'); await ready();
        phase = 'mode'; await page.selectOption('#mode',mode); await ready();
        phase = 'target'; await page.selectOption('#skin',skin); await ready();
        assert.deepEqual(errors, [], `${mode}/${skin}: browser or HTTP errors`);
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
  assert.ok(requests.size > 0, 'No localhost asset requests observed; check the demo server');
  const files = [...requests].sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0).map(([path, contexts]) => ({
    path, exists:assetExistsWithExactCase(root,path), contexts:[...contexts].sort()
  }));
  const missing = files.filter(file => !file.exists);
  const report = {schemaVersion:1, source:'synthetic demo requests; reference tree inspected read-only',
    combinations:modes.length * skins.length, uniqueRequests:files.length, missingCount:missing.length,
    limitations:['Observed default demo options only; advanced modes and other input values may require additional assets.',
      'Checks path existence and casing, not content integrity, rights or visual equivalence.'], files};
  mkdirSync(dirname(output), {recursive:true});
  writeFileSync(output, JSON.stringify(report,null,2)+'\n');
  console.log(`Observed ${files.length} distinct asset paths; ${missing.length} missing in the reference. Report: ${output}`);
  if (missing.length) process.exitCode = 2;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2)).catch(error => { console.error('COVERAGE AUDIT FAILED:',error.message); process.exitCode=1; });
}
