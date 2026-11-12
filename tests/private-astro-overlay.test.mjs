import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { verifyPrivateAstroOverlay } from '../scripts/private-astro-overlay.mjs';
import { createAssetServer } from '../scripts/serve-local-assets.mjs';
import { generateSyntheticPack } from '../scripts/generate-synthetic-pack.mjs';

const IDS = [
  'aries','taurus','gemini','cancer','leo','virgo',
  'libra','scorpio','sagittarius','capricorn','aquarius','pisces',
  'sun','moon','mercury','venus','mars','jupiter','saturn',
  'uranus','neptune','pluto',
];
const SHA = bytes => createHash('sha256').update(bytes).digest('hex');
const permission = () => ({
  scope: 'local-preview-only', rightsHolder: 'Fixture author',
  permissionBasis: 'original synthetic asset test only',
  approvalEvidence: 'synthetic shapes generated in this test',
});

async function withPrivatePack(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'astro-overlay-'));
  try {
    const root = join(dir, 'private', 'public', 'assets');
    const img = await sharp({
      create: {
        width: 512, height: 512, channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    }).png().toBuffer();
    const assets = [];
    for (const id of IDS) {
      const path = 'img/virgostars-astro/masks/' + id + '.png';
      const abs = join(root, ...path.split('/'));
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, img);
      assets.push({
        id, maskPath: path, maskSha256: SHA(img),
        sourceSha256: SHA('synthetic original ' + id),
        dimensions: [512, 512], coveragePixels: 512 * 512,
      });
    }
    const manifest = { schemaVersion: 1, assets };
    await fn({dir,root,manifest,approval:permission(),img});
  } finally {
    rmSync(dir,{recursive:true,force:true});
  }
}

test('accepts exactly 22 privately approved image masks without copying them',async()=>{
  await withPrivatePack(async({root,manifest,approval})=>{
    const pack=verifyPrivateAstroOverlay(root,manifest,approval);
    assert.equal(pack.count,22);
    assert.equal(pack.paths.size,22);
    assert.equal(pack.scope,'local-preview-only');
    assert.equal(pack.paths.get('img/virgostars-astro/masks/aries.png').sha256,manifest.assets[0].maskSha256);
  });
});

test('requires explicit owner authorization, all symbols and exact paths',async()=>{
  await withPrivatePack(async({root,manifest,approval})=>{
    assert.throws(()=>verifyPrivateAstroOverlay(root,manifest,null),/authorization/);
    assert.throws(()=>verifyPrivateAstroOverlay(root,manifest,{...approval,scope:'public-release'}),/authorization/);
    assert.throws(()=>verifyPrivateAstroOverlay(root,manifest,{...approval,approvalEvidence:''}),/authorization/);
    const short=structuredClone(manifest);short.assets.pop();
    assert.throws(()=>verifyPrivateAstroOverlay(root,short,approval),/exactly 22/);
    const duplicate=structuredClone(manifest);duplicate.assets[1].id=duplicate.assets[0].id;
    assert.throws(()=>verifyPrivateAstroOverlay(root,duplicate,approval),/duplicate Astro glyph/);
    const wrong=structuredClone(manifest);wrong.assets[0].maskPath='img/other/aries.png';
    assert.throws(()=>verifyPrivateAstroOverlay(root,wrong,approval),/Invalid Astro mask manifest/);
    const unknown=structuredClone(manifest);unknown.assets[0].id='chiron';
    assert.throws(()=>verifyPrivateAstroOverlay(root,unknown,approval),/Unexpected or duplicate/);
  });
});

test('rejects changed bytes, unexpected PNG dimensions and symlinks',async t=>{
  await withPrivatePack(async({root,manifest,approval})=>{
    const target=join(root,'img/virgostars-astro/masks/aries.png');
    const original=readFileSync(target);
    writeFileSync(target,Buffer.concat([original,Buffer.from('tampered')]));
    assert.throws(()=>verifyPrivateAstroOverlay(root,manifest,approval),/differs from private manifest/);
    writeFileSync(target,original);
    const wrongDimensions=structuredClone(manifest);
    wrongDimensions.assets[0].dimensions=[48,48];
    assert.throws(()=>verifyPrivateAstroOverlay(root,wrongDimensions,approval),/Invalid Astro mask manifest/);
    rmSync(target);
    try{symlinkSync(join(root,'img/virgostars-astro/masks/taurus.png'),target);}
    catch(err){
      if(process.platform==='win32'&&['EPERM','EACCES','UNKNOWN'].includes(err.code)){
        t.skip('Cannot create symlinks on this Windows account');
        return;
      }
      throw err;
    }
    assert.throws(()=>verifyPrivateAstroOverlay(root,manifest,approval),/symlink forbidden/);
  });
});

test('rejects nonwhite pixels and incorrect alpha counts even if SHA-256 was refreshed',async()=>{
  await withPrivatePack(async({root,manifest,approval})=>{
    const target=join(root,'img/virgostars-astro/masks/aries.png');
    const original=readFileSync(target);
    const bad=await sharp({
      create:{width:512,height:512,channels:4,
        background:{r:0,g:0,b:0,alpha:1}}
    }).png().toBuffer();
    writeFileSync(target,bad);
    const altered=structuredClone(manifest);
    altered.assets[0].maskSha256=SHA(bad);
    assert.throws(()=>verifyPrivateAstroOverlay(root,altered,approval),/nonwhite RGB/);
    writeFileSync(target,original);
    const coverage=structuredClone(manifest);
    coverage.assets[0].coveragePixels=512 * 512 - 1;
    assert.throws(()=>verifyPrivateAstroOverlay(root,coverage,approval),/alpha coverage differs/);
  });
});

