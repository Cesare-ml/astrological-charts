#!/usr/bin/env node
/**
 * Build ORIGINAL synthetic PNG test assets locally (NEVER production artwork).
 * No network, images from VirgoStars, external packages, or permissions required.
 */
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=join(root,'src/lib/renderers/gestore-immagini.ts');
const PNG_SIGNATURE=Buffer.from('89504e470d0a1a0a','hex');
const CRC_TABLE=Array.from({length:256},(_,n)=>{
  let c=n;
  for(let i=0;i<8;i++) c=c&1 ? 0xedb88320^(c>>>1) : c>>>1;
  return c>>>0;
});
function chunk(type,buffer) {
  const label=Buffer.from(type,'ascii');
  const len=Buffer.alloc(4);len.writeUInt32BE(buffer.length);
  const payload=Buffer.concat([label,buffer]);
  let crc=0xffffffff;
  for(const b of payload) crc=CRC_TABLE[(crc^b)&0xff]^(crc>>>8);
  const tail=Buffer.alloc(4);tail.writeUInt32BE((crc^0xffffffff)>>>0);
  return Buffer.concat([len,payload,tail]);
}
export function makeSyntheticPng(seed) {
  const width=48,height=48;
  const salt=createHash('sha256').update(seed).digest();
  const ihdr=Buffer.alloc(13);
  ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);
  ihdr[8]=8;ihdr[9]=6; // RGBA8
  const rgba=Buffer.alloc((width*4+1)*height);
  for(let y=0;y<height;y++) {
    const offset=y*(width*4+1);rgba[offset]=0;
    for(let x=0;x<width;x++){
      const pos=offset+1+x*4;
      const border=x<3||y<3||x>=width-3||y>=height-3;
      const checker=(Math.floor(x/8)+Math.floor(y/8))%2===0;
      const bright=border?25:checker?35:0;
      rgba[pos]=Math.min(255,salt[0]+bright);
      rgba[pos+1]=Math.min(255,salt[1]+bright);
      rgba[pos+2]=Math.min(255,salt[2]+bright);
      rgba[pos+3]=255;
    }
  }
  return Buffer.concat([
    PNG_SIGNATURE,chunk('IHDR',ihdr),chunk('IDAT',deflateSync(rgba)),chunk('IEND',Buffer.alloc(0))
  ]);
}
export function sourcePreloadPaths(text) {
  const start=text.indexOf('public static preloadArraySimboli');
  if(start<0)throw new Error('Preload list missing in extracted renderer');
  const match=text.slice(start).match(/=\s*\[([\s\S]*?)\]\s*[;}]/);
  if(!match)throw new Error('Preload list is no longer a static literal array');
  const paths=[...match[1].matchAll(/["'](\/assets\/img\/[^"']+\.png)["']/g)]
    .map(m=>m[1].replace(/^\/assets\//,''));
  if(paths.length!==78||new Set(paths).size!==78)
    throw new Error('Expected exactly 78 unique source preload paths, got '+paths.length);
  return paths.sort();
}
export function generateSyntheticPack(outputDir,sourceText=readFileSync(source,'utf8')) {
  const destination=resolve(outputDir);
  if(existsSync(destination))
    throw new Error('Synthetic output already exists. Use a new empty directory or delete it manually: '+destination);
  const files=sourcePreloadPaths(sourceText);
  const records=[];
  for(const path of files) {
    const bytes=makeSyntheticPng(path);
    const target=join(destination,'public/assets',...path.split('/'));
    mkdirSync(dirname(target),{recursive:true});
    writeFileSync(target,bytes,{flag:'wx'});
    records.push({
      path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),
      rightsHolder:'Astrological Charts synthetic test fixture',
      permissionBasis:'Original synthetic checkerboard data generated locally; not VirgoStars artwork',
      approvalEvidence:'scripts/generate-synthetic-pack.mjs (automatically generated development fixture)',
    });
  }
  const manifest={schemaVersion:1,source:{repository:'synthetic-local-fixtures',commit:'none',assetRoot:'public/assets'},assets:records};
  const manifestPath=join(destination,'manifests','approved-assets.json');
  mkdirSync(dirname(manifestPath),{recursive:true});
  writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  return {root:join(destination,'public/assets'),manifestPath,manifest};
}
function run(args) {
  if(args.length!==2||args[0]!=='--out')
    throw new Error('Usage: node scripts/generate-synthetic-pack.mjs --out .local/synthetic-pack');
  const result=generateSyntheticPack(args[1]);
  console.log('Created '+result.manifest.assets.length+' ORIGINAL synthetic PNG placeholders.');
  console.log('Image root: '+result.root);
  console.log('Manifest: '+result.manifestPath);
  console.log('These are checkerboard fixtures, NOT actual VirgoStars symbols.');
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){
  try{run(process.argv.slice(2));}
  catch(e){console.error('SYNTHETIC PACK ERROR:',e.message);process.exitCode=1;}
}
