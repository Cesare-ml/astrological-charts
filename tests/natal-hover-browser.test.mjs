import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright-core';
import {build} from 'esbuild';

test('synthetic chart hover hides and restores aspects through redraw', {timeout:90000}, async () => {
  const chrome = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', chromium.executablePath()].filter(Boolean).find(existsSync);
  assert.ok(chrome, 'Set CHROME_PATH to Chromium');
  const root = resolve('.local/demo-pack/public');
  assert.ok(existsSync(join(root,'assets')), 'Generate the synthetic demo pack first');
  const html = join(root,'natal-hover-test.html');
  writeFileSync(html,'<!doctype html><meta charset="utf-8"><title>Synthetic hover</title>');
  const js = await build({entryPoints:['tests/fixtures/natal-hover-harness.ts'], bundle:true, write:false,
    platform:'browser', format:'iife', target:'es2022', tsconfig:'tsconfig.json'});
  const browser = await chromium.launch({headless:true, executablePath:chrome,
    args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--allow-file-access-from-files']});
  const page = await browser.newPage({viewport:{width:800,height:800}});
  try {
    await page.goto(pathToFileURL(html).href);
    await page.addScriptTag({content:js.outputFiles[0].text});
    await page.evaluate(base => globalThis.hoverHarness.init(base), pathToFileURL(join(root,'assets')+'/').href);
    const point = await page.evaluate(() => globalThis.hoverHarness.point('Jupiter'));
    await page.mouse.move(point.x, point.y);
    let state = await page.evaluate(() => globalThis.hoverHarness.state());
    assert.equal(state.last?.name,'Jupiter'); assert.equal(state.last.longitude,195); assert.equal(state.linesVisible,false);
    assert.equal(state.backgroundVisible,true);
    await page.evaluate(() => globalThis.hoverHarness.redraw());
    state = await page.evaluate(() => globalThis.hoverHarness.state());
    assert.equal(state.last?.name,'Jupiter'); assert.equal(state.linesVisible,false);
    await page.mouse.move(700,700);
    state = await page.evaluate(() => globalThis.hoverHarness.state());
    assert.equal(state.last,null); assert.equal(state.linesVisible,true);
    await page.evaluate(() => globalThis.hoverHarness.destroy());
  } finally { await browser.close(); }
});
