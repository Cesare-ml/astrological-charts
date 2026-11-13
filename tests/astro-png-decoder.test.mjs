import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crc32, deflateSync } from 'node:zlib';
import { verifyWhiteAlphaPng } from '../scripts/png-mask-pixels.mjs';

// No sharp, Angular, downloaded glyphs, browser, network, or owner artwork.
// Synthesize tiny compressed 512x512 RGBA PNG fixtures in memory.
const SIGNATURE = Buffer.from('89504e470d0a1a0a','hex');
const WIDTH=512, HEIGHT=512, BPP=4, STRIDE=WIDTH*BPP;
const COVERAGE=40*HEIGHT; // 0,13,...,507 are the 40 visible pixels per row.

function chunk(type, bytes=Buffer.alloc(0)) {
  const name=Buffer.from(type,'ascii');
  const len=Buffer.alloc(4);len.writeUInt32BE(bytes.length);
  const check=Buffer.alloc(4);
  check.writeUInt32BE(crc32(Buffer.concat([name,bytes])));
  return Buffer.concat([len,name,bytes,check]);
}
function paeth(left,up,upperLeft) {
  const p=left+up-upperLeft;
  const a=Math.abs(p-left),b=Math.abs(p-up),c=Math.abs(p-upperLeft);
  return a<=b&&a<=c ? left : b<=c ? up : upperLeft;
}
function png({filter=0,corruptTransparent=false,interlaced=false,extraChunks=0,invalidFilter=false}={}) {
  const header=Buffer.alloc(13);
  header.writeUInt32BE(WIDTH,0);header.writeUInt32BE(HEIGHT,4);
  header[8]=8;header[9]=6;header[12]=interlaced?1:0;
  const filtered=Buffer.alloc(HEIGHT*(STRIDE+1));
  const old=Buffer.alloc(STRIDE);
  for(let y=0;y<HEIGHT;y++) {
    const scanline=Buffer.alloc(STRIDE);
    for(let x=0;x<WIDTH;x++) {
      const pos=x*BPP;
      const covered=x%13===0;
      scanline[pos]=255;scanline[pos+1]=255;scanline[pos+2]=255;
      scanline[pos+3]=covered?200:0;
    }
    if(corruptTransparent&&y===0) {
      // RGB black beneath alpha=0: invisible until bilinear texture filtering.
      scanline[4]=0;scanline[5]=0;scanline[6]=0;
    }
    const start=y*(STRIDE+1);
    filtered[start]=invalidFilter&&y===0?5:filter;
    for(let i=0;i<STRIDE;i++) {
      const left=i>=BPP?scanline[i-BPP]:0;
      const up=old[i];
      const upperLeft=i>=BPP?old[i-BPP]:0;
      let predictor=0;
      if(filter===1)predictor=left;
      else if(filter===2)predictor=up;
      else if(filter===3)predictor=Math.floor((left+up)/2);
      else if(filter===4)predictor=paeth(left,up,upperLeft);
      filtered[start+1+i]=(scanline[i]-predictor)&255;
    }
    scanline.copy(old);
  }
  const metadata=Array.from({length:extraChunks},()=>chunk('tEXt'));
  return Buffer.concat([SIGNATURE,chunk('IHDR',header),...metadata,
    chunk('IDAT',deflateSync(filtered)),chunk('IEND')]);
}

for(const filter of [0,1,2,3,4]) {
  test('PNG unfilter mode '+filter+' preserves approved white RGB and alpha coverage',()=>{
    const result=verifyWhiteAlphaPng(png({filter}),COVERAGE);
    assert.deepEqual(result,{
      width:WIDTH,height:HEIGHT,visiblePixels:COVERAGE,whiteVisiblePixels:COVERAGE,
    });
  });
}
test('rejects hidden black RGB even when fully transparent',()=>{
  assert.throws(()=>verifyWhiteAlphaPng(png({corruptTransparent:true}),COVERAGE),
    /nonwhite RGB pixels/);
});
test('rejects forged checksum corruption before decompressing',()=>{
  const bytes=Buffer.from(png());
  bytes[29]^=1; // CRC byte of IHDR
  assert.throws(()=>verifyWhiteAlphaPng(bytes,COVERAGE),/invalid chunk CRC/);
});
test('rejects wrong alpha coverage even when PNG and CRC are valid',()=>{
  assert.throws(()=>verifyWhiteAlphaPng(png(),COVERAGE+1),/alpha coverage differs/);
});
test('rejects invalid row filter, even with correct IDAT checksum',()=>{
  assert.throws(()=>verifyWhiteAlphaPng(png({invalidFilter:true}),COVERAGE),
    /Unsupported Astro PNG row filter/);
});
test('rejects interlaced PNG and excessive metadata chunks',()=>{
  assert.throws(()=>verifyWhiteAlphaPng(png({interlaced:true}),COVERAGE),
    /non-interlaced/);
  assert.throws(()=>verifyWhiteAlphaPng(png({extraChunks:65}),COVERAGE),
    /too many chunks/);
});
test('rejects trailing bytes and truncated PNG',()=>{
  const valid=png();
  assert.throws(()=>verifyWhiteAlphaPng(Buffer.concat([valid,Buffer.from('extra')]),COVERAGE),
    /end marker/);
  assert.throws(()=>verifyWhiteAlphaPng(valid.subarray(0,valid.length-3),COVERAGE),
    /Truncated Astro PNG/);
});
test('rejects decompression beyond the declared RGBA payload length',()=>{
  const valid=png();
  const extras=Buffer.concat([valid,Buffer.alloc(2*1024*1024)]);
  assert.throws(()=>verifyWhiteAlphaPng(extras,COVERAGE),/safe 2 MiB size limit/);
});
