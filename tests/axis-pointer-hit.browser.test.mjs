import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {chromium, firefox} from 'playwright-core';

/** Read-only acceptance for REAL natal axis glyph picking in the Angular
 * synthetic demo. Unlike button-only focus, this dispatches actual mouse
 * events at the mesh's projected world position on the WebGL canvas.
 */
const browserName=process.env.CHART_TEST_BROWSER || 'chromium';
assert.ok(['chromium','firefox'].includes(browserName),
  'CHART_TEST_BROWSER must be chromium or firefox');
const candidates=browserName==='firefox'
  ? [process.env.FIREFOX_PATH,firefox.executablePath()]
  : [process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
const executablePath=candidates.filter(Boolean).find(existsSync);

async function launch(){
  assert.ok(executablePath,'Browser executable missing; set CHROME_PATH / FIREFOX_PATH');
  return browserName==='firefox'
    ? firefox.launch({executablePath,headless:true,firefoxUserPrefs:{
        'webgl.disabled':false,'webgl.force-enabled':true
      }})
    : chromium.launch({executablePath,headless:true,
        args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
}

async function ready(page,before=-1){
  await page.waitForFunction(previous=>{
    const status=document.querySelector('[data-testid=status]');
    const revision=Number(status?.getAttribute('data-render-revision'));
    return status?.textContent?.includes('Rendered') &&
      Number.isSafeInteger(revision) && revision>previous &&
      document.querySelector('#mode')?.disabled===false;
  },before,{timeout:30000});
}

async function selection(page,selector,expected){
  await page.waitForFunction(({selector,expected})=>
    document.querySelector(selector)?.textContent?.trim()===expected,
    {selector,expected},{timeout:10000});
}

/** Resolve chart objects through the same Angular DEV introspection
 * required by the companion canvas-pixel test. Fail closed if unavailable.
 * Never invent screen positions from displayed UI labels.
 */
async function liveChart(page){
  return page.evaluate(()=>{
    const host=document.querySelector('chart-demo');
    const component=globalThis.ng?.getComponent?.(host);
    const renderer=component?.renderer;
    const camera=renderer?.camera;
    const scene=renderer?.scene;
    const canvas=document.querySelector('canvas[data-testid=chart]');
    if(!camera || !scene || !canvas) return null;
    const gl=canvas.getContext('webgl2') || canvas.getContext('webgl');
    if(!gl || gl.isContextLost()) return null;
    camera.updateMatrixWorld(true);
    scene.updateMatrixWorld(true);
    const projection=camera.projectionMatrix.elements.slice();
    return {
      scene:scene.uuid,
      camera:camera.uuid,
      zoom:camera.zoom,
      position:camera.position.toArray(),
      quaternion:camera.quaternion.toArray(),
      projection,
      viewport:[canvas.width,canvas.height],
      buffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],
      revision:Number(document.querySelector('[data-testid=status]')
        ?.getAttribute('data-render-revision'))
    };
  });
}

function assertLive(state,label){
  assert.ok(state,label+': real debug scene/renderer/WebGL unavailable');
  assert.ok(typeof state.scene==='string' && state.scene.length,label+': scene missing');
  assert.ok(typeof state.camera==='string' && state.camera.length,label+': camera missing');
  assert.ok(Number.isFinite(state.zoom) && state.zoom>0,label+': invalid camera zoom');
  assert.ok(Array.isArray(state.projection) && state.projection.length===16 &&
    state.projection.every(Number.isFinite),label+': invalid projection matrix');
  assert.ok(state.buffer.every(n=>Number.isSafeInteger(n) && n>0),
    label+': empty WebGL drawing buffer');
}

/** Project the genuine tagged THREE.Mesh origin to canvas CSS coordinates.
 * The mesh must be attached to the currently rendered scene, visible through
 * every ancestor, and its center must lie within the canvas bounds.
 */
async function axisPoint(page,name){
  return page.evaluate(name=>{
    const component=globalThis.ng?.getComponent?.(document.querySelector('chart-demo'));
    const renderer=component?.renderer,scene=renderer?.scene,camera=renderer?.camera;
    const canvas=document.querySelector('canvas[data-testid=chart]');
    if(!scene || !camera || !canvas) return null;
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    const rect=canvas.getBoundingClientRect();
    let point=null;
    scene.traverse(object=>{
      if(point || !object.isMesh || object.userData?.chartPlanet?.layer!=='natal'
        || object.userData.chartPlanet.name!==name) return;
      for(let parent=object;parent;parent=parent.parent) if(!parent.visible) return;
      const materials=Array.isArray(object.material)?object.material:[object.material];
      if(!materials.some(m=>m?.visible && (!m.transparent || m.opacity>0)))return;
      const world=object.getWorldPosition(object.position.clone());
      world.project(camera);
      if(![world.x,world.y,world.z].every(Number.isFinite) ||
        world.x<=-0.98 || world.x>=0.98 || world.y<=-0.98 || world.y>=0.98 ||
        world.z<-1 || world.z>1) return;
      point={x:rect.left+(world.x+1)*rect.width/2,
        y:rect.top+(1-world.y)*rect.height/2,
        uuid:object.uuid};
    });
    return point;
  },name);
}

test('natal AS/DS/MC/IC WebGL glyphs support real hover and click without zoom',
  {timeout:180000},async()=>{
    const browser=await launch();
    const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    try{
      await page.goto('http://127.0.0.1:4200/',{waitUntil:'domcontentloaded'});
      await ready(page);
      const previous=Number(await page.locator('[data-testid=status]')
        .getAttribute('data-render-revision'));
      await page.selectOption('#mode','transits');
      await ready(page,previous);
      const baseline=await liveChart(page);
      assertLive(baseline,'baseline');
      for(const axis of ['AS','DS','MC','IC']){
        const point=await axisPoint(page,axis);
        assert.ok(point,axis+': missing/hidden/outside-canvas natal glyph mesh');
        await page.mouse.move(point.x,point.y);
        await selection(page,'[data-testid=planet-hover]','natal:'+axis);
        await selection(page,'[data-testid=planet-selection]','natal:'+axis);
        await page.mouse.click(point.x,point.y);
        await selection(page,'[data-testid=planet-event]','click natal:'+axis);
        const after=await liveChart(page);
        assertLive(after,axis);
        assert.deepEqual(after,baseline,axis+': pointer focus/click changed camera, zoom or scene');

        // Leaving the canvas clears hover but does not unpin a user-selected axis.
        await page.mouse.move(2,2);
        await selection(page,'[data-testid=planet-hover]','None');
        await selection(page,'[data-testid=planet-selection]','natal:'+axis);
        await page.locator('#clear-focus').click();
        await selection(page,'[data-testid=planet-selection]','None');
        assert.deepEqual(await liveChart(page),baseline,
          axis+': clearing pointer-selected axis changed camera or canvas');
      }
      assert.deepEqual(errors,[],'browser errors during real axis picking');
    }finally{
      await page.close();
      await browser.close();
    }
  });