test('rejects hidden black pixels and CRC corruption despite updated SHA-256',async()=>{
  await withPrivatePack(async({root,manifest,approval})=>{
    const target=join(root,'img/virgostars-astro/masks/aries.png');
    const original=readFileSync(target);
    const changed=structuredClone(manifest);

    // A black pixel with alpha=0 can still produce a dark filtering halo.
    // Keep one white visible pixel so coverage remains a valid nonzero count.
    const pixels=Buffer.alloc(512*512*4);
    for(let i=0;i<pixels.length;i+=4) pixels.fill(255,i,i+3);
    pixels[3]=255; // one white opaque pixel
    pixels[4]=0;pixels[5]=0;pixels[6]=0; // RGB black, alpha remains zero
    const hiddenBlack=await sharp(pixels,{
      raw:{width:512,height:512,channels:4}
    }).png().toBuffer();
    writeFileSync(target,hiddenBlack);
    changed.assets[0].maskSha256=SHA(hiddenBlack);
    changed.assets[0].coveragePixels=1;
    assert.throws(()=>verifyPrivateAstroOverlay(root,changed,approval),
      /nonwhite RGB.*transparent/);

    // A CRC error must not pass just because a manifest hash was regenerated.
    const corrupted=Buffer.from(original);
    corrupted[29]^=1; // IHDR CRC (8-byte signature + 4 length + 4 type + 13 payload)
    writeFileSync(target,corrupted);
    changed.assets[0].maskSha256=SHA(corrupted);
    changed.assets[0].coveragePixels=512*512;
    assert.throws(()=>verifyPrivateAstroOverlay(root,changed,approval),
      /invalid chunk CRC/);
  });
});

test('local server serves only verified private overlay and approved base pack',async()=>{
  await withPrivatePack(async({root,manifest,approval,dir,img})=>{
    const base=generateSyntheticPack(join(dir,'base'));
    const server=createAssetServer({
      root:base.root,manifest:base.manifest,
      astroOverlayRoot:root,astroOverlayManifest:manifest,astroOverlayApproval:approval,
    });
    server.listen(0,'127.0.0.1');
    await once(server,'listening');
    const url='http://127.0.0.1:'+server.address().port;
    try {
      const overlay=await fetch(url+'/assets/img/virgostars-astro/masks/aries.png');
      assert.equal(overlay.status,200);
      assert.equal(SHA(Buffer.from(await overlay.arrayBuffer())),SHA(img));
      const legacy=await fetch(url+'/assets/img/simboli-bianchi/segni/01.png');
      assert.equal(legacy.status,200);
      const rejected=await fetch(url+'/assets/img/virgostars-astro/masks/not-a-glyph.png');
      assert.equal(rejected.status,404);
      const forbidden=await fetch(url+'/assets/img/virgostars-astro/masks/aries.png',{
        headers:{Origin:'https://not-local.example'},
      });
      assert.equal(forbidden.status,403);
      writeFileSync(join(root,'img/virgostars-astro/masks/aries.png'),Buffer.from('bad'));
      assert.equal((await fetch(url+'/assets/img/virgostars-astro/masks/aries.png')).status,409);
    } finally {
      await new Promise(resolve=>server.close(resolve));
    }
  });
});

test('server refuses partial overlays and unauthorised or overlapping masks',async()=>{
  await withPrivatePack(async({root,manifest,approval,dir})=>{
    const base=generateSyntheticPack(join(dir,'base'));
    const settings={root:base.root,manifest:base.manifest};
    assert.throws(()=>createAssetServer({...settings,astroOverlayRoot:root}),/requires root, manifest and approval/);
    assert.throws(()=>createAssetServer({
      ...settings,astroOverlayRoot:root,astroOverlayManifest:manifest,
      astroOverlayApproval:{...approval,scope:'public-release'},
    }),/authorization/);
    // A truly approved base entry with an overlapping path must be rejected.
    const collidingPath='img/virgostars-astro/masks/aries.png';
    const collidingFile=join(base.root,...collidingPath.split('/'));
    mkdirSync(dirname(collidingFile),{recursive:true});
    const bytes=readFileSync(join(root,...collidingPath.split('/')));
    writeFileSync(collidingFile,bytes);
    const collision=structuredClone(base.manifest);
    collision.assets.push({
      path:collidingPath,bytes:bytes.length,sha256:SHA(bytes),
      status:'approved',rightsHolder:'Fixture author',
      permissionBasis:'synthetic test',approvalEvidence:'test-generated fixture',
    });
    assert.throws(()=>createAssetServer({
      root:base.root,manifest:collision,astroOverlayRoot:root,
      astroOverlayManifest:manifest,astroOverlayApproval:approval,
    }),/Private Astro overlay collides/);

    // The private pack may not be staged inside the public asset checkout,
    // even when its 22 paths are not listed by the base manifest.
    const nested=join(base.root,'private-astro-staging');
    for(const entry of manifest.assets) {
      const dest=join(nested,...entry.maskPath.split('/'));
      mkdirSync(dirname(dest),{recursive:true});
      copyFileSync(join(root,...entry.maskPath.split('/')),dest);
    }
    assert.throws(()=>createAssetServer({
      ...settings,astroOverlayRoot:nested,
      astroOverlayManifest:manifest,astroOverlayApproval:approval,
    }),/outside public asset and renderer checkouts/);
  });
});
