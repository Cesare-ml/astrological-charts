import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {MODES, SKINS, pngDimensions, auditScreenshotSet, auditBrowserScreenshots} from '../scripts/audit-browser-screenshots.mjs';

const cli=fileURLToPath(new URL('../scripts/audit-browser-screenshots.mjs',import.meta.url));

const CRC_TABLE=Array.from({length:256},(_,n)=>{
  let c=n; for(let i=0;i<8;i++) c=(c&1) ? 0xedb88320^(c>>>1) : c>>>1;
  return c>>>0;
});
function chunk(type,data) {
  const header=Buffer.alloc(8);
  header.writeUInt32BE(data.length,0);
  header.write(type,4,4,'ascii');
  const checksum=Buffer.alloc(4);
  let crc=0xffffffff;
  for(const b of Buffer.concat([header.subarray(4),data])) crc=CRC_TABLE[(crc^b)&255]^(crc>>>8);
  checksum.writeUInt32BE((crc^0xffffffff)>>>0);
  return Buffer.concat([header,data,checksum]);
}
function makeSyntheticPng(seed) {
  const digest=createHash('sha256').update(seed).digest();
  const head=Buffer.alloc(13);
  head.writeUInt32BE(48,0);head.writeUInt32BE(48,4);
  head[8]=8;head[9]=6;
  const pixels=Buffer.alloc((48*4+1)*48);
  for(let y=0;y<48;y++) for(let x=0;x<48;x++) {
    const i=y*(48*4+1)+1+x*4;
    pixels[i]=digest[0];pixels[i+1]=digest[1];pixels[i+2]=digest[2];pixels[i+3]=255;
  }
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a','hex'),
    chunk('IHDR',head),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))
  ]);
}

function withMatrix(callback) {
  const root=mkdtempSync(join(tmpdir(),'charts-screen-matrix-'));
  const chromium=join(root,'chromium'), firefox=join(root,'firefox');
  try {
    for(const [browser,dir] of [['chromium',chromium],['firefox',firefox]]) {
      mkdirSync(dir);
      for(const mode of MODES) for(const skin of SKINS) {
        writeFileSync(join(dir,`${mode}-${skin}.png`), makeSyntheticPng(`${browser}/${mode}/${skin}`));
      }
    }
    return callback({root,chromium,firefox});
  } finally { rmSync(root,{recursive:true,force:true}); }
}
test('checks all 28 screenshots per browser without changing source files',()=>withMatrix(({chromium,firefox})=>{
  const report=auditBrowserScreenshots(chromium,firefox);
  assert.equal(report.status,'SCREENSHOT_FILES_COMPLETE');
  assert.equal(report.expectedPerBrowser,28);
  assert.deepEqual(report.browsers.map(b=>b.count),[28,28]);
  assert.deepEqual(report.browsers.map(b=>b.dimension),[{width:48,height:48},{width:48,height:48}]);
  assert.equal(new Set(report.browsers[0].files.map(f=>f.sha256)).size,28);
  assert.deepEqual(Object.keys(report.browsers[0].files[0]).sort(),['bytes','filename','mode','sha256','skin']);
}));
test('CLI returns JSON with 56 hashed images and exit zero',()=>withMatrix(({chromium,firefox})=>{
  const proc=spawnSync(process.execPath,[cli,'--chromium',chromium,'--firefox',firefox],{encoding:'utf8'});
  assert.equal(proc.status,0,proc.stderr);
  assert.equal(JSON.parse(proc.stdout).browsers.reduce((n,b)=>n+b.count,0),56);
}));
test('missing one skin or mode is a hard failure',()=>withMatrix(({chromium})=>{
  rmSync(join(chromium,'latitude-astrolabio-girasole.png'));
  assert.throws(()=>auditScreenshotSet(chromium,'chromium'),/screenshot missing: latitude-astrolabio-girasole.png/);
}));
test('copied or stale screenshots cannot pass as distinct results',()=>withMatrix(({chromium})=>{
  copyFileSync(join(chromium,'natal-dark.png'),join(chromium,'natal-dark-bn.png'));
  assert.throws(()=>auditScreenshotSet(chromium,'chromium'),/duplicate screenshot/);
}));
test('a leftover failed-repeat artifact blocks a clean acceptance report',()=>withMatrix(({firefox})=>{
  writeFileSync(join(firefox,'repeat-transits-sun.png'),makeSyntheticPng('leftover'));
  assert.throws(()=>auditScreenshotSet(firefox,'firefox'),/stale failed-repeat/);
}));
test('damaged PNG chunks and truncated files are rejected',()=>withMatrix(({chromium})=>{
  const path=join(chromium,'natal-dark.png');
  const good=readFileSync(path);
  for(const bad of [Buffer.from('not a PNG'),good.subarray(0,good.length-6),(()=>{const b=Buffer.from(good);b[50]^=255;return b;})()]) {
    writeFileSync(path,bad);
    assert.throws(()=>auditScreenshotSet(chromium,'chromium'),/PNG/);
  }
}));
test('one wrong canvas size cannot contaminate a 28-case report',()=>withMatrix(({firefox})=>{
  const path=join(firefox,'natal-dark-bn.png');
  const bytes=readFileSync(path);
  // A different size in the IHDR with a corrected CRC is sufficient for
  // this structural check; the audit does not decode its pixel stream.
  bytes.writeUInt32BE(49,16);
  let crc=0xffffffff;
  for(const v of bytes.subarray(12,29)) {
    crc ^=v;
    for(let i=0;i<8;i++) crc=(crc&1) ? 0xedb88320^(crc>>>1) : crc>>>1;
  }
  bytes.writeUInt32BE((crc^0xffffffff)>>>0,29);
  writeFileSync(path,bytes);
  assert.deepEqual(pngDimensions(bytes),{width:49,height:48});
  assert.throws(()=>auditScreenshotSet(firefox,'firefox'),/inconsistent canvas dimensions/);
}));
test('cross-browser mismatch and missing CLI arguments fail',()=>withMatrix(({chromium,firefox})=>{
  const proc=spawnSync(process.execPath,[cli,'--chromium',chromium],{encoding:'utf8'});
  assert.equal(proc.status,1);
  assert.match(proc.stderr,/SCREENSHOT AUDIT FAILED/);
  const before=readFileSync(join(firefox,'natal-dark.png'));
  const modified=Buffer.from(before);
  modified.writeUInt32BE(49,16);
  let crc=0xffffffff;
  for(const v of modified.subarray(12,29)) {
    crc ^=v;
    for(let i=0;i<8;i++) crc=(crc&1) ? 0xedb88320^(crc>>>1) : crc>>>1;
  }
  modified.writeUInt32BE((crc^0xffffffff)>>>0,29);
  for(const mode of MODES) for(const skin of SKINS) {
    // Each image must retain distinct content, even after the fixed header changes.
    const p=join(firefox,`${mode}-${skin}.png`);
    const b=readFileSync(p);modified.copy(b,12,12,33);writeFileSync(p,b);
  }
  assert.throws(()=>auditBrowserScreenshots(chromium,firefox),/dimensions differ/);
}));
