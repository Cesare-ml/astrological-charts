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
    assert.deepEqual(await page.evaluate(() => globalThis.hoverHarness.axisGlyphs()), []);
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
    for (const [name,id,longitude] of [['ASC','AS',20],['DS','DS',200],['MC','MC',290],['IC','IC',110]]) {
      const axis = await page.evaluate(value => globalThis.hoverHarness.axisPoint(value),name);
      await page.mouse.move(axis.x,axis.y);
      state = await page.evaluate(() => globalThis.hoverHarness.state());
      assert.equal(state.last?.name,id); assert.equal(state.last.longitude,longitude);
      assert.equal(state.linesVisible,false);
      const marker = await page.evaluate(value => globalThis.hoverHarness.axisMarkerPoint(value),name);
      await page.mouse.move(marker.x,marker.y);
      state = await page.evaluate(() => globalThis.hoverHarness.state());
      assert.equal(state.last?.name,id);
    }
    for (const [name,longitude] of [['true Node',72],['osc. Apogee',135],['Tyche',240]]) {
      const glyph = await page.evaluate(value => globalThis.hoverHarness.point(value),name);
      await page.mouse.move(glyph.x,glyph.y);
      state = await page.evaluate(() => globalThis.hoverHarness.state());
      assert.equal(state.last?.name,name); assert.equal(state.last.longitude,longitude);
    }
    await page.evaluate(() => globalThis.hoverHarness.initTransits());
    state = await page.evaluate(() => globalThis.hoverHarness.transitState());
    assert.ok(state.opacity > 0 && state.opacity <= .22, `natal aspects are translucent: ${JSON.stringify(state)}`);
    assert.equal(state.vertexColors,false, 'geometry colors do not tint grey natal lines');
    for (const ring of ['transit','natal']) {
      const point = await page.evaluate(r => globalThis.hoverHarness.transitPoint('Jupiter',r), ring);
      await page.mouse.move(point.x,point.y);
      state = await page.evaluate(() => globalThis.hoverHarness.transitState());
      assert.equal(state.last?.ring,ring);
      assert.equal(state.last?.name,'Jupiter');
      assert.ok(state.lines > 0, 'the supplied cross-aspect is drawn');
    }
    for (const [name,id,longitude] of [['ASC','AS',72],['DS','DS',252],['MC','MC',342],['IC','IC',162]]) {
      const point = await page.evaluate(n => globalThis.hoverHarness.transitAxisPoint(n), name);
      await page.mouse.move(point.x,point.y);
      state = await page.evaluate(() => globalThis.hoverHarness.transitState());
      assert.equal(state.last?.ring,'transit');
      assert.equal(state.last?.name,id);
      assert.equal(state.last?.longitude,longitude);
    }
    await page.mouse.move(700,700);
    state = await page.evaluate(() => globalThis.hoverHarness.transitState());
    assert.equal(state.last,null); assert.equal(state.lines,0);
    await page.evaluate(() => globalThis.hoverHarness.restoreTransit());
    state = await page.evaluate(() => globalThis.hoverHarness.transitState());
    assert.equal(state.opacity,1, 'the original natal opacity is restored');
    assert.equal(state.vertexColors,true, 'the original line colors are restored');
    assert.equal(await page.evaluate(() => globalThis.hoverHarness.transitAxesCount(true,true)),4);
    assert.equal(await page.evaluate(() => globalThis.hoverHarness.transitAxesCount(false,true)),0);
    assert.equal(await page.evaluate(() => globalThis.hoverHarness.transitAxesCount(true,false)),0);
    let projected = await page.evaluate(() => globalThis.hoverHarness.projectionState('dodecatemoria','tutti'));
    assert.equal(projected.length,7);
    projected = await page.evaluate(() => globalThis.hoverHarness.projectionState('dodecatemoria','Sun'));
    assert.deepEqual(projected.map(item => [item.name,item.longitude]),[['Sun',35]]);
    projected = await page.evaluate(() => globalThis.hoverHarness.projectionState('antisci','tutti'));
    assert.deepEqual(projected.map(item => [item.name,item.longitude,item.kind]),[['Sun',181.6,'CircleGeometry'],['Moon',177.9,'CircleGeometry']]);
    projected = await page.evaluate(() => globalThis.hoverHarness.projectionState('contrantisci','tutti'));
    assert.deepEqual(projected.map(item => [item.name,item.longitude,item.kind]),[['Sun',1.6,'RingGeometry'],['Moon',357.9,'RingGeometry']]);
    projected = await page.evaluate(() => globalThis.hoverHarness.projectionState('antisci','Sun'));
    assert.deepEqual(projected.map(item => [item.name,item.longitude]),[['Sun',181.6]]);
    await page.evaluate(() => globalThis.hoverHarness.destroy());
  } finally { await browser.close(); }
});
