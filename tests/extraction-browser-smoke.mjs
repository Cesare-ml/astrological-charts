import { chromium } from 'playwright-core';
import { build } from 'esbuild';
import sharp from 'sharp';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
if (!process.env.CHART_EXTRACT_DIR) throw new Error('Set CHART_EXTRACT_DIR to the extraction checkout directory');
const source = resolve(process.env.CHART_EXTRACT_DIR,'src/public-api.ts').replaceAll('\\','/');
if (!existsSync(source)) throw new Error('Extraction public API not found: '+source);
const executablePath = [process.env.CHROME_PATH,'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean).find(existsSync);
if (!executablePath) throw new Error('Set CHROME_PATH to a Chromium executable');
const entry = `
import '@angular/compiler';
import {ElementRef} from '@angular/core';
import {GraficoRenderService,GestoreImmagini,defaultOpzioniGrafico} from ${JSON.stringify(source)};
const names=['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'];
const longitudes=[15,75,42,103,135,195,255,278,308,338];
function theme(off){const ascendant=(20+off)%360,mc=(290+off)%360;return {dataora:'2000-01-01T12:00:00Z',as:ascendant,ds:(ascendant+180)%360,mc,ic:(mc+180)%360,planets:Object.fromEntries(names.map((name,i)=>[name,{longitude:(longitudes[i]+off)%360,latitude:(i%2?-1:1)*(0.5+i*.28),longitudeSpeed:i===7?-.04:.2,latitudeSpeed:i%2?-.02:.03,equatoriale:{declination:-12+i*2.4}}])),houses:{egizia:{ascendant,mc,vertex:(ascendant+140)%360,house:Array.from({length:12},(_,i)=>(ascendant+i*30)%360)}},australInversion:false,fasiSinodiche:{},fasiSinodicheLatitudinali:{},lunazioniErmetiche:{},astrologiaOraria:{},orePlanetarie:{},partiArabe:{}}}
const radix=theme(0), transit=theme(24), synastry=theme(71), service=new GraficoRenderService();
GestoreImmagini.assetsBase='http://127.0.0.1:4177/';
const canvas=document.createElement('canvas');canvas.id='pr1-smoke';Object.assign(canvas.style,{width:'400px',height:'400px',position:'fixed',left:'0',top:'0',zIndex:'10000'});document.body.appendChild(canvas);
service.inizializzaGraficoRender(new ElementRef(canvas),{x:400,y:400});
function opts(mode,skin){const o=structuredClone(defaultOpzioniGrafico);o.settaggi.skin_id=skin;o.temaGrafico=skin;o.mostraTransiti=mode==='transits';o.mostraSinastria=mode==='synastry';for(const b of names){o.settaggi.elementi_celesti[b].att=true;o.settaggi.elementi_celesti[b].aspVerso=true}return o}
window.pr1smoke={draw:async(mode,skin)=>service.disegnaScena(radix,mode==='transits'?transit:null,mode==='synastry'?synastry:null,mode==='latitude'?'latitudini':'carta-astrale',opts(mode,skin)),png:()=>service.generaImmagine(radix,null,null,'carta-astrale',opts('natal','light'),{x:400,y:400},1),destroy:()=>{service.ngOnDestroy();canvas.remove()}};`;
const bundle=await build({stdin:{contents:entry,resolveDir:process.cwd(),sourcefile:'pr1-harness.ts'},nodePaths:[resolve('node_modules')],bundle:true,write:false,platform:'browser',format:'iife',target:'es2022',tsconfig:'tsconfig.json'});
const browser=await chromium.launch({headless:true,executablePath,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[],failures=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failures.push(r.status()+' '+r.url())});
try{
await page.goto('http://127.0.0.1:4200/');await page.waitForFunction(()=>document.querySelector('[data-testid=status]')?.textContent.includes('Rendered'),{timeout:30000});await page.addScriptTag({content:bundle.outputFiles[0].text});
const modes=['natal','transits','synastry','latitude'],skins=['dark','dark-bn','light','light-bn','sun','astrolabio','astrolabio-girasole'],hashes=new Set();
for(const mode of modes)for(const skin of skins){await page.evaluate(({mode,skin})=>window.pr1smoke.draw(mode,skin),{mode,skin}); const png=await page.locator('#pr1-smoke').screenshot();const {data,info}=await sharp(png).resize(100,100).removeAlpha().raw().toBuffer({resolveWithObject:true});const colors=new Set();for(let i=0;i<data.length;i+=info.channels)colors.add(data[i]+','+data[i+1]+','+data[i+2]);if(colors.size<=10)throw Error('blank '+mode+'/'+skin);if(skin==='light')hashes.add(createHash('sha256').update(data).digest('hex'));}
if(hashes.size!==4)throw Error('chart modes are not distinct');const dataurl=await page.evaluate(()=>window.pr1smoke.png());const metadata=await sharp(Buffer.from(dataurl.split(',')[1],'base64')).metadata();if(metadata.width!==400||metadata.height!==400)throw Error('wrong PNG dimensions: '+JSON.stringify(metadata));if(errors.length||failures.length)throw Error(JSON.stringify({errors,failures}));console.log('PR1 synthetic browser smoke: 28 charts, four distinct modes, PNG 400x400, no page or HTTP errors.');
}finally{await browser.close()}
