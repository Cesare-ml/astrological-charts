import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAssetServer, resolveAssetRequest } from '../scripts/serve-local-assets.mjs';
import { generateSyntheticPack, sourcePreloadPaths, makeSyntheticPng } from '../scripts/generate-synthetic-pack.mjs';

async function withAssetServer(fn) {
  const dir=mkdtempSync(join(tmpdir(),'chart-asset-preview-'));
  const fixture=generateSyntheticPack(join(dir,'synthetic'));
  const {root,manifest}=fixture;
  const file='img/simboli-bianchi/segni/01.png';
  const server=createAssetServer({root,manifest});
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  try {await fn({root,dir,file,manifest,url:'http://127.0.0.1:'+server.address().port});}
  finally {
    await new Promise(resolve=>server.close(resolve));
    rmSync(dir,{recursive:true,force:true});
  }
}

test('generates 78 original valid PNG fixtures with the same legacy filenames',()=>{
  const dir=mkdtempSync(join(tmpdir(),'chart-synthetic-'));
  try {
    const pack=generateSyntheticPack(join(dir,'new'));
    assert.equal(pack.manifest.assets.length,78);
    assert.equal(new Set(pack.manifest.assets.map(x=>x.path)).size,78);
    assert.ok(pack.manifest.assets.every(x=>x.path.endsWith('.png')&&x.permissionBasis.includes('synthetic')));
    const png=makeSyntheticPng('img/simboli-bianchi/segni/01.png');
    assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16),48);
    assert.throws(()=>generateSyntheticPack(join(dir,'new')),/already exists/);
  } finally{rmSync(dir,{recursive:true,force:true});}
});

test('synthetic source extraction fails on accidental changes to preload coverage',()=>{
  assert.throws(()=>sourcePreloadPaths('public static preloadArraySimboli = ["/assets/img/abc.png"];'),/exactly 78/);
  assert.throws(()=>sourcePreloadPaths('no preload here'),/Preload list missing/);
});

test('independent localhost server serves verified PNG files without VirgoStars access',async()=>{
  await withAssetServer(async({url})=>{
    const r=await fetch(url+'/assets/img/simboli-bianchi/segni/01.png',{
      headers:{Origin:'http://localhost:4200'}
    });
    assert.equal(r.status,200);
    assert.equal(r.headers.get('content-type'),'image/png');
    assert.equal(r.headers.get('access-control-allow-origin'),'http://localhost:4200');
    assert.equal(Buffer.from(await r.arrayBuffer()).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    const head=await fetch(url+'/assets/img/simboli-bianchi/segni/01.png',{method:'HEAD'});
    assert.equal(head.status,200);
    const preview=await fetch(url+'/__preview');
    assert.equal(preview.status,200);
    const html=await preview.text();
    assert.ok(html.includes('78 approved files'));
    assert.ok(html.includes('img/simboli-bianchi/segni/01.png'));
  });
});

test('refuses unapproved assets, outside origins, traversal and writing',async()=>{
  await withAssetServer(async({url,root})=>{
    writeFileSync(join(root,'img','unapproved.png'),makeSyntheticPng('unapproved'));
    assert.equal((await fetch(url+'/assets/img/unapproved.png')).status,404);
    assert.equal((await fetch(url+'/assets/img/unapproved.json')).status,404);
    assert.equal((await fetch(url+'/assets/')).status,404);
    assert.equal((await fetch(url+'/assets/img/../secret.txt')).status,404);
    assert.equal((await fetch(url+'/assets/img/simboli-bianchi/segni/01.png',{method:'POST'})).status,405);
    assert.equal((await fetch(url+'/assets/img/simboli-bianchi/segni/01.png',{
      headers:{Origin:'https://evil.example'}
    })).status,403);
    assert.equal(resolveAssetRequest(root,'/assets/img/../../secret.txt'),null);
  });
});

test('rejects an altered approved file even after the server has started',async()=>{
  await withAssetServer(async({url,root,file})=>{
    writeFileSync(join(root,...file.split('/')),'changed');
    const r=await fetch(url+'/assets/'+file);
    assert.equal(r.status,409);
  });
});

test('requires an approved manifest with valid SHA-256 and safe local origins',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'chart-verified-'));
  try {
    const {root,manifest}=generateSyntheticPack(join(dir,'pack'));
    assert.throws(()=>createAssetServer({root}),/manifest required/);
    assert.throws(()=>createAssetServer({root,manifest,origins:['https://other.example']}),/Only local/);
    const altered=structuredClone(manifest);
    altered.assets[0].sha256='a'.repeat(64);
    assert.throws(()=>createAssetServer({root,manifest:altered}),/differs from approved manifest/);
    const unlicensed=structuredClone(manifest);
    unlicensed.assets[0].permissionBasis='';
    assert.throws(()=>createAssetServer({root,manifest:unlicensed}),/Missing explicit approval metadata/);
    const pending=structuredClone(manifest);
    pending.assets[0].status='pending';
    assert.throws(()=>createAssetServer({root,manifest:pending}),/not approved/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('server rejects symlinked approved assets (where supported)',async t=>{
  await withAssetServer(async({root,dir,file})=>{
    const path=join(root,...file.split('/'));
    const other=join(dir,'other.png');
    writeFileSync(other,makeSyntheticPng('other'));
    rmSync(path);
    try{symlinkSync(other,path);}
    catch(err){
      if(process.platform==='win32'&&['EPERM','EACCES','UNKNOWN'].includes(err.code)){
        t.skip('This Windows account cannot create symlinks');
        return;
      }
      throw err;
    }
    assert.equal(resolveAssetRequest(root,'/assets/'+file),null);
  });
});
