import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {build} from 'esbuild';
import {chromium} from 'playwright-core';

const chrome=[process.env.CHROME_PATH,'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/chromium','/usr/bin/google-chrome','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
  .filter(Boolean).find(existsSync);

test('a rendered chakra highlights the outer part of a hovered sector and clears it on exit',
  {skip:!chrome,timeout:30000},async()=>{
  const source=await build({stdin:{contents:`
    import * as THREE from 'three';
    import {creaChakra} from './src/lib/renderers/@carta-astrale/carta-astrale.renderer';
    import {ChakraHoverController} from './src/lib/services/chakra-hover';
    window.startChakra=async()=>{
      const canvas=document.querySelector('canvas');
      const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
      renderer.setSize(600,600);renderer.setPixelRatio(1);
      const scene=new THREE.Scene();scene.background=new THREE.Color('#ffffff');
      const camera=new THREE.OrthographicCamera(-2,2,2,-2,.1,100);camera.position.z=5;camera.updateProjectionMatrix();
      scene.add(await creaChakra({opzioni:{chakramAttivi:true,chakram:'Swadhisthana'},
        diametri:{diametroCerchioAspetti:2,diametroInternoAnelloCase:3}}));
      window.lastChakra=null;
      window.controller=new ChakraHoverController(canvas,()=>scene,()=>camera,value=>{window.lastChakra=value;renderer.render(scene,camera);});
      renderer.render(scene,camera);
    };
  `,resolveDir:process.cwd(),loader:'ts'},bundle:true,format:'iife',platform:'browser',write:false});
  const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:600,height:600},deviceScaleFactor:1});
  try {
    await page.setContent('<style>html,body{margin:0}</style><canvas></canvas>');
    await page.addScriptTag({content:source.outputFiles[0].text});
    await page.evaluate(()=>window.startChakra());
    const before=await page.locator('canvas').screenshot();
    // This point lies beyond the former polygon, but within the inner circle.
    await page.mouse.move(510,300);
    assert.deepEqual(await page.evaluate(()=>window.lastChakra),{chakra:'Swadhisthana',sector:3});
    const hovered=await page.locator('canvas').screenshot();
    assert.notDeepEqual(hovered,before);
    await page.mouse.move(545,300);
    assert.equal(await page.evaluate(()=>window.lastChakra),null);
    const after=await page.locator('canvas').screenshot();
    assert.deepEqual(after,before);
  } finally {await browser.close();}
});
