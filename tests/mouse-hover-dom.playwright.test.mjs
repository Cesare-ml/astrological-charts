import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { chromium } from 'playwright-core';
import ts from 'typescript';

// Optional standalone DOM/layout acceptance: actual browser events and canvas
// bounding boxes, with only Three.js raycast decisions replaced by test hits.
// Not a WebGL, renderer, glyph-pixel or real focus visual validation.
const source = readFileSync(new URL('../src/lib/renderers/@gestore-eventi-mouse.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const candidatePaths = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].filter(Boolean);

test('Chromium DOM hover, resize, blur and two-canvas isolation without zoom', { timeout: 45000 }, async () => {
  const executablePath = candidatePaths.find(existsSync);
  assert.ok(executablePath, 'Chromium not found; set CHROME_PATH');
  const args = [];
  if (process.env.CHART_BROWSER_NO_SANDBOX === '1') args.push('--no-sandbox');
  const browser = await chromium.launch({executablePath, headless: true, timeout: 20000, args});
  try {
    const page = await browser.newPage({viewport:{width:1000,height:700}});
    await page.setContent('<!doctype html><style>*{box-sizing:border-box}body{margin:0}#a{position:absolute;left:100px;top:50px;width:200px;height:100px}#b{position:absolute;left:500px;top:50px;width:200px;height:100px}</style><canvas id="a"></canvas><canvas id="b"></canvas>');
    const result = await page.evaluate((js) => {
      class Raycaster {
        setFromCamera(point) { this.last = {x:point.x,y:point.y}; }
        intersectObjects() { return this.scene.hits.map(object=>({object})); }
      }
      class Vector2 {
        x=0; y=0;
        set(x,y) { this.x=x;this.y=y;return this; }
      }
      const mod = {exports:{}};
      new Function('require','module','exports',js)(id => {
        if (id !== 'three') throw new Error('Unexpected runtime dependency '+id);
        return {Raycaster,Vector2};
      },mod,mod.exports);
      const {GestoreEventiMouse} = mod.exports;
      const a = document.querySelector('#a'), b=document.querySelector('#b');
      const camera={zoom:1,position:{z:3}};
      const sun={name:'Sun'}, moon={name:'Moon'};
      const scene={hits:[sun],children:[]};
      const events=[];
      const manager=new GestoreEventiMouse(a,camera,scene,{
        onHoverEnter: o=>events.push('enter:'+o.name),
        onHoverLeave: o=>events.push('leave:'+o.name),
        onClick: o=>events.push('click:'+o.name)
      });
      manager.raycaster.scene=scene;
      const expect=(actual, expected, why)=>{
        if(JSON.stringify(actual)!==JSON.stringify(expected))
          throw new Error(why+': '+JSON.stringify(actual)+' instead of '+JSON.stringify(expected));
      };
      const move=(el,x,y)=>el.dispatchEvent(new MouseEvent('mousemove',{clientX:x,clientY:y,bubbles:true}));
      const rect=a.getBoundingClientRect();
      expect([rect.left,rect.top,rect.width,rect.height],[100,50,200,100],'layout');
      move(a,200,100);
      expect(events,['enter:Sun'],'initial hover');
      expect([manager.raycaster.last.x,manager.raycaster.last.y],[0,0],'initial NDC');
      a.style.width='400px'; a.style.height='200px';
      window.dispatchEvent(new Event('resize'));
      expect([manager.raycaster.last.x,manager.raycaster.last.y],[-0.5,0.5],'resize NDC');
      expect(events,['enter:Sun'],'no duplicate hover');
      scene.hits=[moon];
      move(a,200,100);
      window.dispatchEvent(new Event('blur'));
      window.dispatchEvent(new Event('resize'));
      expect(events,['enter:Sun','leave:Sun','enter:Moon','leave:Moon'],'hover transition + blur');
      a.dispatchEvent(new MouseEvent('click',{clientX:999,clientY:999,bubbles:true}));
      expect(events.length,4,'outside click ignored');
      a.dispatchEvent(new MouseEvent('click',{clientX:200,clientY:100,bubbles:true}));
      expect(events.at(-1),'click:Moon','inside click');
      manager.distruggi();
      const afterDestroy=events.length;
      move(a,200,100);
      expect(events.length,afterDestroy,'destroyed handler ignored');
      const sceneA={hits:[sun],children:[]}, sceneB={hits:[moon],children:[]};
      const eA=[],eB=[];
      const one=new GestoreEventiMouse(a,camera,sceneA,{
        onHoverEnter:o=>eA.push('enter:'+o.name),
        onHoverLeave:o=>eA.push('leave:'+o.name)
      });
      const two=new GestoreEventiMouse(b,camera,sceneB,{
        onHoverEnter:o=>eB.push('enter:'+o.name),
        onHoverLeave:o=>eB.push('leave:'+o.name)
      });
      one.raycaster.scene=sceneA; two.raycaster.scene=sceneB;
      move(a,200,100);move(b,600,100);
      expect(eA,['enter:Sun'],'first canvas');
      expect(eB,['enter:Moon'],'second canvas');
      one.distruggi();
      window.dispatchEvent(new Event('blur'));
      expect(eA,['enter:Sun','leave:Sun'],'first canvas released');
      expect(eB,['enter:Moon','leave:Moon'],'second canvas retained listener');
      two.distruggi();
      expect([camera.zoom,camera.position.z],[1,3],'camera unchanged');
      return {events,eA,eB,zoom:camera.zoom};
    },compiled);
    assert.equal(result.zoom,1);
    assert.deepEqual(result.eA,['enter:Sun','leave:Sun']);
    assert.deepEqual(result.eB,['enter:Moon','leave:Moon']);
  } finally { await browser.close(); }
});
