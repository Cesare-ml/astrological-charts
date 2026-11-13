import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { crc32, deflateSync } from 'node:zlib';
import { createAssetServer } from '../scripts/serve-local-assets.mjs';

// Real HTTP integration with generated, unencumbered fixtures ONLY.
// No Angular, sharp, browser, approved VirgoStars images, or private files.
const IDS=[
  'aries','taurus','gemini','cancer','leo','virgo',
  'libra','scorpio','sagittarius','capricorn','aquarius','pisces',
  'sun','moon','mercury','venus','mars','jupiter','saturn',
  'uranus','neptune','pluto',
];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const PNG_SIGNATURE=Buffer.from('89504e470d0a1a0a','hex');
const CHART_PATH='img/fixture/example.svg';
const MASK_PATH='img/virgostars-astro/masks/aries.png';

function pngChunk(name, bytes=Buffer.alloc(0)) {
  const tag=Buffer.from(name);
  const length=Buffer.alloc(4);length.writeUInt32BE(bytes.length);
  const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([tag,bytes])));
  return Buffer.concat([length,tag,bytes,crc]);
}
function makeApprovedSyntheticMask() {
  const width=512,height=512,stride=width*4;
  const ihdr=Buffer.alloc(13);
  ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);
  ihdr[8]=8;ihdr[9]=6; // non-interlaced RGBA8
  const rgba=Buffer.alloc((stride+1)*height);
  for(let y=0;y<height;y++) {
    const pos=y*(stride+1);
    rgba[pos]=0; // PNG filter: None
    rgba.fill(255,pos+1,pos+1+stride); // solid white + fully opaque
  }
  return Buffer.concat([PNG_SIGNATURE,pngChunk('IHDR',ihdr),
    pngChunk('IDAT',deflateSync(rgba)),pngChunk('IEND')]);
}
function fixture() {
  const temp=mkdtempSync(join(tmpdir(),'astro-http-real-'));
  const base=join(temp,'base','public','assets');
  const privateRoot=join(temp,'approved-private-test','public','assets');
  const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><circle cx="1" cy="1" r="1"/></svg>');
  const baseFilename=join(base,CHART_PATH);
  mkdirSync(dirname(baseFilename),{recursive:true});
  writeFileSync(baseFilename,svg);
  const manifest={schemaVersion:1,assets:[{
    path:CHART_PATH,bytes:svg.length,sha256:hash(svg),status:'approved',
    rightsHolder:'Synthetic test author',
    permissionBasis:'Original generated fixture; no imported artwork',
    approvalEvidence:'tests/astro-local-http.test.mjs',
  }]};
  const image=makeApprovedSyntheticMask();
  const assets=[];
  for(const id of IDS) {
    const name='img/virgostars-astro/masks/'+id+'.png';
    const file=join(privateRoot,name);
    mkdirSync(dirname(file),{recursive:true});
    writeFileSync(file,image);
    assets.push({
      id,maskPath:name,maskSha256:hash(image),
      sourceSha256:hash('original synthetic fixture '+id),
      dimensions:[512,512],coveragePixels:512*512,
    });
  }
  const privateManifest={schemaVersion:1,assets};
  const approval={
    scope:'local-preview-only',
    rightsHolder:'Synthetic test author',
    permissionBasis:'Locally generated fixture for HTTP unit tests only',
    approvalEvidence:'tests/astro-local-http.test.mjs',
  };
  return {temp,base,privateRoot,manifest,privateManifest,approval,image};
}

test('real loopback HTTP server preserves independent approved manifests and rejects mutation', {
  timeout:30000,
}, async()=>{
  const data=fixture();
  let server=null;
  try {
    assert.throws(()=>createAssetServer({
      root:data.base,manifest:data.manifest,
      astroOverlayRoot:data.privateRoot,
      astroOverlayManifest:data.privateManifest,
      astroOverlayApproval:{...data.approval,scope:'public-release'},
    }),/authorization/);

    server=createAssetServer({
      root:data.base,manifest:data.manifest,
      astroOverlayRoot:data.privateRoot,
      astroOverlayManifest:data.privateManifest,
      astroOverlayApproval:data.approval,
    });
    server.listen(0,'127.0.0.1');
    await once(server,'listening');
    const url='http://127.0.0.1:'+server.address().port;
    const mask=url+'/assets/'+MASK_PATH;
    const original=url+'/assets/'+CHART_PATH;

    let response=await fetch(mask);
    assert.equal(response.status,200);
    assert.equal(hash(Buffer.from(await response.arrayBuffer())),hash(data.image));
    response=await fetch(original);
    assert.equal(response.status,200);
    assert.match(await response.text(),/circle/);

    response=await fetch(mask,{method:'HEAD'});
    assert.equal(response.status,200);
    assert.equal(response.headers.get('content-length'),String(data.image.length));
    assert.equal((await response.arrayBuffer()).byteLength,0);
    response=await fetch(mask,{headers:{Origin:'http://localhost:4200'}});
    assert.equal(response.status,200);
    assert.equal(response.headers.get('access-control-allow-origin'),'http://localhost:4200');
    await response.arrayBuffer();

    assert.equal((await fetch(mask,{headers:{Origin:'https://example.invalid'}})).status,403);
    assert.equal((await fetch(mask,{method:'POST'})).status,405);
    assert.equal((await fetch(mask,{method:'OPTIONS'})).status,204);
    assert.equal((await fetch(url+'/assets/img/virgostars-astro/masks/unknown.png')).status,404);
    assert.equal((await fetch(url+'/assets/img/virgostars-astro/masks/%61ries.png')).status,404);

    // Mutation is deliberately confined to temporary synthetic files.
    const originalMaskFile=join(data.privateRoot,MASK_PATH);
    writeFileSync(originalMaskFile,Buffer.from('tampered'));
    assert.equal((await fetch(mask)).status,409,'Tampered mask must be 409');
    rmSync(originalMaskFile);
    assert.equal((await fetch(mask)).status,409,'Missing approved mask must be 409');
    assert.equal((await fetch(mask,{method:'HEAD'})).status,409);
    rmSync(join(data.base,CHART_PATH));
    assert.equal((await fetch(original)).status,409,'Missing base asset must be 409');
    rmSync(data.privateRoot,{recursive:true,force:true});
    assert.equal((await fetch(mask)).status,409,'Removed private root must be 409');
    assert.equal((await fetch(url+'/assets/img/virgostars-astro/masks/unknown.png')).status,404);
  } finally {
    if(server) await new Promise(resolve=>server.close(resolve));
    rmSync(data.temp,{recursive:true,force:true});
  }
});
