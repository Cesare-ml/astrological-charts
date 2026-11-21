#!/usr/bin/env node
/** Read-only QA audit for local Chromium/Firefox screenshots (not visual parity). */
import {createHash} from 'node:crypto';
import {lstatSync, readFileSync, readdirSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';

export const MODES = Object.freeze(['natal', 'transits', 'synastry', 'latitude']);
export const SKINS = Object.freeze([
  'dark', 'dark-bn', 'light', 'light-bn', 'sun', 'astrolabio', 'astrolabio-girasole'
]);
const SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');
const MAX_PNG_BYTES = 64 * 1024 * 1024;
const CRC_TABLE = Array.from({length:256}, (_, n) => {
  let c=n;
  for(let i=0; i<8; i++) c=(c&1) ? 0xedb88320^(c>>>1) : c>>>1;
  return c>>>0;
});
function crc32(bytes) {
  let crc=0xffffffff;
  for(const byte of bytes) crc=CRC_TABLE[(crc^byte)&255]^(crc>>>8);
  return (crc^0xffffffff)>>>0;
}

/** Validate PNG framing/checksums, not decoded pixels or original-artwork fidelity. */
export function pngDimensions(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length<45 || bytes.length>MAX_PNG_BYTES ||
      !bytes.subarray(0,8).equals(SIGNATURE)) throw new Error('Invalid PNG signature or size');
  let offset=8, width=0, height=0, hasIdat=false, hasIend=false, chunks=0;
  while(offset<bytes.length) {
    if (bytes.length-offset<12) throw new Error('Truncated PNG chunk');
    const length=bytes.readUInt32BE(offset);
    if (length>bytes.length-offset-12) throw new Error('Truncated PNG chunk payload');
    const type=bytes.toString('ascii',offset+4,offset+8);
    const dataEnd=offset+8+length;
    const actualCrc=bytes.readUInt32BE(dataEnd);
    if (actualCrc!==crc32(bytes.subarray(offset+4,dataEnd)))
      throw new Error('PNG chunk CRC mismatch: '+type);
    if (chunks++===0) {
      if (type!=='IHDR' || length!==13) throw new Error('Missing PNG IHDR');
      width=bytes.readUInt32BE(offset+8);
      height=bytes.readUInt32BE(offset+12);
      if (!width || !height || width>16384 || height>16384)
        throw new Error('Invalid PNG canvas dimensions');
    } else if (type==='IHDR') throw new Error('Duplicate PNG IHDR');
    if (type==='IDAT') hasIdat=true;
    if (type==='IEND') {
      if (length!==0 || !hasIdat || dataEnd+4!==bytes.length)
        throw new Error('Invalid PNG ending or trailing bytes');
      hasIend=true;
    }
    offset=dataEnd+4;
    if (hasIend) break;
  }
  if (!hasIdat || !hasIend) throw new Error('Incomplete PNG (IDAT/IEND missing)');
  return {width,height};
}

export function auditScreenshotSet(directory, browser) {
  if (browser!=='chromium' && browser!=='firefox') throw new Error('Unknown browser');
  const root=resolve(directory);
  const stat=lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Screenshot path must be a real directory: '+root);
  const entries=readdirSync(root);
  const stale=entries.filter(name=>/^repeat-.*\.png$/i.test(name));
  if (stale.length) throw new Error(browser+' has stale failed-repeat captures: '+stale.join(', '));
  const files=[];
  const byHash=new Map();
  let dimensions=null;
  for(const mode of MODES) for(const skin of SKINS) {
    const name=`${mode}-${skin}.png`;
    const file=join(root,name);
    let stat;
    try { stat=lstatSync(file); }
    catch(e) { if(e.code==='ENOENT') throw new Error(browser+' screenshot missing: '+name); throw e; }
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(browser+' screenshot is not a regular file: '+name);
    const bytes=readFileSync(file);
    let image;
    try { image=pngDimensions(bytes); }
    catch(e) { throw new Error(browser+' '+name+': '+e.message); }
    if (!dimensions) dimensions=image;
    else if (image.width!==dimensions.width || image.height!==dimensions.height)
      throw new Error(browser+' inconsistent canvas dimensions: '+name);
    const sha256=createHash('sha256').update(bytes).digest('hex');
    if (byHash.has(sha256)) throw new Error(browser+' duplicate screenshot pixels/file bytes: '+byHash.get(sha256)+' and '+name);
    byHash.set(sha256,name);
    files.push({mode,skin,filename:name,sha256,bytes:bytes.length});
  }
  return {browser,root,dimension:dimensions,count:files.length,files};
}

export function auditBrowserScreenshots(chromiumDir,firefoxDir) {
  const chromium=auditScreenshotSet(chromiumDir,'chromium');
  const firefox=auditScreenshotSet(firefoxDir,'firefox');
  if (chromium.dimension.width!==firefox.dimension.width ||
      chromium.dimension.height!==firefox.dimension.height)
    throw new Error('Chromium/Firefox screenshot canvas dimensions differ');
  return {
    schemaVersion:1,status:'SCREENSHOT_FILES_COMPLETE',expectedPerBrowser:MODES.length*SKINS.length,
    browsers:[chromium,firefox],
    limitations:[
      'Requires completed current Chromium and Firefox test:demo runs; PNG file timestamps are not proof of current-commit provenance.',
      'Checks PNG chunk CRC, frame size, complete 4x7 naming and byte-distinct captures; does not decode pixels or prove visual/production-artwork parity.',
      'Does not measure GPU resources or test PNG exports, mobile view, offline Astrolabio or real devices.'
    ]
  };
}

function cli(args) {
  if (args.length!==4 || args[0]!=='--chromium' || args[2]!=='--firefox' ||
      !args[1] || !args[3]) throw new Error('Usage: node scripts/audit-browser-screenshots.mjs --chromium <dir> --firefox <dir>');
  process.stdout.write(JSON.stringify(auditBrowserScreenshots(args[1],args[3]),null,2)+'\n');
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try { cli(process.argv.slice(2)); }
  catch(e) { console.error('SCREENSHOT AUDIT FAILED: '+e.message); process.exitCode=1; }
}
